-- Migration 023: Enforce allocation invariants and provide an atomic
-- allocation-update RPC that writes inventory_movements rows for every delta.

-- ── Constraints ────────────────────────────────────────────────────────────

ALTER TABLE products
  ADD CONSTRAINT products_allocations_nonnegative
  CHECK (alloc_store >= 0 AND alloc_auction >= 0 AND alloc_packs >= 0);

ALTER TABLE products
  ADD CONSTRAINT products_allocations_within_stock
  CHECK (COALESCE(alloc_store, 0) + COALESCE(alloc_auction, 0) + COALESCE(alloc_packs, 0)
         <= COALESCE(stock, 0));

-- ── Allocation RPC ─────────────────────────────────────────────────────────
-- Atomically sets the three allocation channels for a product and writes one
-- inventory_movements row per non-zero delta. The CHECK constraints above
-- reject any state that violates the invariants — the caller receives a clean
-- exception. `p_actor` is a free-form string (firebase_uid, profile id, or
-- 'system') stored on the movement rows for audit.
CREATE OR REPLACE FUNCTION set_product_allocations(
  p_product_id uuid,
  p_alloc_store   integer,
  p_alloc_auction integer,
  p_alloc_packs   integer,
  p_reason        text,
  p_actor         text
) RETURNS products LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_before products;
  v_after  products;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_product_id::text));

  SELECT * INTO v_before FROM products WHERE id = p_product_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRODUCT_NOT_FOUND: %', p_product_id;
  END IF;

  UPDATE products
     SET alloc_store   = p_alloc_store,
         alloc_auction = p_alloc_auction,
         alloc_packs   = p_alloc_packs,
         updated_at    = NOW()
   WHERE id = p_product_id
  RETURNING * INTO v_after;

  IF (p_alloc_store - COALESCE(v_before.alloc_store, 0)) <> 0 THEN
    INSERT INTO inventory_movements (product_id, delta, reason, note, created_by)
    VALUES (p_product_id, p_alloc_store - COALESCE(v_before.alloc_store, 0),
            'alloc_store_' || COALESCE(p_reason, 'manual'),
            'store: ' || COALESCE(v_before.alloc_store, 0) || ' → ' || p_alloc_store,
            p_actor);
  END IF;

  IF (p_alloc_auction - COALESCE(v_before.alloc_auction, 0)) <> 0 THEN
    INSERT INTO inventory_movements (product_id, delta, reason, note, created_by)
    VALUES (p_product_id, p_alloc_auction - COALESCE(v_before.alloc_auction, 0),
            'alloc_auction_' || COALESCE(p_reason, 'manual'),
            'auction: ' || COALESCE(v_before.alloc_auction, 0) || ' → ' || p_alloc_auction,
            p_actor);
  END IF;

  IF (p_alloc_packs - COALESCE(v_before.alloc_packs, 0)) <> 0 THEN
    INSERT INTO inventory_movements (product_id, delta, reason, note, created_by)
    VALUES (p_product_id, p_alloc_packs - COALESCE(v_before.alloc_packs, 0),
            'alloc_packs_' || COALESCE(p_reason, 'manual'),
            'packs: ' || COALESCE(v_before.alloc_packs, 0) || ' → ' || p_alloc_packs,
            p_actor);
  END IF;

  RETURN v_after;
END;
$$;

GRANT EXECUTE ON FUNCTION set_product_allocations(uuid, integer, integer, integer, text, text) TO authenticated;
