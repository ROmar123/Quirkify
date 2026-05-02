-- Migration 013: Withdrawal requests, offline reservations, campaign placements

-- ─────────────────────────────────────────────
-- WITHDRAWAL REQUESTS
-- ─────────────────────────────────────────────
CREATE TYPE withdrawal_status AS ENUM ('requested','approved','rejected','paid','cancelled');

CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount          NUMERIC(10,2) NOT NULL CHECK (amount >= 50),
  status          withdrawal_status NOT NULL DEFAULT 'requested',
  bank_name       TEXT,
  account_number  TEXT,
  account_holder  TEXT,
  reference       TEXT,
  admin_note      TEXT,
  reviewed_by     UUID REFERENCES profiles(id),
  reviewed_at     TIMESTAMPTZ,
  paid_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE withdrawal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_see_own_withdrawals" ON withdrawal_requests
  FOR SELECT USING (profile_id IN (
    SELECT id FROM profiles WHERE auth_uid = auth.uid()
  ));

CREATE POLICY "users_create_withdrawals" ON withdrawal_requests
  FOR INSERT WITH CHECK (profile_id IN (
    SELECT id FROM profiles WHERE auth_uid = auth.uid()
  ));

CREATE POLICY "users_cancel_own" ON withdrawal_requests
  FOR UPDATE USING (
    profile_id IN (SELECT id FROM profiles WHERE auth_uid = auth.uid())
    AND status = 'requested'
  ) WITH CHECK (status = 'cancelled');

CREATE POLICY "admins_manage_withdrawals" ON withdrawal_requests
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE auth_uid = auth.uid() AND role = 'admin'
    )
  );

-- RPC: request_withdrawal
CREATE OR REPLACE FUNCTION request_withdrawal(
  p_profile_id    UUID,
  p_amount        NUMERIC,
  p_bank_name     TEXT,
  p_account_number TEXT,
  p_account_holder TEXT
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_balance   NUMERIC;
  v_req_id    UUID;
BEGIN
  -- Check wallet balance
  SELECT available_balance INTO v_balance
  FROM wallet_accounts
  WHERE profile_id = p_profile_id
  FOR UPDATE;

  IF v_balance IS NULL OR v_balance < p_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE: available=%, requested=%', COALESCE(v_balance, 0), p_amount;
  END IF;

  -- Reserve (debit) the amount immediately to prevent double-withdrawal
  UPDATE wallet_accounts
  SET available_balance = available_balance - p_amount,
      updated_at = NOW()
  WHERE profile_id = p_profile_id;

  INSERT INTO wallet_ledger (profile_id, amount, entry_type, reference_type, reference_id, metadata)
  VALUES (p_profile_id, -p_amount, 'withdrawal_reserved', 'withdrawal', NULL,
          jsonb_build_object('status', 'pending_approval'));

  INSERT INTO withdrawal_requests (profile_id, amount, bank_name, account_number, account_holder)
  VALUES (p_profile_id, p_amount, p_bank_name, p_account_number, p_account_holder)
  RETURNING id INTO v_req_id;

  -- Update ledger reference_id
  UPDATE wallet_ledger
  SET reference_id = v_req_id::TEXT
  WHERE profile_id = p_profile_id
    AND entry_type = 'withdrawal_reserved'
    AND reference_id IS NULL
  ORDER BY created_at DESC
  LIMIT 1;

  RETURN v_req_id;
END;
$$;

-- RPC: approve_withdrawal
CREATE OR REPLACE FUNCTION approve_withdrawal(
  p_request_id  UUID,
  p_admin_id    UUID,
  p_reference   TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE withdrawal_requests
  SET status = 'paid',
      reviewed_by = p_admin_id,
      reviewed_at = NOW(),
      paid_at = NOW(),
      reference = COALESCE(p_reference, reference),
      updated_at = NOW()
  WHERE id = p_request_id AND status = 'approved';

  IF NOT FOUND THEN
    -- Try approving from 'requested' straight to 'paid'
    UPDATE withdrawal_requests
    SET status = 'paid',
        reviewed_by = p_admin_id,
        reviewed_at = NOW(),
        paid_at = NOW(),
        reference = COALESCE(p_reference, reference),
        updated_at = NOW()
    WHERE id = p_request_id AND status IN ('requested', 'approved');
  END IF;
END;
$$;

-- RPC: reject_withdrawal (refunds balance)
CREATE OR REPLACE FUNCTION reject_withdrawal(
  p_request_id UUID,
  p_admin_id   UUID,
  p_note       TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_req withdrawal_requests;
BEGIN
  SELECT * INTO v_req FROM withdrawal_requests WHERE id = p_request_id;
  IF v_req.id IS NULL THEN RAISE EXCEPTION 'Withdrawal not found'; END IF;
  IF v_req.status NOT IN ('requested','approved') THEN
    RAISE EXCEPTION 'Cannot reject withdrawal in status %', v_req.status;
  END IF;

  UPDATE withdrawal_requests
  SET status = 'rejected', reviewed_by = p_admin_id, reviewed_at = NOW(),
      admin_note = COALESCE(p_note, admin_note), updated_at = NOW()
  WHERE id = p_request_id;

  -- Refund reserved amount
  UPDATE wallet_accounts
  SET available_balance = available_balance + v_req.amount, updated_at = NOW()
  WHERE profile_id = v_req.profile_id;

  INSERT INTO wallet_ledger (profile_id, amount, entry_type, reference_type, reference_id, metadata)
  VALUES (v_req.profile_id, v_req.amount, 'withdrawal_refunded', 'withdrawal', p_request_id::TEXT,
          jsonb_build_object('admin_note', p_note));
END;
$$;

-- ─────────────────────────────────────────────
-- OFFLINE RESERVATIONS
-- ─────────────────────────────────────────────
CREATE TYPE offline_reservation_status AS ENUM ('reserved','sold_offline','released','expired','cancelled');
CREATE TYPE offline_channel AS ENUM ('whatsapp','facebook_marketplace','instagram','in_store','other');

CREATE TABLE IF NOT EXISTS offline_reservations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id       UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  listing_id       UUID REFERENCES store_listings(id) ON DELETE SET NULL,
  quantity         INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  channel          offline_channel NOT NULL DEFAULT 'whatsapp',
  customer_name    TEXT,
  customer_contact TEXT,
  agreed_price     NUMERIC(10,2),
  status           offline_reservation_status NOT NULL DEFAULT 'reserved',
  expires_at       TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '48 hours'),
  notes            TEXT,
  created_by       UUID REFERENCES profiles(id),
  resolved_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE offline_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_manage_reservations" ON offline_reservations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE auth_uid = auth.uid() AND role = 'admin')
  );

-- RPC: create_offline_reservation (reserves stock from store_listing)
CREATE OR REPLACE FUNCTION create_offline_reservation(
  p_product_id     UUID,
  p_listing_id     UUID,
  p_quantity       INT,
  p_channel        TEXT,
  p_customer_name  TEXT,
  p_customer_contact TEXT,
  p_agreed_price   NUMERIC,
  p_notes          TEXT,
  p_admin_id       UUID
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id UUID;
  v_qty_remaining INT;
BEGIN
  IF p_listing_id IS NOT NULL THEN
    SELECT quantity_remaining INTO v_qty_remaining
    FROM store_listings WHERE id = p_listing_id FOR UPDATE;

    IF v_qty_remaining < p_quantity THEN
      RAISE EXCEPTION 'INSUFFICIENT_STOCK: available=%, requested=%', v_qty_remaining, p_quantity;
    END IF;

    UPDATE store_listings
    SET quantity_remaining = quantity_remaining - p_quantity,
        status = CASE WHEN quantity_remaining - p_quantity = 0 THEN 'sold_out' ELSE status END,
        updated_at = NOW()
    WHERE id = p_listing_id;
  END IF;

  INSERT INTO offline_reservations (
    product_id, listing_id, quantity, channel, customer_name, customer_contact,
    agreed_price, notes, created_by
  ) VALUES (
    p_product_id, p_listing_id, p_quantity, p_channel::offline_channel,
    p_customer_name, p_customer_contact, p_agreed_price, p_notes, p_admin_id
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- RPC: resolve_offline_reservation
CREATE OR REPLACE FUNCTION resolve_offline_reservation(
  p_reservation_id UUID,
  p_new_status     TEXT  -- 'sold_offline' | 'released' | 'cancelled'
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_res offline_reservations;
BEGIN
  SELECT * INTO v_res FROM offline_reservations WHERE id = p_reservation_id;
  IF v_res.id IS NULL THEN RAISE EXCEPTION 'Reservation not found'; END IF;
  IF v_res.status != 'reserved' THEN RAISE EXCEPTION 'Reservation already resolved'; END IF;

  UPDATE offline_reservations
  SET status = p_new_status::offline_reservation_status,
      resolved_at = NOW(), updated_at = NOW()
  WHERE id = p_reservation_id;

  -- If releasing/cancelling, restore stock to listing
  IF p_new_status IN ('released', 'cancelled') AND v_res.listing_id IS NOT NULL THEN
    UPDATE store_listings
    SET quantity_remaining = quantity_remaining + v_res.quantity,
        status = CASE WHEN status = 'sold_out' THEN 'published' ELSE status END,
        updated_at = NOW()
    WHERE id = v_res.listing_id;
  END IF;

  -- If sold_offline: record inventory movement on product
  IF p_new_status = 'sold_offline' THEN
    UPDATE products
    SET stock = GREATEST(0, COALESCE(stock, 0) - v_res.quantity),
        updated_at = NOW()
    WHERE id = v_res.product_id;
  END IF;
END;
$$;

-- Auto-expire reservations job (call periodically)
CREATE OR REPLACE FUNCTION expire_offline_reservations() RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count INT;
BEGIN
  WITH expired AS (
    UPDATE offline_reservations
    SET status = 'expired', resolved_at = NOW(), updated_at = NOW()
    WHERE status = 'reserved' AND expires_at < NOW()
    RETURNING id, listing_id, quantity
  ),
  restore AS (
    UPDATE store_listings sl
    SET quantity_remaining = sl.quantity_remaining + e.quantity,
        status = CASE WHEN sl.status = 'sold_out' THEN 'published' ELSE sl.status END,
        updated_at = NOW()
    FROM expired e
    WHERE sl.id = e.listing_id
    RETURNING sl.id
  )
  SELECT COUNT(*) INTO v_count FROM expired;

  RETURN v_count;
END;
$$;

-- ─────────────────────────────────────────────
-- CAMPAIGN PLACEMENTS
-- ─────────────────────────────────────────────
CREATE TYPE placement_slot AS ENUM (
  'home_hero',
  'store_banner',
  'auction_banner',
  'pack_banner',
  'product_section',
  'checkout_banner'
);

CREATE TYPE placement_status AS ENUM ('active','paused','ended');

CREATE TABLE IF NOT EXISTS campaign_placements (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  slot         placement_slot NOT NULL,
  status       placement_status NOT NULL DEFAULT 'active',
  headline     TEXT,
  subline      TEXT,
  cta_text     TEXT DEFAULT 'Shop Now',
  cta_url      TEXT,
  image_url    TEXT,
  bg_color     TEXT DEFAULT '#7C3AED',
  starts_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at      TIMESTAMPTZ,
  priority     INT NOT NULL DEFAULT 0,
  created_by   UUID REFERENCES profiles(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (slot, campaign_id)
);

ALTER TABLE campaign_placements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_active_placements" ON campaign_placements
  FOR SELECT USING (
    status = 'active'
    AND starts_at <= NOW()
    AND (ends_at IS NULL OR ends_at > NOW())
  );

CREATE POLICY "admins_manage_placements" ON campaign_placements
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE auth_uid = auth.uid() AND role = 'admin')
  );

-- ─────────────────────────────────────────────
-- EMAIL LOG (track sent transactional emails)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email    TEXT NOT NULL,
  template    TEXT NOT NULL,
  reference_id TEXT,
  status      TEXT NOT NULL DEFAULT 'sent',
  error       TEXT,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE email_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins_see_email_log" ON email_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE auth_uid = auth.uid() AND role = 'admin')
  );

-- ─────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_profile ON withdrawal_requests(profile_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON withdrawal_requests(status);
CREATE INDEX IF NOT EXISTS idx_offline_reservations_product ON offline_reservations(product_id);
CREATE INDEX IF NOT EXISTS idx_offline_reservations_status ON offline_reservations(status);
CREATE INDEX IF NOT EXISTS idx_offline_reservations_expires ON offline_reservations(expires_at) WHERE status = 'reserved';
CREATE INDEX IF NOT EXISTS idx_campaign_placements_slot ON campaign_placements(slot) WHERE status = 'active';
