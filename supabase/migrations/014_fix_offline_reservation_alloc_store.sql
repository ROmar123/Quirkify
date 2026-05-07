-- Fix resolve_offline_reservation: decrement alloc_store on sold_offline
-- Previously only products.stock was decremented, leaving alloc_store inflated.
-- create_store_checkout_order checks alloc_store - reserved_store >= qty,
-- so undeducted alloc_store after an offline sale could allow overselling online.

CREATE OR REPLACE FUNCTION public.resolve_offline_reservation(p_reservation_id uuid, p_new_status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_res offline_reservations%ROWTYPE;
BEGIN
  SELECT * INTO v_res FROM offline_reservations WHERE id = p_reservation_id;
  IF v_res.id IS NULL THEN RAISE EXCEPTION 'Reservation not found'; END IF;
  IF v_res.status != 'reserved' THEN RAISE EXCEPTION 'Reservation already resolved'; END IF;

  UPDATE offline_reservations
    SET status = p_new_status::offline_reservation_status,
        resolved_at = now(), updated_at = now()
    WHERE id = p_reservation_id;

  -- Restore listing stock on release/cancel
  IF p_new_status IN ('released', 'cancelled') AND v_res.listing_id IS NOT NULL THEN
    UPDATE store_listings
      SET quantity_remaining = quantity_remaining + v_res.quantity,
          status = CASE WHEN status = 'sold_out' THEN 'published' ELSE status END,
          updated_at = now()
      WHERE id = v_res.listing_id;
  END IF;

  -- Deduct product stock AND store allocation on offline sale
  IF p_new_status = 'sold_offline' THEN
    UPDATE products
      SET stock       = GREATEST(0, COALESCE(stock, 0)       - v_res.quantity),
          alloc_store = GREATEST(0, COALESCE(alloc_store, 0) - v_res.quantity),
          updated_at  = now()
      WHERE id = v_res.product_id;
  END IF;
END;
$function$;
