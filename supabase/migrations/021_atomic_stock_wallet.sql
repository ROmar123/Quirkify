-- Migration 021: Atomic stock decrement and wallet debit to prevent race conditions
-- Applied to live DB as supabase migration version 20260507202033

CREATE OR REPLACE FUNCTION decrement_product_stock(p_product_id uuid, p_quantity int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_product_id::text));
  UPDATE products SET stock = stock - p_quantity
  WHERE id = p_product_id AND stock >= p_quantity;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INSUFFICIENT_STOCK: product % has insufficient stock', p_product_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION wallet_debit_safe(
  p_profile_id     uuid,
  p_amount         numeric,
  p_entry_type     text,
  p_reference_type text,
  p_reference_id   uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_wallet wallet_accounts;
BEGIN
  SELECT * INTO v_wallet FROM wallet_accounts WHERE profile_id = p_profile_id FOR UPDATE;
  IF v_wallet IS NULL THEN
    RAISE EXCEPTION 'WALLET_NOT_FOUND: no wallet for profile %', p_profile_id;
  END IF;
  IF v_wallet.available_balance < p_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE: have % need %', v_wallet.available_balance, p_amount;
  END IF;
  UPDATE wallet_accounts
    SET available_balance = available_balance - p_amount
    WHERE id = v_wallet.id;
  INSERT INTO wallet_ledger (wallet_account_id, direction, entry_type, amount, available_balance_after, reference_type, reference_id)
  VALUES (v_wallet.id, 'debit', p_entry_type, p_amount, v_wallet.available_balance - p_amount, p_reference_type, p_reference_id);
END;
$$;
