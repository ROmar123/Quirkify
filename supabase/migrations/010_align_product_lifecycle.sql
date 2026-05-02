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
