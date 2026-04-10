-- Database-truth commerce foundation for Quirkify.
-- This moves checkout, payment, and wallet enforcement into Postgres.
-- Firestore remains the runtime source of truth for auctions and live bidding.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS reserved_store INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reserved_packs INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'products_reserved_nonnegative'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_reserved_nonnegative
      CHECK (
        reserved_store >= 0
        AND reserved_packs >= 0
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'products_reserved_within_allocations'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_reserved_within_allocations
      CHECK (
        reserved_store <= alloc_store
        AND reserved_packs <= alloc_packs
      );
  END IF;
END $$;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS reservation_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS checkout_session_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_provider TEXT;

CREATE TABLE IF NOT EXISTS public.order_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  from_status public.order_status,
  to_status public.order_status,
  note TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_events_order_created
  ON public.order_events(order_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_event_id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'wallet_status'
  ) THEN
    CREATE TYPE public.wallet_status AS ENUM ('active', 'frozen', 'closed');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'wallet_entry_direction'
  ) THEN
    CREATE TYPE public.wallet_entry_direction AS ENUM ('credit', 'debit');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'wallet_entry_type'
  ) THEN
    CREATE TYPE public.wallet_entry_type AS ENUM (
      'topup',
      'withdrawal',
      'order_payment',
      'refund',
      'manual_adjustment'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.wallet_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  currency TEXT NOT NULL DEFAULT 'ZAR',
  available_balance NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (available_balance >= 0),
  held_balance NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (held_balance >= 0),
  status public.wallet_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wallet_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_account_id UUID NOT NULL REFERENCES public.wallet_accounts(id) ON DELETE CASCADE,
  direction public.wallet_entry_direction NOT NULL,
  entry_type public.wallet_entry_type NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  available_balance_after NUMERIC(12,2) NOT NULL,
  held_balance_after NUMERIC(12,2) NOT NULL,
  reference_type TEXT,
  reference_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wallet_ledger_wallet_created
  ON public.wallet_ledger(wallet_account_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.ensure_wallet_account(p_profile_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet_id UUID;
BEGIN
  INSERT INTO public.wallet_accounts (profile_id)
  VALUES (p_profile_id)
  ON CONFLICT (profile_id) DO NOTHING;

  SELECT id
  INTO v_wallet_id
  FROM public.wallet_accounts
  WHERE profile_id = p_profile_id;

  RETURN v_wallet_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_wallet_for_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.ensure_wallet_account(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_create_wallet_account ON public.profiles;
CREATE TRIGGER profiles_create_wallet_account
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.create_wallet_for_profile();

CREATE OR REPLACE FUNCTION public.log_order_event(
  p_order_id UUID,
  p_event_type TEXT,
  p_from_status public.order_status,
  p_to_status public.order_status,
  p_note TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.order_events (
    order_id,
    event_type,
    from_status,
    to_status,
    note,
    metadata
  )
  VALUES (
    p_order_id,
    p_event_type,
    p_from_status,
    p_to_status,
    p_note,
    COALESCE(p_metadata, '{}'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.release_store_reservation(
  p_order_id UUID,
  p_next_status public.order_status,
  p_payment_status TEXT,
  p_note TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_item RECORD;
  v_previous_status public.order_status;
BEGIN
  SELECT *
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % not found', p_order_id;
  END IF;

  IF v_order.status <> 'pending' THEN
    RETURN v_order;
  END IF;

  v_previous_status := v_order.status;

  FOR v_item IN
    SELECT oi.product_id, oi.quantity
    FROM public.order_items oi
    WHERE oi.order_id = p_order_id
      AND oi.product_id IS NOT NULL
  LOOP
    UPDATE public.products
    SET reserved_store = GREATEST(0, reserved_store - v_item.quantity)
    WHERE id = v_item.product_id;
  END LOOP;

  UPDATE public.orders
  SET status = p_next_status,
      payment_status = p_payment_status,
      reservation_expires_at = NULL,
      updated_at = now()
  WHERE id = p_order_id
  RETURNING *
  INTO v_order;

  PERFORM public.log_order_event(
    p_order_id,
    'reservation_released',
    v_previous_status,
    v_order.status,
    p_note,
    p_metadata
  );

  RETURN v_order;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_store_checkout_order(
  p_profile_id UUID,
  p_customer_email TEXT,
  p_customer_name TEXT,
  p_customer_phone TEXT,
  p_shipping_address TEXT,
  p_shipping_city TEXT,
  p_shipping_zip TEXT,
  p_shipping_cost NUMERIC,
  p_items JSONB
)
RETURNS TABLE (
  order_id UUID,
  order_number TEXT,
  total NUMERIC,
  item_name TEXT,
  reservation_expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_product public.products%ROWTYPE;
  v_item JSONB;
  v_product_id UUID;
  v_quantity INTEGER;
  v_unit_price NUMERIC(10,2);
  v_subtotal NUMERIC(10,2) := 0;
  v_primary_item_name TEXT;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Checkout requires at least one item';
  END IF;

  INSERT INTO public.orders (
    profile_id,
    customer_email,
    customer_name,
    customer_phone,
    channel,
    subtotal,
    discount,
    shipping_cost,
    payment_method,
    payment_status,
    payment_provider,
    status,
    shipping_address,
    shipping_city,
    shipping_zip,
    reservation_expires_at
  )
  VALUES (
    p_profile_id,
    p_customer_email,
    COALESCE(NULLIF(p_customer_name, ''), p_customer_email),
    NULLIF(p_customer_phone, ''),
    'store',
    0,
    0,
    COALESCE(p_shipping_cost, 0),
    'yoco',
    'initiated',
    'yoco',
    'pending',
    NULLIF(p_shipping_address, ''),
    NULLIF(p_shipping_city, ''),
    NULLIF(p_shipping_zip, ''),
    now() + interval '30 minutes'
  )
  RETURNING *
  INTO v_order;

  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := NULLIF(v_item->>'productId', '')::UUID;
    v_quantity := COALESCE((v_item->>'quantity')::INTEGER, 0);

    IF v_product_id IS NULL OR v_quantity <= 0 THEN
      RAISE EXCEPTION 'Invalid checkout item payload';
    END IF;

    SELECT *
    INTO v_product
    FROM public.products
    WHERE id = v_product_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product % not found', v_product_id;
    END IF;

    IF v_product.status <> 'approved' THEN
      RAISE EXCEPTION 'Product % is not approved for sale', v_product_id;
    END IF;

    IF (v_product.alloc_store - v_product.reserved_store) < v_quantity THEN
      RAISE EXCEPTION 'Insufficient store allocation for product %', v_product_id;
    END IF;

    v_unit_price := COALESCE(
      NULLIF(v_product.discount_price, 0),
      NULLIF(v_product.price_range_min, 0),
      v_product.retail_price
    );

    IF v_primary_item_name IS NULL THEN
      v_primary_item_name := v_product.name;
    END IF;

    INSERT INTO public.order_items (
      order_id,
      product_id,
      product_name,
      product_image_url,
      unit_price,
      quantity
    )
    VALUES (
      v_order.id,
      v_product.id,
      v_product.name,
      v_product.image_url,
      v_unit_price,
      v_quantity
    );

    UPDATE public.products
    SET reserved_store = reserved_store + v_quantity
    WHERE id = v_product.id;

    v_subtotal := v_subtotal + (v_unit_price * v_quantity);
  END LOOP;

  UPDATE public.orders
  SET subtotal = v_subtotal
  WHERE id = v_order.id
  RETURNING *
  INTO v_order;

  PERFORM public.log_order_event(
    v_order.id,
    'checkout_created',
    NULL,
    v_order.status,
    'Checkout created and stock reserved',
    jsonb_build_object('channel', v_order.channel)
  );

  RETURN QUERY
  SELECT
    v_order.id,
    v_order.order_number,
    v_order.total,
    CASE
      WHEN jsonb_array_length(p_items) = 1 THEN v_primary_item_name
      ELSE 'Quirkify Order ' || v_order.order_number
    END,
    v_order.reservation_expires_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_order_payment_succeeded(
  p_order_id UUID,
  p_payment_id TEXT,
  p_payment_status TEXT,
  p_provider_event_id TEXT,
  p_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_previous_status public.order_status;
  v_item RECORD;
BEGIN
  IF p_provider_event_id IS NOT NULL THEN
    INSERT INTO public.payment_events (
      provider,
      provider_event_id,
      order_id,
      event_type,
      payload
    )
    VALUES (
      'yoco',
      p_provider_event_id,
      p_order_id,
      'payment.completed',
      COALESCE(p_payload, '{}'::jsonb)
    )
    ON CONFLICT (provider, provider_event_id) DO NOTHING;
  END IF;

  SELECT *
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % not found', p_order_id;
  END IF;

  IF v_order.status = 'paid' OR v_order.status = 'processing' THEN
    RETURN v_order;
  END IF;

  IF v_order.status <> 'pending' THEN
    RETURN v_order;
  END IF;

  v_previous_status := v_order.status;

  FOR v_item IN
    SELECT oi.product_id, oi.quantity
    FROM public.order_items oi
    WHERE oi.order_id = p_order_id
      AND oi.product_id IS NOT NULL
  LOOP
    UPDATE public.products
    SET stock = stock - v_item.quantity,
        alloc_store = alloc_store - v_item.quantity,
        reserved_store = GREATEST(0, reserved_store - v_item.quantity)
    WHERE id = v_item.product_id
      AND reserved_store >= v_item.quantity
      AND alloc_store >= v_item.quantity
      AND stock >= v_item.quantity;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Unable to capture reserved stock for product %', v_item.product_id;
    END IF;
  END LOOP;

  UPDATE public.orders
  SET status = 'paid',
      payment_id = COALESCE(NULLIF(p_payment_id, ''), payment_id),
      payment_status = COALESCE(NULLIF(p_payment_status, ''), 'completed'),
      paid_at = COALESCE(paid_at, now()),
      reservation_expires_at = NULL,
      updated_at = now()
  WHERE id = p_order_id
  RETURNING *
  INTO v_order;

  PERFORM public.log_order_event(
    p_order_id,
    'payment_succeeded',
    v_previous_status,
    v_order.status,
    'Payment confirmed by Yoco webhook',
    COALESCE(p_payload, '{}'::jsonb)
  );

  RETURN v_order;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_order_payment_failed(
  p_order_id UUID,
  p_payment_status TEXT,
  p_provider_event_id TEXT,
  p_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
BEGIN
  IF p_provider_event_id IS NOT NULL THEN
    INSERT INTO public.payment_events (
      provider,
      provider_event_id,
      order_id,
      event_type,
      payload
    )
    VALUES (
      'yoco',
      p_provider_event_id,
      p_order_id,
      'payment.failed',
      COALESCE(p_payload, '{}'::jsonb)
    )
    ON CONFLICT (provider, provider_event_id) DO NOTHING;
  END IF;

  v_order := public.release_store_reservation(
    p_order_id,
    'payment_failed',
    COALESCE(NULLIF(p_payment_status, ''), 'failed'),
    'Payment failed',
    COALESCE(p_payload, '{}'::jsonb)
  );

  RETURN v_order;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_pending_order(
  p_order_id UUID,
  p_note TEXT DEFAULT 'Checkout cancelled by customer'
)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.release_store_reservation(
    p_order_id,
    'cancelled',
    'cancelled',
    p_note,
    jsonb_build_object('reason', p_note)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_stale_pending_orders()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_expired_count INTEGER := 0;
BEGIN
  FOR v_order IN
    SELECT id
    FROM public.orders
    WHERE status = 'pending'
      AND reservation_expires_at IS NOT NULL
      AND reservation_expires_at < now()
  LOOP
    PERFORM public.release_store_reservation(
      v_order.id,
      'cancelled',
      'expired',
      'Reservation expired',
      jsonb_build_object('expired', true)
    );
    v_expired_count := v_expired_count + 1;
  END LOOP;

  RETURN v_expired_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.wallet_record_entry(
  p_wallet_account_id UUID,
  p_direction public.wallet_entry_direction,
  p_entry_type public.wallet_entry_type,
  p_amount NUMERIC,
  p_reference_type TEXT,
  p_reference_id UUID,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet public.wallet_accounts%ROWTYPE;
BEGIN
  SELECT *
  INTO v_wallet
  FROM public.wallet_accounts
  WHERE id = p_wallet_account_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet account % not found', p_wallet_account_id;
  END IF;

  INSERT INTO public.wallet_ledger (
    wallet_account_id,
    direction,
    entry_type,
    amount,
    available_balance_after,
    held_balance_after,
    reference_type,
    reference_id,
    metadata
  )
  VALUES (
    p_wallet_account_id,
    p_direction,
    p_entry_type,
    p_amount,
    v_wallet.available_balance,
    v_wallet.held_balance,
    p_reference_type,
    p_reference_id,
    COALESCE(p_metadata, '{}'::jsonb)
  );
END;
$$;

ALTER TABLE IF EXISTS public.wallet_accounts REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.wallet_ledger REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.order_events REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.payment_events REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.wallet_accounts;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN undefined_table THEN NULL;
    END;

    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.wallet_ledger;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN undefined_table THEN NULL;
    END;

    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.order_events;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN undefined_table THEN NULL;
    END;

    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_events;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN undefined_table THEN NULL;
    END;
  END IF;
END $$;
