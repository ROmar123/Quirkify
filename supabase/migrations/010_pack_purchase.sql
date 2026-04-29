-- Migration 010: Pack purchase checkout
-- Adds a Postgres RPC that creates a pack order, reserves pack slots,
-- and (on payment confirmation) reveals items drawn from pack_products
-- using the pack's rarity probability weights.

-- ── create_pack_checkout_order ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_pack_checkout_order(
  p_profile_id          UUID,
  p_customer_email      TEXT,
  p_customer_name       TEXT,
  p_customer_phone      TEXT,
  p_shipping_address    TEXT,
  p_shipping_city       TEXT,
  p_shipping_zip        TEXT,
  p_shipping_cost       NUMERIC,
  p_pack_id             UUID,
  p_quantity            INTEGER DEFAULT 1
)
RETURNS TABLE (
  order_id               UUID,
  order_number           TEXT,
  total                  NUMERIC,
  item_name              TEXT,
  reservation_expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order  public.orders%ROWTYPE;
  v_pack   public.packs%ROWTYPE;
  v_qty    INTEGER;
BEGIN
  v_qty := GREATEST(1, COALESCE(p_quantity, 1));

  -- Lock and validate pack
  SELECT * INTO v_pack FROM public.packs WHERE id = p_pack_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pack % not found', p_pack_id;
  END IF;
  IF v_pack.status <> 'available' THEN
    RAISE EXCEPTION 'Pack is not available for purchase (status: %)', v_pack.status;
  END IF;
  IF (v_pack.total_packs - v_pack.packs_sold) < v_qty THEN
    RAISE EXCEPTION 'Not enough packs remaining (% available, % requested)',
      (v_pack.total_packs - v_pack.packs_sold), v_qty;
  END IF;

  -- Create order
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
    source_ref,
    reservation_expires_at
  )
  VALUES (
    p_profile_id,
    p_customer_email,
    COALESCE(NULLIF(p_customer_name, ''), p_customer_email),
    NULLIF(p_customer_phone, ''),
    'pack',
    v_pack.price * v_qty,
    0,
    COALESCE(p_shipping_cost, 0),
    'yoco',
    'initiated',
    'yoco',
    'pending',
    NULLIF(p_shipping_address, ''),
    NULLIF(p_shipping_city, ''),
    NULLIF(p_shipping_zip, ''),
    p_pack_id::TEXT,
    now() + interval '30 minutes'
  )
  RETURNING * INTO v_order;

  -- Add line item (product_id NULL — contents revealed after payment)
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
    NULL,
    v_pack.name,
    v_pack.image_url,
    v_pack.price,
    v_qty
  );

  -- Reserve pack slots
  UPDATE public.packs
  SET packs_sold = packs_sold + v_qty
  WHERE id = p_pack_id;

  PERFORM public.log_order_event(
    v_order.id,
    'checkout_created',
    NULL,
    v_order.status,
    'Pack checkout created and slots reserved',
    jsonb_build_object('pack_id', p_pack_id, 'quantity', v_qty)
  );

  RETURN QUERY
  SELECT
    v_order.id,
    v_order.order_number,
    v_order.total,
    v_pack.name,
    v_order.reservation_expires_at;
END;
$$;

-- ── reveal_pack_items ─────────────────────────────────────────────────────────
-- Called by the webhook after payment.confirmed for a pack order.
-- Draws p_quantity items from pack_products using weighted rarity selection,
-- updates the order_items.pack_contents, and adds items to collection_items.

CREATE OR REPLACE FUNCTION public.reveal_pack_items(
  p_order_id  UUID,
  p_pack_id   UUID,
  p_quantity  INTEGER DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pack         public.packs%ROWTYPE;
  v_products     JSONB;
  v_roll         INTEGER;
  v_rarity       TEXT;
  v_picked_ids   UUID[] := '{}';
  v_pick         UUID;
  v_order        public.orders%ROWTYPE;
  v_i            INTEGER;
  v_result       JSONB;
BEGIN
  SELECT * INTO v_pack FROM public.packs WHERE id = p_pack_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'pack_not_found');
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'order_not_found');
  END IF;

  -- Build list of available products per rarity
  SELECT jsonb_object_agg(r.rarity, r.ids) INTO v_products
  FROM (
    SELECT p.rarity::TEXT AS rarity, array_agg(pp.product_id) AS ids
    FROM public.pack_products pp
    JOIN public.products p ON p.id = pp.product_id
    WHERE pp.pack_id = p_pack_id
      AND p.status = 'approved'
      AND p.stock > 0
    GROUP BY p.rarity
  ) r;

  -- Pick items using rarity weights
  v_picked_ids := '{}';
  FOR v_i IN 1..GREATEST(1, p_quantity) LOOP
    v_roll := floor(random() * 100)::INTEGER;

    IF v_roll < v_pack.prob_unique
      AND (v_products->>'Unique') IS NOT NULL
      AND jsonb_array_length(v_products->'Unique') > 0
    THEN
      v_rarity := 'Unique';
    ELSIF v_roll < (v_pack.prob_unique + v_pack.prob_super_rare)
      AND (v_products->>'Super Rare') IS NOT NULL
      AND jsonb_array_length(v_products->'Super Rare') > 0
    THEN
      v_rarity := 'Super Rare';
    ELSIF v_roll < (v_pack.prob_unique + v_pack.prob_super_rare + v_pack.prob_rare)
      AND (v_products->>'Rare') IS NOT NULL
      AND jsonb_array_length(v_products->'Rare') > 0
    THEN
      v_rarity := 'Rare';
    ELSIF v_roll < (v_pack.prob_unique + v_pack.prob_super_rare + v_pack.prob_rare + v_pack.prob_limited)
      AND (v_products->>'Limited') IS NOT NULL
      AND jsonb_array_length(v_products->'Limited') > 0
    THEN
      v_rarity := 'Limited';
    ELSE
      v_rarity := 'Common';
    END IF;

    -- Fallback: pick from any rarity that has products
    IF (v_products->>v_rarity) IS NULL OR jsonb_array_length(v_products->v_rarity) = 0 THEN
      SELECT key INTO v_rarity FROM jsonb_each(v_products)
        WHERE jsonb_array_length(value) > 0 LIMIT 1;
    END IF;

    IF v_rarity IS NOT NULL THEN
      -- Pick a random product of that rarity
      SELECT (v_products->v_rarity->>floor(random() * jsonb_array_length(v_products->v_rarity))::INTEGER)::UUID
        INTO v_pick;
      IF v_pick IS NOT NULL THEN
        v_picked_ids := v_picked_ids || v_pick;
      END IF;
    END IF;
  END LOOP;

  -- Update order_items with revealed contents
  UPDATE public.order_items
  SET pack_contents = to_jsonb(v_picked_ids)
  WHERE order_id = p_order_id;

  -- Add to collection_items if buyer has a profile
  IF v_order.profile_id IS NOT NULL AND array_length(v_picked_ids, 1) > 0 THEN
    INSERT INTO public.collection_items (profile_id, product_id, acquired_at, purchase_price)
    SELECT
      v_order.profile_id,
      unnest(v_picked_ids),
      now(),
      v_pack.price / GREATEST(1, array_length(v_picked_ids, 1))
    ON CONFLICT DO NOTHING;
  END IF;

  v_result := jsonb_build_object(
    'pack_id', p_pack_id,
    'order_id', p_order_id,
    'items_revealed', array_length(v_picked_ids, 1),
    'product_ids', to_jsonb(v_picked_ids)
  );

  PERFORM public.log_order_event(
    p_order_id,
    'pack_revealed',
    v_order.status,
    v_order.status,
    'Pack contents revealed',
    v_result
  );

  RETURN v_result;
END;
$$;

-- ── restore_pack_slots_on_cancel ──────────────────────────────────────────────
-- Called by cancel/expire flow to give back reserved pack slots.

CREATE OR REPLACE FUNCTION public.restore_pack_slots_on_cancel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_qty INTEGER;
BEGIN
  IF NEW.status IN ('cancelled', 'payment_failed')
    AND OLD.status = 'pending'
    AND NEW.channel = 'pack'
    AND NEW.source_ref IS NOT NULL
  THEN
    SELECT COALESCE(SUM(quantity), 0) INTO v_qty
    FROM public.order_items
    WHERE order_id = NEW.id;

    IF v_qty > 0 THEN
      UPDATE public.packs
      SET packs_sold = GREATEST(0, packs_sold - v_qty)
      WHERE id = NEW.source_ref::UUID;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_restore_pack_slots ON public.orders;
CREATE TRIGGER orders_restore_pack_slots
  AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.restore_pack_slots_on_cancel();
