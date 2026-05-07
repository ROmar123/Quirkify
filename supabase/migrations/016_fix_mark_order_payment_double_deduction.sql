-- The orders_deduct_stock AFTER UPDATE trigger already decrements products.stock
-- and alloc_store when an order transitions pending→paid. The RPC was doing the same
-- thing in a manual FOR loop, causing a double-deduction that hit the
-- products_reserved_within_allocations CHECK constraint and rolled back every
-- Yoco payment webhook.
--
-- Fix: RPC now only clears reserved_store (which the trigger does NOT touch).
-- The trigger continues to own stock + alloc deduction.

CREATE OR REPLACE FUNCTION public.mark_order_payment_succeeded(
  p_order_id uuid,
  p_payment_id text,
  p_payment_status text,
  p_provider_event_id text,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order           public.orders%ROWTYPE;
  v_previous_status public.order_status;
  v_item            RECORD;
BEGIN
  IF p_provider_event_id IS NOT NULL THEN
    INSERT INTO public.payment_events (
      provider, provider_event_id, order_id, event_type, payload
    ) VALUES (
      'yoco', p_provider_event_id, p_order_id, 'payment.completed',
      COALESCE(p_payload, '{}'::jsonb)
    )
    ON CONFLICT (provider, provider_event_id) DO NOTHING;
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % not found', p_order_id;
  END IF;

  IF v_order.status IN ('paid', 'processing') THEN
    RETURN v_order;
  END IF;

  IF v_order.status <> 'pending' THEN
    RETURN v_order;
  END IF;

  v_previous_status := v_order.status;

  -- Release the reserved_store held for this pending order.
  -- The orders_deduct_stock trigger (AFTER UPDATE) handles stock + alloc_store.
  FOR v_item IN
    SELECT oi.product_id, oi.quantity
    FROM public.order_items oi
    WHERE oi.order_id = p_order_id AND oi.product_id IS NOT NULL
  LOOP
    UPDATE public.products
    SET reserved_store = GREATEST(0, reserved_store - v_item.quantity)
    WHERE id = v_item.product_id;
  END LOOP;

  UPDATE public.orders
  SET status                 = 'paid',
      payment_id             = COALESCE(NULLIF(p_payment_id, ''), payment_id),
      payment_status         = COALESCE(NULLIF(p_payment_status, ''), 'completed'),
      paid_at                = COALESCE(paid_at, now()),
      reservation_expires_at = NULL,
      updated_at             = now()
  WHERE id = p_order_id
  RETURNING * INTO v_order;

  PERFORM public.log_order_event(
    p_order_id, 'payment_succeeded', v_previous_status, v_order.status,
    'Payment confirmed by Yoco webhook',
    COALESCE(p_payload, '{}'::jsonb)
  );

  RETURN v_order;
END;
$function$;
