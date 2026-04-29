CREATE TABLE IF NOT EXISTS public.campaign_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL CHECK (status IN ('draft', 'approved', 'rejected', 'scheduled', 'active')),
  goal TEXT NOT NULL,
  constraints TEXT NOT NULL DEFAULT '',
  authored_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  ai_summary TEXT NOT NULL,
  recommendation JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER campaign_drafts_updated_at
  BEFORE UPDATE ON public.campaign_drafts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.campaign_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Campaign drafts public select" ON public.campaign_drafts;
DROP POLICY IF EXISTS "Campaign drafts public insert" ON public.campaign_drafts;
DROP POLICY IF EXISTS "Campaign drafts public update" ON public.campaign_drafts;
DROP POLICY IF EXISTS "Campaign drafts public delete" ON public.campaign_drafts;

CREATE POLICY "Campaign drafts public select"
  ON public.campaign_drafts FOR SELECT
  USING (true);

CREATE POLICY "Campaign drafts public insert"
  ON public.campaign_drafts FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Campaign drafts public update"
  ON public.campaign_drafts FOR UPDATE
  USING (true);

CREATE POLICY "Campaign drafts public delete"
  ON public.campaign_drafts FOR DELETE
  USING (true);

ALTER TABLE IF EXISTS public.campaign_drafts REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.campaign_drafts;
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END$$;
