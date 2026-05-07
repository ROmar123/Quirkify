-- store_listings.quantity_remaining was never decremented for Yoco orders.
-- wallet_purchase does it itself. But Yoco orders go pending→paid via trigger,
-- so the trigger is the right place to sync the listing quantity.
-- This trigger fires only on pending→paid transitions (i.e. Yoco/non-wallet orders)
-- so wallet orders are not double-decremented.

CREATE OR REPLACE FUNCTION public.deduct_stock_on_payment()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.status = 'paid' AND OLD.status = 'pending' THEN
    -- Decrement product stock + channel allocation
    UPDATE products p SET
      stock         = p.stock       - oi.quantity,
      alloc_store   = CASE WHEN NEW.channel = 'store'   THEN p.alloc_store   - oi.quantity ELSE p.alloc_store   END,
      alloc_auction = CASE WHEN NEW.channel = 'auction' THEN p.alloc_auction - oi.quantity ELSE p.alloc_auction END,
      alloc_packs   = CASE WHEN NEW.channel = 'pack'    THEN p.alloc_packs   - oi.quantity ELSE p.alloc_packs   END
    FROM order_items oi
    WHERE oi.order_id = NEW.id AND oi.product_id = p.id;

    -- Sync store_listings.quantity_remaining for store-channel orders.
    -- wallet_purchase already decrements this; Yoco orders do not — fix here.
    IF NEW.channel = 'store' THEN
      UPDATE store_listings sl SET
        quantity_remaining = GREATEST(0, sl.quantity_remaining - oi.quantity),
        status = CASE
          WHEN sl.quantity_remaining - oi.quantity <= 0 THEN 'sold_out'
          ELSE sl.status
        END,
        updated_at = now()
      FROM order_items oi
      WHERE oi.order_id = NEW.id
        AND oi.product_id = sl.product_id
        AND sl.status NOT IN ('archived', 'sold_out');
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
