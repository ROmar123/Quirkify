import { getAdminAuth } from './firebaseAdmin.js';
import { getSupabaseAdmin } from './supabaseAdmin.js';

const ADMIN_EMAILS = new Set(
  (process.env.VITE_ADMIN_EMAILS || 'patengel85@gmail.com')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);

export type VerifiedRequestUser = {
  uid: string;
  email: string | null;
  name: string | null;
  isAdmin: boolean;
  profileId: string | null;
};

export async function requireVerifiedUser(req: any): Promise<VerifiedRequestUser> {
  const token = String(req.headers?.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    throw Object.assign(new Error('Authorization required'), { statusCode: 401 });
  }

  const decoded = await getAdminAuth().verifyIdToken(token);
  const email = typeof decoded.email === 'string' ? decoded.email.toLowerCase() : null;
  const supabase = getSupabaseAdmin();
  let { data: profile, error } = await supabase
    .from('profiles')
    .select('id, role, email, firebase_uid')
    .eq('firebase_uid', decoded.uid)
    .maybeSingle();

  if (error) {
    throw Object.assign(new Error(error.message), { statusCode: 500 });
  }

  if (!profile && email) {
    const fallback = await supabase
      .from('profiles')
      .select('id, role, email, firebase_uid')
      .eq('email', email)
      .maybeSingle();

    if (fallback.error) {
      throw Object.assign(new Error(fallback.error.message), { statusCode: 500 });
    }
    profile = fallback.data;
  }

  const isAdmin = Boolean(
    (email && ADMIN_EMAILS.has(email)) ||
    profile?.role === 'admin',
  );

  return {
    uid: decoded.uid,
    email,
    name: typeof decoded.name === 'string' ? decoded.name : null,
    isAdmin,
    profileId: profile?.id || null,
  };
}

export function sendAuthError(res: any, error: any) {
  const status = Number(error?.statusCode || 401);
  return res.status(status).json({ error: error?.message || 'Authorization required' });
}
