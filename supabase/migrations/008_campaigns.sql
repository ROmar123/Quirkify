-- 008_campaigns.sql
-- Marketing campaigns table — Supabase-backed so active campaigns can be
-- displayed on the storefront in real time and managed via the admin panel.

CREATE TABLE IF NOT EXISTS public.campaigns (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title               TEXT        NOT NULL,
  description         TEXT        NOT NULL,
  strategy            TEXT,
  type                TEXT        NOT NULL DEFAULT 'sale'
                        CHECK (type IN ('sale', 'auction', 'social', 'flash')),
  status              TEXT        NOT NULL DEFAULT 'active'
                        CHECK (status IN ('draft', 'active', 'completed', 'archived')),
  suggested_product_ids UUID[]    DEFAULT '{}',
  discount_percentage INTEGER
                        CHECK (discount_percentage IS NULL
                            OR (discount_percentage >= 0 AND discount_percentage <= 100)),
  starts_at           TIMESTAMPTZ,
  ends_at             TIMESTAMPTZ,
  created_by          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_status  ON public.campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_created ON public.campaigns(created_at DESC);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

-- Storefront: anyone can view active campaigns
CREATE POLICY "Public can view active campaigns"
  ON public.campaigns FOR SELECT
  USING (status = 'active');

-- Admin: authenticated users can see all campaigns
CREATE POLICY "Authenticated users can view all campaigns"
  ON public.campaigns FOR SELECT
  TO authenticated
  USING (true);

-- Admin: create, update campaigns
CREATE POLICY "Authenticated users can create campaigns"
  ON public.campaigns FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update campaigns"
  ON public.campaigns FOR UPDATE
  TO authenticated
  USING (true);

-- Auto-update updated_at on every row change
CREATE OR REPLACE FUNCTION public.campaigns_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS campaigns_updated_at ON public.campaigns;
CREATE TRIGGER campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.campaigns_set_updated_at();

-- Enable realtime
ALTER TABLE IF EXISTS public.campaigns REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.campaigns;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN undefined_table  THEN NULL;
    END;
  END IF;
END $$;
