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
