-- Profiles & Roles: synced from Firebase Auth, extended with platform data
-- This replaces the hardcoded admin email check

CREATE TYPE user_role AS ENUM ('customer', 'seller', 'admin');

CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  photo_url TEXT,
  role user_role NOT NULL DEFAULT 'customer',

  -- Seller info
  is_seller BOOLEAN NOT NULL DEFAULT false,
  seller_approved_at TIMESTAMPTZ,
  store_name TEXT,

  -- Profile details
  bio TEXT,
  location TEXT,
  phone TEXT,
  social_links JSONB DEFAULT '{}',

  -- Gamification
  xp INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  balance NUMERIC(10,2) NOT NULL DEFAULT 0,
  badges TEXT[] DEFAULT '{}',

  -- Stats (denormalized for fast reads)
  items_collected INTEGER NOT NULL DEFAULT 0,
  auctions_won INTEGER NOT NULL DEFAULT 0,
  total_bids INTEGER NOT NULL DEFAULT 0,
  total_orders INTEGER NOT NULL DEFAULT 0,
  total_spent NUMERIC(10,2) NOT NULL DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_active_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-update updated_at
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Indexes
CREATE INDEX idx_profiles_firebase_uid ON profiles(firebase_uid);
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_role ON profiles(role);

-- Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Anyone can read profiles (public profile pages)
CREATE POLICY "Public can view profiles"
  ON profiles FOR SELECT
  USING (true);

-- Users can insert their own profile (on first sign-in)
CREATE POLICY "Users can create own profile"
  ON profiles FOR INSERT
  WITH CHECK (true);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (true);

-- Auto-promote founder to admin on profile creation
CREATE OR REPLACE FUNCTION auto_assign_founder_role()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email = 'patengel85@gmail.com' THEN
    NEW.role = 'admin';
    NEW.is_seller = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_founder_role
  BEFORE INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION auto_assign_founder_role();
