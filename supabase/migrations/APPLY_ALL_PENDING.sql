-- ============================================================
-- Migration 009: Notifications + Collection Items
-- Moves notifications and collection tracking from Firestore
-- to Supabase so all non-realtime data lives in one place.
-- Run in: Supabase dashboard → SQL editor
-- ============================================================

-- ── Notifications ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid  text        NOT NULL,  -- Supabase auth UID (same as profiles.firebase_uid)
  title         text        NOT NULL,
  message       text        NOT NULL,
  type          text        NOT NULL DEFAULT 'system',
  read          boolean     NOT NULL DEFAULT false,
  link          text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_firebase_uid_idx
  ON notifications (firebase_uid);

CREATE INDEX IF NOT EXISTS notifications_unread_idx
  ON notifications (firebase_uid, read)
  WHERE read = false;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can read their own notifications
DROP POLICY IF EXISTS "Users read own notifications"   ON notifications;
CREATE POLICY "Users read own notifications"
  ON notifications FOR SELECT
  USING (firebase_uid = auth.uid()::text);

-- Users can mark their own notifications as read / delete them
DROP POLICY IF EXISTS "Users update own notifications" ON notifications;
CREATE POLICY "Users update own notifications"
  ON notifications FOR UPDATE
  USING (firebase_uid = auth.uid()::text);

DROP POLICY IF EXISTS "Users delete own notifications" ON notifications;
CREATE POLICY "Users delete own notifications"
  ON notifications FOR DELETE
  USING (firebase_uid = auth.uid()::text);

-- Service role can insert (from API routes / webhooks)
DROP POLICY IF EXISTS "Service insert notifications"   ON notifications;
CREATE POLICY "Service insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

-- Enable realtime for instant bell-icon updates
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;


-- ── Collection Items ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS collection_items (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id     uuid        NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  product_id     uuid        REFERENCES products (id) ON DELETE SET NULL,
  acquired_at    timestamptz NOT NULL DEFAULT now(),
  purchase_price numeric(10, 2) NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS collection_items_profile_id_idx
  ON collection_items (profile_id);

ALTER TABLE collection_items ENABLE ROW LEVEL SECURITY;

-- Users can read their own collection
DROP POLICY IF EXISTS "Users read own collection"  ON collection_items;
CREATE POLICY "Users read own collection"
  ON collection_items FOR SELECT
  USING (
    profile_id = (
      SELECT id FROM profiles WHERE firebase_uid = auth.uid()::text LIMIT 1
    )
  );

-- Service role can insert (triggered by order payment webhook)
DROP POLICY IF EXISTS "Service insert collection" ON collection_items;
CREATE POLICY "Service insert collection"
  ON collection_items FOR INSERT
  WITH CHECK (true);

-- Enable realtime so vault updates live after purchase
ALTER PUBLICATION supabase_realtime ADD TABLE collection_items;
-- 010_align_product_lifecycle.sql
-- Aligns product_status and product_condition enums to the README spec.
-- Adds source + ai_generated columns for intake tracking.
-- Safe to re-run: uses IF NOT EXISTS / DO $$ guards.

-- ─── product_status: add README lifecycle values ───────────────────────────
DO $$ BEGIN
  ALTER TYPE product_status ADD VALUE IF NOT EXISTS 'draft_review' BEFORE 'pending';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE product_status ADD VALUE IF NOT EXISTS 'reviewed';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE product_status ADD VALUE IF NOT EXISTS 'allocated';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE product_status ADD VALUE IF NOT EXISTS 'live';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE product_status ADD VALUE IF NOT EXISTS 'sold';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE product_status ADD VALUE IF NOT EXISTS 'removed';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE product_status ADD VALUE IF NOT EXISTS 'archived';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Migrate legacy 'pending' records to 'draft_review'
UPDATE products SET status = 'draft_review' WHERE status = 'pending';

-- ─── product_condition: add README condition values ─────────────────────────
DO $$ BEGIN
  ALTER TYPE product_condition ADD VALUE IF NOT EXISTS 'Good';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE product_condition ADD VALUE IF NOT EXISTS 'Fair';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE product_condition ADD VALUE IF NOT EXISTS 'Damaged';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE product_condition ADD VALUE IF NOT EXISTS 'For Parts';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── source / ai_generated columns ─────────────────────────────────────────
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual_intake'
    CHECK (source IN ('ai_intake', 'manual_intake')),
  ADD COLUMN IF NOT EXISTS ai_generated BOOLEAN NOT NULL DEFAULT FALSE;

-- Back-fill: any product with a non-zero confidence_score came from AI intake
UPDATE products
SET source = 'ai_intake', ai_generated = TRUE
WHERE confidence_score > 0;

-- ─── inventory_movements table ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_movements (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  delta        INTEGER NOT NULL,
  reason       TEXT NOT NULL CHECK (reason IN (
                 'intake', 'sale', 'auction_win', 'pack_open',
                 'adjustment', 'return', 'damage', 'archive'
               )),
  reference_id UUID,
  note         TEXT,
  created_by   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inventory_movements_product_idx ON inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS inventory_movements_created_idx ON inventory_movements(created_at DESC);

ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Admins manage inventory movements"
  ON inventory_movements FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );
-- 011_store_listings_and_wallet.sql
-- Core revenue pipeline:
--   store_listings table (steps 9-10 of build order)
--   wallet_record_entry fix (actually updates available_balance)
--   wallet_credit / wallet_purchase RPCs (steps 16-17-19)

-- ─── store_listings ─────────────────────────��─────────────────��─────────────

CREATE TABLE IF NOT EXISTS public.store_listings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id       UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  title            TEXT NOT NULL,
  description      TEXT,
  images           TEXT[] NOT NULL DEFAULT '{}',
  retail_price     NUMERIC(10,2) NOT NULL CHECK (retail_price > 0),
  selling_price    NUMERIC(10,2) NOT NULL CHECK (selling_price > 0),
  discount_percent NUMERIC(5,1) GENERATED ALWAYS AS (
    ROUND(((retail_price - selling_price) / retail_price * 100)::numeric, 1)
  ) STORED,
  quantity_total     INTEGER NOT NULL CHECK (quantity_total > 0),
  quantity_remaining INTEGER NOT NULL CHECK (quantity_remaining >= 0),
  status           TEXT NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','published','paused','sold_out','removed')),
  published_at     TIMESTAMPTZ,
  created_by       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT store_listing_remaining_lte_total CHECK (quantity_remaining <= quantity_total)
);

CREATE INDEX IF NOT EXISTS store_listings_product_idx  ON public.store_listings(product_id);
CREATE INDEX IF NOT EXISTS store_listings_status_idx   ON public.store_listings(status);
CREATE INDEX IF NOT EXISTS store_listings_published_idx
  ON public.store_listings(published_at DESC) WHERE status = 'published';

ALTER TABLE public.store_listings ENABLE ROW LEVEL SECURITY;

-- Customers see published listings only
CREATE POLICY IF NOT EXISTS "Published store listings are public"
  ON public.store_listings FOR SELECT
  USING (status = 'published');

-- Admins manage all
CREATE POLICY IF NOT EXISTS "Admins manage store listings"
  ON public.store_listings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ─── wallet_credit: safely credits a wallet and logs the ledger entry ────────
-- Replaces the broken wallet_record_entry which never updated available_balance.

CREATE OR REPLACE FUNCTION public.wallet_credit(
  p_profile_id     UUID,
  p_amount         NUMERIC,
  p_entry_type     public.wallet_entry_type,
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id   UUID DEFAULT NULL,
  p_metadata       JSONB DEFAULT '{}'::jsonb
)
RETURNS public.wallet_accounts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet public.wallet_accounts%ROWTYPE;
  v_wallet_id UUID;
BEGIN
  v_wallet_id := public.ensure_wallet_account(p_profile_id);

  SELECT * INTO v_wallet
  FROM public.wallet_accounts
  WHERE id = v_wallet_id
  FOR UPDATE;

  UPDATE public.wallet_accounts
  SET available_balance = available_balance + p_amount,
      updated_at = now()
  WHERE id = v_wallet_id
  RETURNING * INTO v_wallet;

  INSERT INTO public.wallet_ledger (
    wallet_account_id, direction, entry_type, amount,
    available_balance_after, held_balance_after,
    reference_type, reference_id, metadata
  ) VALUES (
    v_wallet_id, 'credit', p_entry_type, p_amount,
    v_wallet.available_balance, v_wallet.held_balance,
    p_reference_type, p_reference_id, COALESCE(p_metadata, '{}')
  );

  RETURN v_wallet;
END;
$$;

-- ─── wallet_debit: safely debits a wallet and logs the ledger entry ──────────

CREATE OR REPLACE FUNCTION public.wallet_debit(
  p_profile_id     UUID,
  p_amount         NUMERIC,
  p_entry_type     public.wallet_entry_type,
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id   UUID DEFAULT NULL,
  p_metadata       JSONB DEFAULT '{}'::jsonb
)
RETURNS public.wallet_accounts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet public.wallet_accounts%ROWTYPE;
  v_wallet_id UUID;
BEGIN
  v_wallet_id := public.ensure_wallet_account(p_profile_id);

  SELECT * INTO v_wallet
  FROM public.wallet_accounts
  WHERE id = v_wallet_id
  FOR UPDATE;

  IF v_wallet.available_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient wallet balance. Available: R%.2f, Required: R%.2f',
      v_wallet.available_balance, p_amount;
  END IF;

  UPDATE public.wallet_accounts
  SET available_balance = available_balance - p_amount,
      updated_at = now()
  WHERE id = v_wallet_id
  RETURNING * INTO v_wallet;

  INSERT INTO public.wallet_ledger (
    wallet_account_id, direction, entry_type, amount,
    available_balance_after, held_balance_after,
    reference_type, reference_id, metadata
  ) VALUES (
    v_wallet_id, 'debit', p_entry_type, p_amount,
    v_wallet.available_balance, v_wallet.held_balance,
    p_reference_type, p_reference_id, COALESCE(p_metadata, '{}')
  );

  RETURN v_wallet;
END;
$$;

-- ─── wallet_purchase: atomically buy from wallet ──────────────────────────��──
-- Checks balance, creates paid order, debits wallet, moves stock, updates listing.

CREATE OR REPLACE FUNCTION public.wallet_purchase(
  p_profile_id      UUID,
  p_customer_email  TEXT,
  p_customer_name   TEXT,
  p_shipping_address TEXT DEFAULT NULL,
  p_shipping_city   TEXT DEFAULT NULL,
  p_shipping_zip    TEXT DEFAULT NULL,
  p_shipping_cost   NUMERIC DEFAULT 0,
  p_items           JSONB DEFAULT '[]'::jsonb
  -- items: [{listingId, productId, quantity}]
)
RETURNS TABLE(order_id UUID, order_number TEXT, total NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet        public.wallet_accounts%ROWTYPE;
  v_wallet_id     UUID;
  v_order         public.orders%ROWTYPE;
  v_item          JSONB;
  v_listing       public.store_listings%ROWTYPE;
  v_product       public.products%ROWTYPE;
  v_listing_id    UUID;
  v_product_id    UUID;
  v_quantity      INTEGER;
  v_unit_price    NUMERIC(10,2);
  v_subtotal      NUMERIC(10,2) := 0;
  v_order_total   NUMERIC(10,2);
  v_primary_name  TEXT;
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Wallet purchase requires at least one item';
  END IF;

  -- Lock wallet
  v_wallet_id := public.ensure_wallet_account(p_profile_id);
  SELECT * INTO v_wallet FROM public.wallet_accounts WHERE id = v_wallet_id FOR UPDATE;

  -- First pass: validate all items and compute subtotal
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    v_listing_id := NULLIF(v_item->>'listingId', '')::UUID;
    v_product_id := NULLIF(v_item->>'productId', '')::UUID;
    v_quantity   := COALESCE((v_item->>'quantity')::INTEGER, 0);

    IF v_quantity <= 0 THEN
      RAISE EXCEPTION 'Quantity must be greater than 0';
    END IF;

    IF v_listing_id IS NOT NULL THEN
      SELECT * INTO v_listing FROM public.store_listings
      WHERE id = v_listing_id AND status = 'published' FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Listing % is not available', v_listing_id;
      END IF;
      IF v_listing.quantity_remaining < v_quantity THEN
        RAISE EXCEPTION 'Insufficient stock for listing % (have %, need %)',
          v_listing_id, v_listing.quantity_remaining, v_quantity;
      END IF;
      v_unit_price := v_listing.selling_price;
      IF v_primary_name IS NULL THEN v_primary_name := v_listing.title; END IF;
      v_product_id := v_listing.product_id;
    ELSE
      -- fallback: no listing (direct product purchase, legacy)
      SELECT * INTO v_product FROM public.products WHERE id = v_product_id FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Product % not found', v_product_id;
      END IF;
      v_unit_price := COALESCE(NULLIF(v_product.discount_price, 0), v_product.retail_price);
      IF v_primary_name IS NULL THEN v_primary_name := v_product.name; END IF;
    END IF;

    v_subtotal := v_subtotal + (v_unit_price * v_quantity);
  END LOOP;

  v_order_total := v_subtotal + COALESCE(p_shipping_cost, 0);

  -- Check balance
  IF v_wallet.available_balance < v_order_total THEN
    RAISE EXCEPTION 'Insufficient wallet balance. Available: R%.2f, Required: R%.2f',
      v_wallet.available_balance, v_order_total;
  END IF;

  -- Create order (already paid — wallet purchase is instant)
  INSERT INTO public.orders (
    profile_id, customer_email, customer_name,
    channel, subtotal, discount, shipping_cost,
    payment_method, payment_status, status, paid_at,
    shipping_address, shipping_city, shipping_zip
  ) VALUES (
    p_profile_id, p_customer_email,
    COALESCE(NULLIF(p_customer_name, ''), p_customer_email),
    'store', v_subtotal, 0, COALESCE(p_shipping_cost, 0),
    'wallet', 'paid', 'paid', now(),
    NULLIF(p_shipping_address, ''), NULLIF(p_shipping_city, ''), NULLIF(p_shipping_zip, '')
  ) RETURNING * INTO v_order;

  -- Second pass: insert order items + move stock
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    v_listing_id := NULLIF(v_item->>'listingId', '')::UUID;
    v_product_id := NULLIF(v_item->>'productId', '')::UUID;
    v_quantity   := (v_item->>'quantity')::INTEGER;

    IF v_listing_id IS NOT NULL THEN
      SELECT * INTO v_listing FROM public.store_listings WHERE id = v_listing_id;
      v_unit_price := v_listing.selling_price;
      v_product_id := v_listing.product_id;

      -- Decrement listing quantity
      UPDATE public.store_listings
      SET quantity_remaining = quantity_remaining - v_quantity,
          status = CASE
            WHEN quantity_remaining - v_quantity <= 0 THEN 'sold_out'
            ELSE status
          END,
          updated_at = now()
      WHERE id = v_listing_id;
    ELSE
      SELECT * INTO v_product FROM public.products WHERE id = v_product_id;
      v_unit_price := COALESCE(NULLIF(v_product.discount_price, 0), v_product.retail_price);
    END IF;

    -- Get product info for order_items
    SELECT * INTO v_product FROM public.products WHERE id = v_product_id;

    INSERT INTO public.order_items (
      order_id, product_id, product_name, product_image_url,
      quantity, unit_price, total_price
    ) VALUES (
      v_order.id, v_product_id, v_product.name,
      COALESCE(v_product.image_url, ''),
      v_quantity, v_unit_price, v_unit_price * v_quantity
    );

    -- Move stock from store allocation to sold
    UPDATE public.products
    SET stock       = stock       - v_quantity,
        alloc_store = GREATEST(0, alloc_store - v_quantity),
        updated_at  = now()
    WHERE id = v_product_id
      AND stock >= v_quantity;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Stock movement failed for product %', v_product_id;
    END IF;
  END LOOP;

  -- Debit wallet
  PERFORM public.wallet_debit(
    p_profile_id, v_order_total, 'purchase',
    'order', v_order.id,
    jsonb_build_object('order_number', v_order.order_number)
  );

  -- Log order event
  PERFORM public.log_order_event(
    v_order.id, 'wallet_purchase_completed',
    'pending', 'paid', 'Paid via wallet', '{}'::jsonb
  );

  RETURN QUERY SELECT v_order.id, v_order.order_number, v_order.total;
END;
$$;

-- ─── Helper: publish a store listing ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.publish_store_listing(p_listing_id UUID)
RETURNS public.store_listings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_listing public.store_listings%ROWTYPE;
BEGIN
  UPDATE public.store_listings
  SET status = 'published',
      published_at = COALESCE(published_at, now()),
      updated_at = now()
  WHERE id = p_listing_id
  RETURNING * INTO v_listing;
  IF NOT FOUND THEN RAISE EXCEPTION 'Listing % not found', p_listing_id; END IF;
  RETURN v_listing;
END;
$$;

-- RLS on wallet_accounts: owners can read their own wallet
ALTER TABLE public.wallet_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users view own wallet"
  ON public.wallet_accounts FOR SELECT
  USING (profile_id = auth.uid());

ALTER TABLE public.wallet_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users view own ledger"
  ON public.wallet_ledger FOR SELECT
  USING (
    wallet_account_id IN (
      SELECT id FROM public.wallet_accounts WHERE profile_id = auth.uid()
    )
  );
-- 012_order_lifecycle_and_courier.sql
-- Adds full README order lifecycle statuses and courier_shipments table.

-- ─── Extend order_status enum ────────────────────────────────────────────────

DO $$ BEGIN ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'confirmed';           EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'packed';              EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'courier_booked';      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'ready_for_collection'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'out_for_delivery';    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'awaiting_collection'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'collected';           EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'completed';           EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add fulfilment_method column to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS fulfilment_method TEXT DEFAULT 'delivery'
    CHECK (fulfilment_method IN ('delivery', 'collection'));

-- ─── courier_shipments table ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.courier_shipments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  provider         TEXT NOT NULL DEFAULT 'courier_guy',
  booking_status   TEXT NOT NULL DEFAULT 'pending'
                     CHECK (booking_status IN ('pending','booked','failed','cancelled')),
  tracking_number  TEXT,
  waybill_number   TEXT,
  courier_status   TEXT,
  booked_at        TIMESTAMPTZ,
  delivered_at     TIMESTAMPTZ,
  raw_response     JSONB,
  error_message    TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS courier_shipments_order_idx ON public.courier_shipments(order_id);
ALTER TABLE public.courier_shipments ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Admins manage courier shipments"
  ON public.courier_shipments FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Customers can view their own shipments
CREATE POLICY IF NOT EXISTS "Customers view own shipments"
  ON public.courier_shipments FOR SELECT
  USING (
    order_id IN (
      SELECT o.id FROM public.orders o
      JOIN public.profiles p ON p.id = o.profile_id
      WHERE p.id = auth.uid()
    )
  );

-- ─── Helper: advance order status with event log ─────────────────────────────

CREATE OR REPLACE FUNCTION public.advance_order_status(
  p_order_id      UUID,
  p_new_status    public.order_status,
  p_note          TEXT DEFAULT NULL,
  p_tracking      TEXT DEFAULT NULL,
  p_carrier       TEXT DEFAULT NULL
)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order   public.orders%ROWTYPE;
  v_prev    public.order_status;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order % not found', p_order_id; END IF;

  v_prev := v_order.status;

  UPDATE public.orders
  SET status     = p_new_status,
      updated_at = now(),
      -- persist tracking if provided
      payment_id = CASE WHEN p_tracking IS NOT NULL THEN p_tracking ELSE payment_id END
  WHERE id = p_order_id
  RETURNING * INTO v_order;

  PERFORM public.log_order_event(
    p_order_id, 'status_advanced', v_prev, p_new_status,
    COALESCE(p_note, 'Status updated by admin'),
    jsonb_strip_nulls(jsonb_build_object('tracking', p_tracking, 'carrier', p_carrier))
  );

  RETURN v_order;
END;
$$;
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
