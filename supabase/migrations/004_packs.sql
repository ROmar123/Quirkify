-- Packs: mystery pack definitions linked to products
-- Packs draw from product allocations (alloc_packs channel)

CREATE TYPE pack_status AS ENUM ('draft', 'available', 'sold_out', 'archived');

CREATE TABLE packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(name) > 0),
  description TEXT NOT NULL DEFAULT '',
  price NUMERIC(10,2) NOT NULL CHECK (price > 0),
  image_url TEXT,

  -- Pack contents config
  item_count INTEGER NOT NULL CHECK (item_count > 0),  -- how many items per pack
  total_packs INTEGER NOT NULL CHECK (total_packs > 0), -- total available
  packs_sold INTEGER NOT NULL DEFAULT 0,
  packs_remaining INTEGER GENERATED ALWAYS AS (total_packs - packs_sold) STORED,

  -- Rarity probabilities (must sum to 100)
  prob_common INTEGER NOT NULL DEFAULT 50 CHECK (prob_common >= 0),
  prob_limited INTEGER NOT NULL DEFAULT 25 CHECK (prob_limited >= 0),
  prob_rare INTEGER NOT NULL DEFAULT 15 CHECK (prob_rare >= 0),
  prob_super_rare INTEGER NOT NULL DEFAULT 8 CHECK (prob_super_rare >= 0),
  prob_unique INTEGER NOT NULL DEFAULT 2 CHECK (prob_unique >= 0),
  CONSTRAINT probs_sum_100 CHECK (prob_common + prob_limited + prob_rare + prob_super_rare + prob_unique = 100),

  status pack_status NOT NULL DEFAULT 'draft',

  -- Creator
  created_by TEXT NOT NULL,  -- firebase_uid of admin who created

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER packs_updated_at
  BEFORE UPDATE ON packs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Which products are in which packs
CREATE TABLE pack_products (
  pack_id UUID NOT NULL REFERENCES packs(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  max_quantity INTEGER NOT NULL DEFAULT 1 CHECK (max_quantity > 0),
  PRIMARY KEY (pack_id, product_id)
);

-- Auto mark sold_out when packs_remaining hits 0
CREATE OR REPLACE FUNCTION auto_soldout_pack()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.packs_sold >= NEW.total_packs AND NEW.status = 'available' THEN
    NEW.status = 'sold_out';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER packs_auto_soldout
  BEFORE UPDATE ON packs
  FOR EACH ROW EXECUTE FUNCTION auto_soldout_pack();

-- Indexes
CREATE INDEX idx_packs_status ON packs(status);
CREATE INDEX idx_pack_products_pack ON pack_products(pack_id);
CREATE INDEX idx_pack_products_product ON pack_products(product_id);

-- RLS
ALTER TABLE packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pack_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view available packs" ON packs FOR SELECT USING (status IN ('available', 'sold_out'));
CREATE POLICY "Admins can manage packs" ON packs FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can update packs" ON packs FOR UPDATE USING (true);

CREATE POLICY "Public can view pack products" ON pack_products FOR SELECT USING (true);
CREATE POLICY "Admins can manage pack products" ON pack_products FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can delete pack products" ON pack_products FOR DELETE USING (true);
