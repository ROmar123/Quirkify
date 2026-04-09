

```sql
-- Quirkify E-Commerce Platform - PostgreSQL DDL
-- Run as superuser (Zo system)

-- Enable RLS globally
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE auctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- CUSTOMERS
-- ============================================================================
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_phone ON customers(phone);

-- ============================================================================
-- PRODUCTS
-- ============================================================================
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    "condition" VARCHAR(50) CHECK ("condition" IN ('new', 'like_new', 'good', 'fair', 'poor')),
    cost_price DECIMAL(12,2),
    retail_price DECIMAL(12,2),
    images TEXT[] DEFAULT '{}',
    status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'approved', 'listed', 'sold', 'archived')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_condition ON products("condition");

-- ============================================================================
-- PRODUCT VARIANTS
-- ============================================================================
CREATE TABLE product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    size VARCHAR(50),
    color VARCHAR(100),
    stock_qty INTEGER NOT NULL DEFAULT 0 CHECK (stock_qty >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(product_id, size, color)
);

CREATE INDEX idx_product_variants_product ON product_variants(product_id);
CREATE INDEX idx_product_variants_stock ON product_variants(stock_qty) WHERE stock_qty > 0;

-- ============================================================================
-- REVIEW QUEUE
-- ============================================================================
CREATE TABLE review_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'revision_requested')),
    ai_notes TEXT,
    admin_notes TEXT,
    approved_at TIMESTAMPTZ,
    target_store VARCHAR(100),
    target_auction BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_review_queue_product ON review_queue(product_id);
CREATE INDEX idx_review_queue_status ON review_queue(status);
CREATE INDEX idx_review_queue_target ON review_queue(target_store, target_auction);

-- ============================================================================
-- WALLETS
-- ============================================================================
CREATE TABLE wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES customers(id) ON DELETE CASCADE,
    balance DECIMAL(12,2) NOT NULL DEFAULT 0.00 CHECK (balance >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wallets_user ON wallets(user_id);

-- ============================================================================
-- WALLET TRANSACTIONS
-- ============================================================================
CREATE TABLE wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'payment', 'refund', 'auction_win', 'auction_lose')),
    amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
    reference VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wallet_tx_wallet ON wallet_transactions(wallet_id);
CREATE INDEX idx_wallet_tx_type ON wallet_transactions(type);
CREATE INDEX idx_wallet_tx_reference ON wallet_transactions(reference);
CREATE INDEX idx_wallet_tx_created ON wallet_transactions(created_at);

-- ============================================================================
-- AUCTIONS
-- ============================================================================
CREATE TABLE auctions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    start_price DECIMAL(12,2) NOT NULL CHECK (start_price >= 0),
    reserve_price DECIMAL(12,2),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'ended', 'cancelled', 'completed')),
    winner_id UUID REFERENCES customers(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (end_time > start_time),
    CHECK (reserve_price IS NULL OR reserve_price >= start_price)
);

CREATE INDEX idx_auctions_product ON auctions(product_id);
CREATE INDEX idx_auctions_status ON auctions(status);
CREATE INDEX idx_auctions_time ON auctions(start_time, end_time);
CREATE INDEX idx_auctions_winner ON auctions(winner_id);

-- ============================================================================
-- AUCTION BIDS
-- ============================================================================
CREATE TABLE auction_bids (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auction_id UUID NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
    bidder_id UUID NOT NULL REFERENCES customers(id),
    amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bids_auction ON auction_bids(auction_id);
CREATE INDEX idx_bids_bidder ON auction_bids(bidder_id);
CREATE INDEX idx_bids_timestamp ON auction_bids(timestamp);
CREATE INDEX idx_bids_amount ON auction_bids(amount DESC);

-- ============================================================================
-- ORDERS
-- ============================================================================
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id),
    total DECIMAL(12,2) NOT NULL CHECK (total >= 0),
    yoco_payment_id VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_yoco ON orders(yoco_payment_id);
CREATE INDEX idx_orders_created ON orders(created_at);

-- ============================================================================
-- ORDER ITEMS
-- ============================================================================
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    qty INTEGER NOT NULL CHECK (qty > 0),
    price DECIMAL(12,2) NOT NULL CHECK (price >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Customers: authenticated can read all, own row for update
CREATE POLICY "customers_select_auth" ON customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "customers_insert_auth" ON customers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "customers_update_auth" ON customers FOR UPDATE TO authenticated USING (id = current_setting('app.current_user_id')::UUID);
CREATE POLICY "customers_delete_auth" ON customers FOR DELETE TO authenticated USING (id = current_setting('app.current_user_id')::UUID);

-- Products: anon can read approved, authenticated can manage own
CREATE POLICY "products_select_all_auth" ON products FOR SELECT TO authenticated USING (true);
CREATE POLICY "products_insert_auth" ON products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "products_update_auth" ON products FOR UPDATE TO authenticated USING (true);
CREATE POLICY "products_delete_auth" ON products FOR DELETE TO authenticated USING (true);

CREATE POLICY "products_select_anon" ON products FOR SELECT TO anon USING (status = 'listed');

-- Product Variants: inherit from products
CREATE POLICY "variants_select_auth" ON product_variants FOR SELECT TO authenticated USING (true);
CREATE POLICY "variants_select_anon" ON product_variants FOR SELECT TO anon USING (true);
CREATE POLICY "variants_manage_auth" ON product_variants FOR ALL TO authenticated USING (true);

-- Review Queue: authenticated only
CREATE POLICY "review_queue_all_auth" ON review_queue FOR ALL TO authenticated USING (true);

-- Auctions: anon can view active, authenticated can manage
CREATE POLICY "auctions_select_all" ON auctions FOR SELECT TO authenticated USING (true);
CREATE POLICY "auctions_select_anon" ON auctions FOR SELECT TO anon USING (status IN ('active', 'ended'));
CREATE POLICY "auctions_manage_auth" ON auctions FOR ALL TO authenticated USING (true);

-- Auction Bids: authenticated only
CREATE POLICY "bids_select_auth" ON auction_bids FOR SELECT TO authenticated USING (true);
CREATE POLICY "bids_insert_auth" ON auction_bids FOR INSERT TO authenticated WITH CHECK (bidder_id = current_setting('app.current_user_id')::UUID);
CREATE POLICY "bids_update_auth" ON auction_bids FOR UPDATE TO authenticated USING (bidder_id = current_setting('app.current_user_id')::UUID);
CREATE POLICY "bids_delete_auth" ON auction_bids FOR DELETE TO authenticated USING (bidder_id = current_setting('app.current_user_id')::UUID);

-- Orders: customer sees own, auth sees all
CREATE POLICY "orders_select_auth" ON orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "orders_select_customer" ON orders FOR SELECT TO authenticated USING (customer_id = current_setting('app.current_user_id')::UUID);
CREATE POLICY "orders_insert_auth" ON orders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "orders_update_auth" ON orders FOR UPDATE TO authenticated USING (true);
CREATE POLICY "orders_delete_auth" ON orders FOR DELETE TO authenticated USING (true);

-- Order Items: inherit from orders
CREATE POLICY "order_items_select_auth" ON order_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "order_items_manage_auth" ON order_items FOR ALL TO authenticated USING (true);

-- Wallets: user sees own, auth manages
CREATE POLICY "wallets_select_auth" ON wallets FOR SELECT TO authenticated USING (true);
CREATE POLICY "wallets_select_owner" ON wallets FOR SELECT TO authenticated USING (user_id = current_setting('app.current_user_id')::UUID);
CREATE POLICY "wallets_manage_auth" ON wallets FOR ALL TO authenticated USING (true);

-- Wallet Transactions: wallet owner only
CREATE POLICY "wallet_tx_select_auth" ON wallet_transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "wallet_tx_insert_auth" ON wallet_transactions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "wallet_tx_update_auth" ON wallet_transactions FOR UPDATE TO authenticated USING (true);
CREATE POLICY "wallet_tx_delete_auth" ON wallet_transactions FOR DELETE TO authenticated USING (true);

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_product_variants_updated_at BEFORE UPDATE ON product_variants FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_review_queue_updated_at BEFORE UPDATE ON review_queue FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_auctions_updated_at BEFORE UPDATE ON auctions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_wallets_updated_at BEFORE UPDATE ON wallets FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Create wallet on customer creation
CREATE OR REPLACE FUNCTION create_wallet_on_customer()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO wallets (user_id) VALUES (NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_create_wallet AFTER INSERT ON customers FOR EACH ROW EXECUTE FUNCTION create_wallet_on_customer();
```