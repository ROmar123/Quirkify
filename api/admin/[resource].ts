import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

const { Client } = pg;

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ADMIN_EMAILS = new Set(
  (process.env.VITE_ADMIN_EMAILS || 'patengel85@gmail.com')
    .split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
);

const CREATE_CAMPAIGNS_SQL = `
CREATE TABLE IF NOT EXISTS public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL, description TEXT NOT NULL, strategy TEXT,
  type TEXT NOT NULL DEFAULT 'sale' CHECK (type IN ('sale','auction','social','flash')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','completed','archived')),
  suggested_product_ids UUID[] DEFAULT '{}',
  discount_percentage INTEGER CHECK (discount_percentage IS NULL OR (discount_percentage >= 0 AND discount_percentage <= 100)),
  starts_at TIMESTAMPTZ, ends_at TIMESTAMPTZ, created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='campaigns' AND policyname='Public can view active campaigns') THEN
    CREATE POLICY "Public can view active campaigns" ON public.campaigns FOR SELECT USING (status = 'active');
    CREATE POLICY "Authenticated users can view all campaigns" ON public.campaigns FOR SELECT TO authenticated USING (true);
    CREATE POLICY "Authenticated users can create campaigns" ON public.campaigns FOR INSERT TO authenticated WITH CHECK (true);
    CREATE POLICY "Authenticated users can update campaigns" ON public.campaigns FOR UPDATE TO authenticated USING (true);
  END IF;
END $$;
ALTER TABLE IF EXISTS public.campaigns REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.campaigns;
    EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; END;
  END IF;
END $$;`;

const DB_CONFIGS = [
  { connectionString: process.env.SUPABASE_DB_URL || 'postgresql://postgres.mvoigokzsaybwiogjpvr:j7nVcs3PJmRI0oH8@aws-0-eu-central-1.pooler.supabase.com:5432/postgres' },
  { connectionString: 'postgresql://postgres:j7nVcs3PJmRI0oH8@db.mvoigokzsaybwiogjpvr.supabase.co:5432/postgres' },
];

function isTableMissing(err: any): boolean {
  const s = (err?.message || err?.code || '').toString();
  return s.includes('does not exist') || s.includes('42P01') || s.includes('relation');
}

async function tryCreateCampaignsTable(): Promise<boolean> {
  // Try Management API first
  const pat = process.env.SUPABASE_ACCESS_TOKEN;
  if (pat) {
    try {
      const r = await fetch(`https://api.supabase.com/v1/projects/mvoigokzsaybwiogjpvr/database/query`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: CREATE_CAMPAIGNS_SQL }),
      });
      if (r.ok) return true;
    } catch {}
  }
  // Fall back to pg
  for (const cfg of DB_CONFIGS) {
    let client: InstanceType<typeof Client> | null = null;
    try {
      client = new Client({ connectionString: cfg.connectionString, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000 });
      await client.connect();
      await client.query(CREATE_CAMPAIGNS_SQL);
      await client.end();
      return true;
    } catch { try { await client?.end(); } catch {} }
  }
  return false;
}

async function verifyAdmin(token: string): Promise<boolean> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return false;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) return false;
  if (ADMIN_EMAILS.has((user.email || '').toLowerCase())) return true;
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle();
  return profile?.role === 'admin';
}

export default async function handler(req: any, res: any) {
  const resource = req.query.resource as string;
  if (!['products', 'campaigns'].includes(resource)) {
    return res.status(404).json({ error: 'Unknown resource' });
  }

  const token = ((req.headers['authorization'] as string) || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return res.status(401).json({ error: 'Authorization header required' });

  const isAdmin = await verifyAdmin(token).catch(() => false);
  if (!isAdmin) return res.status(403).json({ error: 'Admin access required' });

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return res.status(503).json({ error: 'Server not configured' });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  res.setHeader('Cache-Control', 'no-store');

  // ── PRODUCTS ──────────────────────────────────────────────
  if (resource === 'products') {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    const statusFilter = typeof req.query.status === 'string' ? req.query.status : null;
    let q = admin.from('products').select('*').order('created_at', { ascending: false });
    if (statusFilter) q = q.eq('status', statusFilter);
    const { data, error } = await q;
    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json({ products: data || [] });
  }

  // ── CAMPAIGNS ─────────────────────────────────────────────
  if (resource === 'campaigns') {
    // GET — list
    if (req.method === 'GET') {
      const statusFilter = typeof req.query.status === 'string' ? req.query.status : null;
      let q = admin.from('campaigns').select('*').order('created_at', { ascending: false });
      if (statusFilter) q = q.eq('status', statusFilter);
      const { data, error } = await q;
      if (error) {
        if (isTableMissing(error)) return res.status(200).json({ campaigns: [], tableExists: false });
        return res.status(400).json({ error: error.message });
      }
      return res.status(200).json({ campaigns: data || [], tableExists: true });
    }

    // POST — create (auto-creates table if missing)
    if (req.method === 'POST') {
      const body = req.body || {};
      const payload = {
        title: body.title, description: body.description, strategy: body.strategy ?? null,
        type: body.type ?? 'sale', status: body.status ?? 'active',
        suggested_product_ids: body.suggestedProducts ?? [],
        discount_percentage: body.discountPercentage ?? null,
        created_by: body.createdBy ?? null,
      };
      const { data, error } = await admin.from('campaigns').insert(payload).select().single();
      if (error) {
        if (isTableMissing(error)) {
          const created = await tryCreateCampaignsTable();
          if (!created) return res.status(503).json({ error: 'Campaigns table does not exist.', setupRequired: true });
          const { data: d2, error: e2 } = await admin.from('campaigns').insert(payload).select().single();
          if (e2) return res.status(400).json({ error: e2.message });
          return res.status(201).json({ campaign: d2 });
        }
        return res.status(400).json({ error: error.message });
      }
      return res.status(201).json({ campaign: data });
    }

    // PATCH — update status
    if (req.method === 'PATCH') {
      const id = req.query.id as string;
      if (!id) return res.status(400).json({ error: 'Campaign id required' });
      const { error } = await admin.from('campaigns').update({ status: req.body?.status }).eq('id', id);
      if (error) return res.status(400).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  }
}
