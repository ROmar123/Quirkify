-- 007_fix_rls.sql
-- The existing "Public can view approved products" policy has no TO clause,
-- which means it applies to ALL roles including authenticated users.
-- This blocks admins from seeing pending/rejected products.
-- Fix: add a separate policy granting authenticated users full SELECT access.
-- Supabase evaluates all matching policies with OR logic, so anon users still
-- see only approved products via the existing policy.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'products'
      AND policyname = 'Authenticated users can view all products'
  ) THEN
    CREATE POLICY "Authenticated users can view all products"
      ON products FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
