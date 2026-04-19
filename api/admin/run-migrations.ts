import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

const { Client } = pg;

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ADMIN_EMAILS = new Set(
  (process.env.VITE_ADMIN_EMAILS || 'patengel85@gmail.com')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)
);

const DB_CONFIGS = [
  {
    label: 'Pooler session (5432)',
    connectionString:
      process.env.SUPABASE_DB_URL ||
      'postgresql://postgres.mvoigokzsaybwiogjpvr:j7nVcs3PJmRI0oH8@aws-0-eu-central-1.pooler.supabase.com:5432/postgres',
  },
  {
    label: 'Direct DB (5432)',
    connectionString:
      'postgresql://postgres:j7nVcs3PJmRI0oH8@db.mvoigokzsaybwiogjpvr.supabase.co:5432/postgres',
  },
];

const MIGRATION_007 = `
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'products'
      AND policyname = 'Authenticated users can view all products'
  ) THEN
    CREATE POLICY "Authenticated users can view all products"
      ON products FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;
`;

const MIGRATION_008 = `
CREATE TABLE IF NOT EXISTS public.campaigns (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title                 TEXT        NOT NULL,
  description           TEXT        NOT NULL,
  strategy              TEXT,
  type                  TEXT        NOT NULL DEFAULT 'sale'
                          CHECK (type IN ('sale', 'auction', 'social', 'flash')),
  status                TEXT        NOT NULL DEFAULT 'active'
                          CHECK (status IN ('draft', 'active', 'completed', 'archived')),
  suggested_product_ids UUID[]      DEFAULT '{}',
  discount_percentage   INTEGER
                          CHECK (discount_percentage IS NULL
                              OR (discount_percentage >= 0 AND discount_percentage <= 100)),
  starts_at             TIMESTAMPTZ,
  ends_at               TIMESTAMPTZ,
  created_by            TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_status  ON public.campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_created ON public.campaigns(created_at DESC);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='campaigns' AND policyname='Public can view active campaigns') THEN
    CREATE POLICY "Public can view active campaigns" ON public.campaigns FOR SELECT USING (status = 'active');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='campaigns' AND policyname='Authenticated users can view all campaigns') THEN
    CREATE POLICY "Authenticated users can view all campaigns" ON public.campaigns FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='campaigns' AND policyname='Authenticated users can create campaigns') THEN
    CREATE POLICY "Authenticated users can create campaigns" ON public.campaigns FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='campaigns' AND policyname='Authenticated users can update campaigns') THEN
    CREATE POLICY "Authenticated users can update campaigns" ON public.campaigns FOR UPDATE TO authenticated USING (true);
  END IF;
END $$;

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
`;

const MIGRATIONS = [
  { name: '007_fix_rls', sql: MIGRATION_007 },
  { name: '008_campaigns', sql: MIGRATION_008 },
];

async function verifyAdmin(token: string): Promise<{ ok: boolean; reason?: string }> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return { ok: false, reason: 'Server not configured (missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)' };
  }
  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user }, error } = await adminClient.auth.getUser(token);
  if (error || !user) return { ok: false, reason: 'Invalid or expired token' };

  const email = (user.email || '').toLowerCase();
  if (ADMIN_EMAILS.has(email)) return { ok: true };

  const { data: profile } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.role === 'admin') return { ok: true };
  return { ok: false, reason: 'Admin access required' };
}

const PROJECT_REF = 'mvoigokzsaybwiogjpvr';

async function applyViaManagementApi(logs: string[]): Promise<{ success: boolean; results?: any[] }> {
  const pat = process.env.SUPABASE_ACCESS_TOKEN;
  if (!pat) {
    logs.push('SUPABASE_ACCESS_TOKEN not set — skipping Management API');
    return { success: false };
  }
  logs.push('Trying Supabase Management API…');
  const results: { name: string; status: string; error?: string }[] = [];
  for (const m of MIGRATIONS) {
    try {
      const r = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${pat}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: m.sql }),
      });
      if (!r.ok) {
        const body = await r.text();
        throw new Error(`HTTP ${r.status}: ${body}`);
      }
      logs.push(`Applied via Management API: ${m.name}`);
      results.push({ name: m.name, status: 'applied' });
    } catch (e: any) {
      logs.push(`Management API error ${m.name}: ${e.message}`);
      results.push({ name: m.name, status: 'error', error: e.message });
    }
  }
  const allOk = results.every(r => r.status === 'applied');
  return { success: allOk, results };
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = (req.headers['authorization'] as string) || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!token) {
    return res.status(401).json({ error: 'Authorization header required (Bearer <supabase_access_token>)' });
  }

  const auth = await verifyAdmin(token);
  if (!auth.ok) {
    return res.status(auth.reason?.includes('token') ? 401 : 403).json({ error: auth.reason });
  }

  const logs: string[] = [];

  // 1. Try Supabase Management API first (most reliable from Vercel)
  const mgmtResult = await applyViaManagementApi(logs);
  if (mgmtResult.success) {
    return res.status(200).json({ success: true, connection: 'Supabase Management API', results: mgmtResult.results, logs });
  }

  // 2. Fall back to direct pg connections
  for (const config of DB_CONFIGS) {
    logs.push(`\nTrying: ${config.label}`);
    let client: InstanceType<typeof Client> | null = null;
    try {
      client = new Client({
        connectionString: config.connectionString,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 15000,
        statement_timeout: 30000,
      });
      await client.connect();
      logs.push(`Connected via ${config.label}`);

      const results: { name: string; status: string; error?: string }[] = [];
      for (const m of MIGRATIONS) {
        try {
          await client.query(m.sql);
          logs.push(`Applied: ${m.name}`);
          results.push({ name: m.name, status: 'applied' });
        } catch (e: any) {
          logs.push(`Error ${m.name}: ${e.message}`);
          results.push({ name: m.name, status: 'error', error: e.message });
        }
      }

      await client.end();
      return res.status(200).json({ success: true, connection: config.label, results, logs });
    } catch (e: any) {
      logs.push(`${config.label} failed: ${e.message}`);
      try { await client?.end(); } catch {}
    }
  }

  return res.status(500).json({
    success: false,
    error: 'All migration methods failed. Add SUPABASE_ACCESS_TOKEN to Vercel env vars and try again, or apply SQL manually in the Supabase dashboard.',
    logs,
  });
}
