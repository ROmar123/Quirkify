import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// @supabase/realtime-js checks for WebSocket in the RealtimeClient constructor.
// Polyfill before any createClient() call so the function never crashes on cold-start.
if (typeof (globalThis as any).WebSocket === 'undefined') {
  (globalThis as any).WebSocket = class {};
}

const _rawAdminUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
const SUPABASE_URL = /^https:\/\/[a-z0-9]+\.supabase\.co/.test(_rawAdminUrl)
  ? _rawAdminUrl
  : 'https://mvoigokzsaybwiogjpvr.supabase.co';
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
  const projectRef = process.env.SUPABASE_PROJECT_REF;
  if (!pat || !projectRef) return false;
  try {
    const r = await fetch(
      `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
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

async function sendAuctionWinnerEmail(params: {
  winnerEmail: string;
  winnerName: string;
  productName: string;
  winningBid: number;
}): Promise<void> {
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.QUIRKIFY_FROM_EMAIL;
  if (!resendApiKey || !fromEmail) return;

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;max-width:560px;margin:0 auto">
      <div style="background:linear-gradient(135deg,#ec4899,#a855f7);padding:24px 28px;border-radius:12px 12px 0 0">
        <h1 style="color:#fff;margin:0;font-size:20px;font-weight:800">Quirkify</h1>
      </div>
      <div style="background:#fff;padding:28px;border:1px solid #f3f4f6;border-top:none;border-radius:0 0 12px 12px">
        <h2 style="margin:0 0 8px;font-size:22px;color:#111827">🏆 You won the auction!</h2>
        <p>Hi ${params.winnerName || 'there'},</p>
        <p>Congratulations! You placed the winning bid for <strong>${params.productName}</strong>.</p>
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0">
          <p style="margin:0 0 4px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em">Winning bid</p>
          <p style="margin:0;font-size:24px;font-weight:800;color:#a855f7">R${params.winningBid.toFixed(2)}</p>
        </div>
        <p>Our team will be in touch shortly to arrange payment and delivery.</p>
        <a href="https://quirkify.co.za/orders" style="display:inline-block;background:linear-gradient(135deg,#ec4899,#a855f7);color:#fff;padding:12px 24px;border-radius:24px;text-decoration:none;font-weight:700;font-size:14px;margin-top:8px">View Your Orders</a>
      </div>
      <p style="text-align:center;color:#9ca3af;font-size:11px;margin-top:16px">Questions? Visit quirkify.co.za</p>
    </div>
  `;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: fromEmail,
      to: [params.winnerEmail],
      subject: `🏆 You won! — ${params.productName}`,
      html,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Resend failed: ${response.status} ${text}`);
  }
}

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');

  const resource = req.query.resource as string;
  if (!['products', 'campaigns', 'auction-winner-notify'].includes(resource)) {
    return res.status(404).json({ error: 'Unknown resource' });
  }

  // auction-winner-notify: lightweight auth via HMAC nonce (no admin token needed)
  if (resource === 'auction-winner-notify') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { winnerId, winnerEmail, productName, winningBid, nonce, signature } = req.body ?? {};
    if (!winnerId) return res.status(200).json({ notified: false, reason: 'no_winner' });

    // Verify HMAC if a shared secret is configured
    const secret = process.env.INTERNAL_API_SECRET;
    if (secret) {
      const expected = crypto.createHmac('sha256', secret).update(String(nonce ?? '')).digest('hex');
      if (signature !== expected) return res.status(401).json({ error: 'Invalid signature' });
    }

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return res.status(503).json({ error: 'Server not configured' });
    }

    try {
      const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      let resolvedEmail = winnerEmail ?? null;
      let resolvedName = '';

      if (!resolvedEmail) {
        const { data: profile } = await db
          .from('profiles')
          .select('id, email, display_name')
          .eq('firebase_uid', winnerId)
          .maybeSingle();
        resolvedEmail = profile?.email ?? null;
        resolvedName = profile?.display_name ?? '';
      }

      if (!resolvedEmail) {
        return res.status(200).json({ notified: false, reason: 'winner_email_not_found' });
      }

      await sendAuctionWinnerEmail({
        winnerEmail: resolvedEmail,
        winnerName: resolvedName,
        productName: productName || 'your item',
        winningBid: Number(winningBid ?? 0),
      });

      return res.status(200).json({ notified: true });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[auction-winner-notify] Error:', message);
      return res.status(500).json({ error: message });
    }
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
