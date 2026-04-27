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

  // Verify Supabase JWT using the service-role admin client
  const supabase = getSupabaseAdmin();
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    throw Object.assign(new Error('Invalid or expired token'), { statusCode: 401 });
  }

  const email = user.email?.toLowerCase() ?? null;

  let { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, role, email, firebase_uid')
    .eq('firebase_uid', user.id)
    .maybeSingle();

  if (profileError) {
    throw Object.assign(new Error(profileError.message), { statusCode: 500 });
  }

  if (!profile && email) {
    const { data: fallback } = await supabase
      .from('profiles')
      .select('id, role, email, firebase_uid')
      .eq('email', email)
      .maybeSingle();
    profile = fallback;
  }

  const isAdmin = Boolean(
    (email && ADMIN_EMAILS.has(email)) ||
    profile?.role === 'admin',
  );

  return {
    uid: user.id,
    email,
    name:
      user.user_metadata?.full_name ??
      user.user_metadata?.display_name ??
      user.user_metadata?.name ??
      null,
    isAdmin,
    profileId: profile?.id ?? null,
  };
}

export function sendAuthError(res: any, error: any) {
  const status = Number(error?.statusCode || 401);
  return res.status(status).json({ error: error?.message || 'Authorization required' });
}
