import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ADMIN_EMAILS = new Set(
  (process.env.VITE_ADMIN_EMAILS || 'patengel85@gmail.com')
    .split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
);

export const SETUP_SQL = `-- Run once in Supabase SQL Editor
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='products' AND policyname='Authenticated users can view all products') THEN
    CREATE POLICY "Authenticated users can view all products" ON products FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  strategy TEXT,
  type TEXT NOT NULL DEFAULT 'sale' CHECK (type IN ('sale','auction','social','flash')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','completed','archived')),
  suggested_product_ids UUID[] DEFAULT '{}',
  discount_percentage INTEGER,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='campaigns' AND policyname='Public can view active campaigns') THEN
    CREATE POLICY "Public can view active campaigns" ON public.campaigns FOR SELECT USING (status = 'active');
    CREATE POLICY "Auth view all campaigns" ON public.campaigns FOR SELECT TO authenticated USING (true);
    CREATE POLICY "Auth create campaigns" ON public.campaigns FOR INSERT TO authenticated WITH CHECK (true);
    CREATE POLICY "Auth update campaigns" ON public.campaigns FOR UPDATE TO authenticated USING (true);
  END IF;
END $$;`;

async function verifyAdmin(token: string): Promise<boolean> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return false;
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return false;
    if (ADMIN_EMAILS.has((user.email || '').toLowerCase())) return true;
    const { data } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle();
    return data?.role === 'admin';
  } catch {
    return false;
  }
}

async function tryCreateCampaignsTable(): Promise<boolean> {
  const pat = process.env.SUPABASE_ACCESS_TOKEN;
  if (!pat) return false;
  try {
    const r = await fetch(
      `https://api.supabase.com/v1/projects/mvoigokzsaybwiogjpvr/database/query`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: SETUP_SQL }),
      }
    );
    return r.ok;
  } catch {
    return false;
  }
}

function isTableMissing(err: any): boolean {
  const msg = `${err?.message ?? ''} ${err?.code ?? ''}`;
  return msg.includes('does not exist') || msg.includes('42P01');
}

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');

  const resource = req.query.resource as string;
  if (!['products', 'campaigns'].includes(resource)) {
    return res.status(404).json({ error: 'Unknown resource' });
  }

  const token = ((req.headers.authorization as string) || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return res.status(401).json({ error: 'Authorization required' });

  const ok = await verifyAdmin(token);
  if (!ok) return res.status(403).json({ error: 'Admin access required' });

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return res.status(503).json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured on server' });
  }

  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ── Products (read-only) ────────────────────────────────────────────────────
  if (resource === 'products') {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    const status = typeof req.query.status === 'string' ? req.query.status : null;
    let q = db.from('products').select('*').order('created_at', { ascending: false });
    if (status) q = q.eq('status', status);
    const { data, error } = await q;
    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json({ products: data ?? [] });
  }

  // ── Campaigns ───────────────────────────────────────────────────────────────
  if (resource === 'campaigns') {
    // GET — list (auto-create table if missing)
    if (req.method === 'GET') {
      const status = typeof req.query.status === 'string' ? req.query.status : null;
      let q = db.from('campaigns').select('*').order('created_at', { ascending: false });
      if (status) q = q.eq('status', status);
      const { data, error } = await q;
      if (error) {
        if (isTableMissing(error)) {
          const created = await tryCreateCampaignsTable();
          if (created) {
            // Table just created — retry query
            let q2 = db.from('campaigns').select('*').order('created_at', { ascending: false });
            if (status) q2 = q2.eq('status', status);
            const { data: d2 } = await q2;
            return res.status(200).json({ campaigns: d2 ?? [], tableExists: true });
          }
          return res.status(200).json({ campaigns: [], tableExists: false, setupSql: SETUP_SQL });
        }
        return res.status(400).json({ error: error.message });
      }
      return res.status(200).json({ campaigns: data ?? [], tableExists: true });
    }

    // POST — create (auto-create table if missing)
    if (req.method === 'POST') {
      const b = req.body ?? {};
      const payload = {
        title: b.title,
        description: b.description,
        strategy: b.strategy ?? null,
        type: b.type ?? 'sale',
        status: b.status ?? 'active',
        suggested_product_ids: b.suggestedProducts ?? [],
        discount_percentage: b.discountPercentage ?? null,
        created_by: b.createdBy ?? null,
      };

      const { data, error } = await db.from('campaigns').insert(payload).select().single();
      if (error) {
        if (isTableMissing(error)) {
          const created = await tryCreateCampaignsTable();
          if (!created) {
            return res.status(503).json({
              error: 'Campaigns table does not exist.',
              setupRequired: true,
              setupSql: SETUP_SQL,
            });
          }
          // Retry after creation
          const { data: d2, error: e2 } = await db.from('campaigns').insert(payload).select().single();
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
      if (!id) return res.status(400).json({ error: 'id required' });
      const { error } = await db.from('campaigns').update({ status: req.body?.status }).eq('id', id);
      if (error) return res.status(400).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  }
}
