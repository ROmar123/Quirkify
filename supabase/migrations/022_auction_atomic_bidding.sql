-- Migration 022: Atomic auction bidding with wallet holds + server-side settlement
-- Applied to live DB as supabase migration version 20260507202145

-- Add missing columns to auctions table
ALTER TABLE auctions
  ADD COLUMN IF NOT EXISTS current_highest_bid numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS highest_bidder_id   uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS bid_count           integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS winner_order_id     uuid REFERENCES orders(id),
  ADD COLUMN IF NOT EXISTS no_sale_reason      text,
  ADD COLUMN IF NOT EXISTS increment           numeric DEFAULT 50;

-- Wallet holds table: tracks per-auction fund reservations
CREATE TABLE IF NOT EXISTS wallet_holds (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id       uuid REFERENCES wallet_accounts(id) ON DELETE CASCADE,
  profile_id      uuid REFERENCES profiles(id) ON DELETE CASCADE,
  auction_id      uuid REFERENCES auctions(id) ON DELETE CASCADE,
  amount          numeric NOT NULL CHECK (amount > 0),
  released_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE wallet_holds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_holds" ON wallet_holds FOR SELECT USING (profile_id = auth_profile_id());
CREATE POLICY "service_manage_holds" ON wallet_holds FOR ALL USING (auth.role() = 'service_role');
CREATE INDEX IF NOT EXISTS wallet_holds_auction ON wallet_holds(auction_id) WHERE released_at IS NULL;
CREATE INDEX IF NOT EXISTS wallet_holds_profile ON wallet_holds(profile_id) WHERE released_at IS NULL;

-- Atomic bid placement RPC
CREATE OR REPLACE FUNCTION place_auction_bid(
  p_auction_id uuid,
  p_bidder_id  uuid,
  p_amount     numeric
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_auction auctions;
  v_wallet  wallet_accounts;
BEGIN
  -- Lock auction row (prevents concurrent bids on same auction)
  SELECT * INTO v_auction FROM auctions WHERE id = p_auction_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'AUCTION_NOT_FOUND'; END IF;
  IF v_auction.status NOT IN ('scheduled','live') THEN RAISE EXCEPTION 'AUCTION_NOT_LIVE'; END IF;
  IF v_auction.end_time IS NOT NULL AND NOW() > v_auction.end_time THEN RAISE EXCEPTION 'AUCTION_ENDED'; END IF;
  IF p_amount < v_auction.current_highest_bid + COALESCE(v_auction.increment, 50) THEN
    RAISE EXCEPTION 'BID_TOO_LOW: minimum is %', v_auction.current_highest_bid + COALESCE(v_auction.increment, 50);
  END IF;
  IF p_bidder_id = v_auction.highest_bidder_id THEN
    RAISE EXCEPTION 'ALREADY_HIGHEST_BIDDER';
  END IF;

  -- Lock bidder wallet (prevents concurrent wallet ops)
  SELECT * INTO v_wallet FROM wallet_accounts WHERE profile_id = p_bidder_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'WALLET_NOT_FOUND'; END IF;
  IF v_wallet.available_balance < p_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE: have % need %', v_wallet.available_balance, p_amount;
  END IF;

  -- Release previous highest bidder's hold and return their funds
  IF v_auction.highest_bidder_id IS NOT NULL THEN
    UPDATE wallet_accounts wa
    SET available_balance = wa.available_balance + wh.amount,
        held_balance      = GREATEST(0, wa.held_balance - wh.amount)
    FROM wallet_holds wh
    WHERE wh.wallet_id = wa.id
      AND wh.auction_id = p_auction_id
      AND wh.profile_id = v_auction.highest_bidder_id
      AND wh.released_at IS NULL;

    UPDATE wallet_holds SET released_at = NOW()
    WHERE auction_id = p_auction_id
      AND profile_id = v_auction.highest_bidder_id
      AND released_at IS NULL;
  END IF;

  -- Reserve funds for new bidder (move from available → held)
  UPDATE wallet_accounts
  SET available_balance = available_balance - p_amount,
      held_balance      = held_balance + p_amount
  WHERE id = v_wallet.id;

  INSERT INTO wallet_holds (wallet_id, profile_id, auction_id, amount)
  VALUES (v_wallet.id, p_bidder_id, p_auction_id, p_amount);

  -- Record bid
  INSERT INTO auction_bids (auction_id, bidder_id, amount)
  VALUES (p_auction_id, p_bidder_id, p_amount);

  -- Update auction state
  UPDATE auctions
  SET current_highest_bid = p_amount,
      highest_bidder_id   = p_bidder_id,
      bid_count           = COALESCE(bid_count, 0) + 1,
      updated_at          = NOW()
  WHERE id = p_auction_id;
END;
$$;

-- Atomic settlement RPC
CREATE OR REPLACE FUNCTION settle_auction(p_auction_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_auction  auctions;
  v_order_id uuid;
BEGIN
  SELECT * INTO v_auction FROM auctions WHERE id = p_auction_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'AUCTION_NOT_FOUND'); END IF;

  -- Idempotency: already settled
  IF v_auction.status IN ('completed','no_sale','cancelled') THEN
    RETURN jsonb_build_object('status', v_auction.status, 'already_settled', true);
  END IF;

  -- Mark as settling to prevent race (any concurrent call will see this and exit via idempotency)
  UPDATE auctions SET status = 'settling' WHERE id = p_auction_id;

  -- No bids
  IF COALESCE(v_auction.bid_count, 0) = 0 OR v_auction.highest_bidder_id IS NULL THEN
    UPDATE auctions SET status = 'no_sale', no_sale_reason = 'no_bids' WHERE id = p_auction_id;
    RETURN jsonb_build_object('status', 'no_sale', 'reason', 'no_bids');
  END IF;

  -- Reserve price not met
  IF v_auction.reserve_price IS NOT NULL AND v_auction.current_highest_bid < v_auction.reserve_price THEN
    -- Release all holds and restore available balances
    UPDATE wallet_accounts wa
    SET available_balance = wa.available_balance + wh.amount,
        held_balance      = GREATEST(0, wa.held_balance - wh.amount)
    FROM wallet_holds wh
    WHERE wh.wallet_id = wa.id
      AND wh.auction_id = p_auction_id
      AND wh.released_at IS NULL;

    UPDATE wallet_holds SET released_at = NOW()
    WHERE auction_id = p_auction_id AND released_at IS NULL;

    UPDATE auctions SET status = 'no_sale', no_sale_reason = 'reserve_not_met'
    WHERE id = p_auction_id;
    RETURN jsonb_build_object('status', 'no_sale', 'reason', 'reserve_not_met');
  END IF;

  -- Create winner order
  INSERT INTO orders (
    profile_id, channel, source_ref, subtotal, discount, shipping_cost,
    payment_method, payment_status, paid_at, status
  ) VALUES (
    v_auction.highest_bidder_id, 'auction', p_auction_id::text,
    v_auction.current_highest_bid, 0, 0,
    'wallet', 'completed', NOW(), 'paid'
  ) RETURNING id INTO v_order_id;

  INSERT INTO order_items (order_id, product_id, unit_price, quantity, line_total)
  VALUES (v_order_id, v_auction.product_id,
          v_auction.current_highest_bid, 1, v_auction.current_highest_bid);

  -- Convert winner's hold → ledger debit
  UPDATE wallet_holds SET released_at = NOW()
  WHERE auction_id = p_auction_id
    AND profile_id = v_auction.highest_bidder_id
    AND released_at IS NULL;

  UPDATE wallet_accounts
  SET held_balance = GREATEST(0, held_balance - v_auction.current_highest_bid)
  WHERE profile_id = v_auction.highest_bidder_id;

  INSERT INTO wallet_ledger (wallet_account_id, direction, entry_type, amount, available_balance_after, reference_type, reference_id)
  SELECT wa.id, 'debit', 'order_payment', v_auction.current_highest_bid,
         wa.available_balance, 'order', v_order_id
  FROM wallet_accounts wa WHERE wa.profile_id = v_auction.highest_bidder_id;

  -- Release all losing bidder holds in one pass
  UPDATE wallet_accounts wa
  SET available_balance = wa.available_balance + wh.amount,
      held_balance      = GREATEST(0, wa.held_balance - wh.amount)
  FROM wallet_holds wh
  WHERE wh.wallet_id = wa.id
    AND wh.auction_id = p_auction_id
    AND wh.profile_id != v_auction.highest_bidder_id
    AND wh.released_at IS NULL;

  UPDATE wallet_holds SET released_at = NOW()
  WHERE auction_id = p_auction_id
    AND profile_id != v_auction.highest_bidder_id
    AND released_at IS NULL;

  -- Decrement stock
  UPDATE products SET stock = stock - 1
  WHERE id = v_auction.product_id AND stock > 0;

  -- Insert collection item
  INSERT INTO collection_items (profile_id, product_id, purchase_price, acquired_at)
  VALUES (v_auction.highest_bidder_id, v_auction.product_id,
          v_auction.current_highest_bid, NOW());

  -- Mark completed
  UPDATE auctions
  SET status = 'completed', winner_order_id = v_order_id, updated_at = NOW()
  WHERE id = p_auction_id;

  RETURN jsonb_build_object(
    'status', 'completed',
    'orderId', v_order_id,
    'winnerId', v_auction.highest_bidder_id,
    'amount', v_auction.current_highest_bid
  );
END;
$$;
