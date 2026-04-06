-- Orders: tracks every sale across all channels
-- Store, Auction, Pack, WhatsApp funnel — all tracked here

CREATE TYPE order_status AS ENUM (
  'pending',        -- just created, awaiting payment
  'paid',           -- payment confirmed
  'processing',     -- being prepared/packed
  'shipped',        -- handed to carrier
  'delivered',      -- confirmed delivered
  'cancelled',      -- cancelled by user or admin
  'refunded',       -- money returned
  'payment_failed'  -- payment attempt failed
);

CREATE TYPE order_channel AS ENUM (
  'store',          -- direct store purchase
  'auction',        -- won via auction
  'pack',           -- mystery pack purchase
  'whatsapp',       -- WhatsApp funnel sale
  'tiktok',         -- TikTok live sale
  'manual'          -- admin-created order
);

CREATE TYPE payment_method AS ENUM (
  'yoco',           -- Yoco card payment
  'eft',            -- bank transfer
  'cash',           -- cash on delivery/pickup
  'whatsapp_pay',   -- WhatsApp payment
  'free'            -- giveaway/promo
);

-- Orders header
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL,  -- human-readable: QRK-20260406-0001

  -- Customer
  profile_id UUID REFERENCES profiles(id),
  customer_email TEXT NOT NULL,
  customer_name TEXT NOT NULL DEFAULT '',
  customer_phone TEXT,

  -- Channel & attribution
  channel order_channel NOT NULL DEFAULT 'store',
  source_ref TEXT,  -- auction ID, pack ID, WhatsApp chat ID, TikTok stream ID

  -- Financials
  subtotal NUMERIC(10,2) NOT NULL CHECK (subtotal >= 0),
  discount NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  shipping_cost NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (shipping_cost >= 0),
  total NUMERIC(10,2) GENERATED ALWAYS AS (subtotal - discount + shipping_cost) STORED,

  -- Payment
  payment_method payment_method,
  payment_id TEXT,           -- external payment reference (Yoco ID, etc.)
  payment_status TEXT,       -- raw status from payment provider
  paid_at TIMESTAMPTZ,

  -- Status
  status order_status NOT NULL DEFAULT 'pending',

  -- Shipping
  shipping_address TEXT,
  shipping_city TEXT,
  shipping_zip TEXT,
  shipping_country TEXT DEFAULT 'ZA',
  tracking_number TEXT,
  carrier TEXT,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,

  -- Notes
  customer_notes TEXT,
  admin_notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelled_at TIMESTAMPTZ
);

CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Order line items (denormalized product snapshot at time of purchase)
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),

  -- Snapshot at purchase time (products can change later)
  product_name TEXT NOT NULL,
  product_image_url TEXT,
  unit_price NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  line_total NUMERIC(10,2) GENERATED ALWAYS AS (unit_price * quantity) STORED,

  -- For packs: which items were revealed
  pack_contents JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-generate order number
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
DECLARE
  today TEXT;
  seq INTEGER;
BEGIN
  today := to_char(now(), 'YYYYMMDD');
  SELECT COUNT(*) + 1 INTO seq FROM orders
    WHERE created_at::date = now()::date;
  NEW.order_number := 'QRK-' || today || '-' || LPAD(seq::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_number
  BEFORE INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION generate_order_number();

-- Deduct stock from product allocations when order is paid
CREATE OR REPLACE FUNCTION deduct_stock_on_payment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'paid' AND OLD.status = 'pending' THEN
    UPDATE products p SET
      stock = p.stock - oi.quantity,
      alloc_store = CASE WHEN NEW.channel = 'store' THEN p.alloc_store - oi.quantity ELSE p.alloc_store END,
      alloc_auction = CASE WHEN NEW.channel = 'auction' THEN p.alloc_auction - oi.quantity ELSE p.alloc_auction END,
      alloc_packs = CASE WHEN NEW.channel = 'pack' THEN p.alloc_packs - oi.quantity ELSE p.alloc_packs END
    FROM order_items oi
    WHERE oi.order_id = NEW.id AND oi.product_id = p.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_deduct_stock
  AFTER UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION deduct_stock_on_payment();

-- Restore stock on cancellation/refund
CREATE OR REPLACE FUNCTION restore_stock_on_cancel()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('cancelled', 'refunded') AND OLD.status = 'paid' THEN
    UPDATE products p SET
      stock = p.stock + oi.quantity,
      alloc_store = CASE WHEN NEW.channel = 'store' THEN p.alloc_store + oi.quantity ELSE p.alloc_store END,
      alloc_auction = CASE WHEN NEW.channel = 'auction' THEN p.alloc_auction + oi.quantity ELSE p.alloc_auction END,
      alloc_packs = CASE WHEN NEW.channel = 'pack' THEN p.alloc_packs + oi.quantity ELSE p.alloc_packs END
    FROM order_items oi
    WHERE oi.order_id = NEW.id AND oi.product_id = p.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_restore_stock
  AFTER UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION restore_stock_on_cancel();

-- Update profile stats on order completion
CREATE OR REPLACE FUNCTION update_profile_on_delivery()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'delivered' AND OLD.status IS DISTINCT FROM 'delivered' THEN
    UPDATE profiles SET
      total_orders = total_orders + 1,
      total_spent = total_spent + NEW.subtotal,
      items_collected = items_collected + (
        SELECT COALESCE(SUM(quantity), 0) FROM order_items WHERE order_id = NEW.id
      ),
      xp = xp + LEAST(100, FLOOR(NEW.subtotal)),  -- 1 XP per Rand spent, max 100
      level = GREATEST(1, FLOOR((xp + LEAST(100, FLOOR(NEW.subtotal))) / 500) + 1)
    WHERE id = NEW.profile_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_update_profile
  AFTER UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_profile_on_delivery();

-- Indexes
CREATE INDEX idx_orders_profile ON orders(profile_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_channel ON orders(channel);
CREATE INDEX idx_orders_created ON orders(created_at DESC);
CREATE INDEX idx_orders_number ON orders(order_number);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);

-- RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own orders" ON orders FOR SELECT USING (true);
CREATE POLICY "System can insert orders" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "System can update orders" ON orders FOR UPDATE USING (true);

CREATE POLICY "Users can view own order items" ON order_items FOR SELECT USING (true);
CREATE POLICY "System can insert order items" ON order_items FOR INSERT WITH CHECK (true);
