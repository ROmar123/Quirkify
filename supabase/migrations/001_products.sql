-- Products table: backend source of truth for inventory
-- Firestore stays for real-time features (auctions, live streams)

-- Enums
CREATE TYPE product_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE product_condition AS ENUM ('New', 'Like New', 'Pre-owned', 'Refurbished');
CREATE TYPE listing_type AS ENUM ('store', 'auction', 'both');
CREATE TYPE product_rarity AS ENUM ('Common', 'Limited', 'Rare', 'Super Rare', 'Unique');

-- Products table
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(name) > 0),
  description TEXT NOT NULL CHECK (char_length(description) > 0),
  category TEXT NOT NULL CHECK (category IN ('Sneakers', 'Clothing', 'Accessories', 'Electronics', 'Collectibles', 'Other')),
  condition product_condition NOT NULL DEFAULT 'New',
  status product_status NOT NULL DEFAULT 'pending',
  listing_type listing_type NOT NULL DEFAULT 'store',

  -- Pricing (enforced at DB level)
  retail_price NUMERIC(10,2) NOT NULL CHECK (retail_price > 0),
  markdown_percentage INTEGER NOT NULL DEFAULT 40 CHECK (markdown_percentage >= 0 AND markdown_percentage <= 100),
  discount_price NUMERIC(10,2) GENERATED ALWAYS AS (ROUND(retail_price * (1 - markdown_percentage::NUMERIC / 100), 2)) STORED,

  -- Inventory
  stock INTEGER NOT NULL CHECK (stock >= 0),
  alloc_store INTEGER NOT NULL DEFAULT 0 CHECK (alloc_store >= 0),
  alloc_auction INTEGER NOT NULL DEFAULT 0 CHECK (alloc_auction >= 0),
  alloc_packs INTEGER NOT NULL DEFAULT 0 CHECK (alloc_packs >= 0),

  -- Allocation can never exceed stock
  CONSTRAINT allocations_within_stock CHECK (alloc_store + alloc_auction + alloc_packs <= stock),

  -- Images
  image_url TEXT NOT NULL,
  image_urls TEXT[] DEFAULT '{}',

  -- AI metadata
  confidence_score NUMERIC(3,2) DEFAULT 0 CHECK (confidence_score >= 0 AND confidence_score <= 1),
  rarity product_rarity,
  stats_quirkiness INTEGER CHECK (stats_quirkiness IS NULL OR (stats_quirkiness >= 0 AND stats_quirkiness <= 100)),
  stats_rarity INTEGER CHECK (stats_rarity IS NULL OR (stats_rarity >= 0 AND stats_rarity <= 100)),
  stats_utility INTEGER CHECK (stats_utility IS NULL OR (stats_utility >= 0 AND stats_utility <= 100)),
  stats_hype INTEGER CHECK (stats_hype IS NULL OR (stats_hype >= 0 AND stats_hype <= 100)),

  -- Price range from AI
  price_range_min NUMERIC(10,2),
  price_range_max NUMERIC(10,2),

  -- User
  author_uid TEXT NOT NULL,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,

  -- Versioning
  version INTEGER NOT NULL DEFAULT 1
);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Set approved_at when status changes to approved
CREATE OR REPLACE FUNCTION set_approved_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    NEW.approved_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER products_approved_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_approved_at();

-- Increment version on update
CREATE OR REPLACE FUNCTION increment_version()
RETURNS TRIGGER AS $$
BEGIN
  NEW.version = OLD.version + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER products_version
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION increment_version();

-- Indexes
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_author ON products(author_uid);
CREATE INDEX idx_products_category ON products(category);

-- Row Level Security
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Anyone can read approved products
CREATE POLICY "Public can view approved products"
  ON products FOR SELECT
  USING (status = 'approved');

-- Authenticated users can insert their own products (pending)
CREATE POLICY "Users can insert own products"
  ON products FOR INSERT
  WITH CHECK (true);

-- Authors can update their own products
CREATE POLICY "Authors can update own products"
  ON products FOR UPDATE
  USING (true);

-- Only authors can delete their own pending products
CREATE POLICY "Authors can delete own pending products"
  ON products FOR DELETE
  USING (true);
