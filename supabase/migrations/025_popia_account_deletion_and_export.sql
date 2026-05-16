-- Migration 025: POPIA Right to Erasure + Right to Data Portability.
--
-- POPIA s.24 (right to access personal information) and s.25 (right to
-- correction/deletion) require us to give users a way to export their data
-- and to erase identifying information. Orders must be retained for tax
-- (SARS keeps the receipt for 5 years), so we anonymize rather than hard
-- delete those — strip PII columns but keep the transactional record.
--
-- This migration:
--  1. Loosens profile NOT NULL constraints on `email` and `firebase_uid`
--     so tombstoned profiles can null them out without losing the row.
--  2. Adds `profiles.deleted_at` to mark anonymized accounts.
--  3. Creates `anonymize_profile` — the deletion RPC with pre-flight
--     checks (no wallet balance, no holds, no pending withdrawals).
--  4. Creates `export_profile_data` — returns the user's data as one
--     JSONB blob so the API can stream it as a download.

-- 1. Profile tombstone column
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE profiles ALTER COLUMN email DROP NOT NULL;
ALTER TABLE profiles ALTER COLUMN firebase_uid DROP NOT NULL;

-- Partial unique constraints — ensure we don't reuse identifiers, but
-- allow many tombstoned profiles to share NULL.
DROP INDEX IF EXISTS profiles_email_unique_active;
DROP INDEX IF EXISTS profiles_firebase_uid_unique_active;
CREATE UNIQUE INDEX profiles_email_unique_active
  ON profiles (email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX profiles_firebase_uid_unique_active
  ON profiles (firebase_uid) WHERE firebase_uid IS NOT NULL;

-- 2. anonymize_profile — POPIA Right to Erasure
CREATE OR REPLACE FUNCTION anonymize_profile(p_profile_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_actor uuid := auth_profile_id();
  v_is_self boolean := (v_actor = p_profile_id);
  v_is_admin boolean := auth_is_admin();
  v_available numeric;
  v_held numeric;
  v_pending_withdrawals int;
  v_fb_uid text;
BEGIN
  -- Authorization: the user themselves, or an admin acting on their behalf.
  IF v_actor IS NULL OR (NOT v_is_self AND NOT v_is_admin) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  -- Already tombstoned? Idempotent return.
  IF EXISTS (SELECT 1 FROM profiles WHERE id = p_profile_id AND deleted_at IS NOT NULL) THEN
    RETURN jsonb_build_object('status', 'already_deleted', 'profile_id', p_profile_id);
  END IF;

  SELECT firebase_uid INTO v_fb_uid FROM profiles WHERE id = p_profile_id;
  IF v_fb_uid IS NULL THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  -- Pre-flight: refuse deletion while there's money or open commitments.
  SELECT COALESCE(available_balance, 0), COALESCE(held_balance, 0)
    INTO v_available, v_held
  FROM wallet_accounts WHERE profile_id = p_profile_id;

  IF v_available > 0 THEN
    RAISE EXCEPTION 'WALLET_NOT_EMPTY: available balance R% — withdraw or spend before deletion', v_available
      USING ERRCODE = 'P0001';
  END IF;
  IF v_held > 0 THEN
    RAISE EXCEPTION 'WALLET_HAS_HOLDS: R% held by active auctions — wait for them to settle', v_held
      USING ERRCODE = 'P0001';
  END IF;

  SELECT COUNT(*) INTO v_pending_withdrawals
  FROM withdrawal_requests
  WHERE profile_id = p_profile_id AND status IN ('pending', 'approved');
  IF v_pending_withdrawals > 0 THEN
    RAISE EXCEPTION 'PENDING_WITHDRAWALS: % unresolved withdrawal(s) — wait for them to clear', v_pending_withdrawals
      USING ERRCODE = 'P0001';
  END IF;

  -- Anonymize orders (retain for SARS 5-year receipt requirement; strip PII)
  UPDATE orders SET
    customer_email   = NULL,
    customer_name    = 'Deleted user',
    customer_phone   = NULL,
    shipping_address = NULL,
    shipping_city    = NULL,
    shipping_zip     = NULL,
    shipping_country = NULL
  WHERE profile_id = p_profile_id;

  -- Hard-delete personal-only data
  DELETE FROM customer_addresses WHERE profile_id = p_profile_id;
  DELETE FROM collection_items   WHERE profile_id = p_profile_id;
  DELETE FROM notifications      WHERE firebase_uid = v_fb_uid;

  -- Tombstone the profile itself
  UPDATE profiles SET
    email         = NULL,
    firebase_uid  = NULL,
    display_name  = 'Deleted user',
    photo_url     = NULL,
    phone         = NULL,
    bio           = NULL,
    location      = NULL,
    store_name    = NULL,
    social_links  = NULL,
    badges        = NULL,
    deleted_at    = NOW()
  WHERE id = p_profile_id;

  -- Audit entry — the actor may be the user themselves or an admin.
  INSERT INTO audit_logs (actor_id, actor_label, action, entity_type, entity_id, metadata)
  VALUES (
    v_actor, 'Account deletion', 'account.delete', 'profile', p_profile_id::text,
    jsonb_build_object('initiated_by', CASE WHEN v_is_self THEN 'self' ELSE 'admin' END)
  );

  RETURN jsonb_build_object('status', 'deleted', 'profile_id', p_profile_id);
END;
$$;

GRANT EXECUTE ON FUNCTION anonymize_profile(uuid) TO authenticated;

-- 3. export_profile_data — POPIA Right to Data Portability
CREATE OR REPLACE FUNCTION export_profile_data(p_profile_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_actor uuid := auth_profile_id();
BEGIN
  IF v_actor IS NULL OR (v_actor != p_profile_id AND NOT auth_is_admin()) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'exported_at', NOW(),
    'profile_id',  p_profile_id,
    'profile', (
      SELECT to_jsonb(p) FROM profiles p WHERE id = p_profile_id
    ),
    'orders', COALESCE((
      SELECT jsonb_agg(to_jsonb(o)) FROM orders o WHERE o.profile_id = p_profile_id
    ), '[]'::jsonb),
    'order_items', COALESCE((
      SELECT jsonb_agg(to_jsonb(oi))
      FROM order_items oi JOIN orders o ON oi.order_id = o.id
      WHERE o.profile_id = p_profile_id
    ), '[]'::jsonb),
    'customer_addresses', COALESCE((
      SELECT jsonb_agg(to_jsonb(ca)) FROM customer_addresses ca WHERE ca.profile_id = p_profile_id
    ), '[]'::jsonb),
    'collection_items', COALESCE((
      SELECT jsonb_agg(to_jsonb(ci)) FROM collection_items ci WHERE ci.profile_id = p_profile_id
    ), '[]'::jsonb),
    'wallet_account', (
      SELECT to_jsonb(wa) FROM wallet_accounts wa WHERE wa.profile_id = p_profile_id
    ),
    'wallet_ledger', COALESCE((
      SELECT jsonb_agg(to_jsonb(wl))
      FROM wallet_ledger wl
      JOIN wallet_accounts wa ON wl.wallet_account_id = wa.id
      WHERE wa.profile_id = p_profile_id
    ), '[]'::jsonb),
    'withdrawal_requests', COALESCE((
      SELECT jsonb_agg(to_jsonb(wr)) FROM withdrawal_requests wr WHERE wr.profile_id = p_profile_id
    ), '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION export_profile_data(uuid) TO authenticated;
