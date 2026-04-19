import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ADMIN_EMAILS = new Set(
  (process.env.VITE_ADMIN_EMAILS || 'patengel85@gmail.com')
    .split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
);

async function verifyAdmin(token: string): Promise<boolean> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return false;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) return false;
  if (ADMIN_EMAILS.has((user.email || '').toLowerCase())) return true;
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle();
  return profile?.role === 'admin';
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const token = ((req.headers['authorization'] as string) || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return res.status(401).json({ error: 'Authorization header required' });

  const isAdmin = await verifyAdmin(token).catch(() => false);
  if (!isAdmin) return res.status(403).json({ error: 'Admin access required' });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const statusFilter = typeof req.query?.status === 'string' ? req.query.status : null;

  let query = admin.from('products').select('*').order('created_at', { ascending: false });
  if (statusFilter) query = query.eq('status', statusFilter);

  const { data, error } = await query;
  if (error) return res.status(400).json({ error: error.message });

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ products: data || [] });
}
