import { requireVerifiedUser, sendAuthError } from '../_lib/auth.js';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js';

const ADMIN_EMAILS = new Set(
  (process.env.VITE_ADMIN_EMAILS || 'patengel85@gmail.com')
    .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean),
);

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const verifiedUser = await requireVerifiedUser(req);
    const supabase = getSupabaseAdmin();

    const email = verifiedUser.email?.toLowerCase() ?? '';
    const role = ADMIN_EMAILS.has(email) ? 'admin' : undefined;

    // Look up existing profile
    let { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('firebase_uid', verifiedUser.uid)
      .maybeSingle();

    if (!profile && email) {
      const { data: byEmail } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', email)
        .maybeSingle();
      profile = byEmail;
    }

    const { displayName, photoURL } = req.body ?? {};

    if (profile) {
      const { data: updated, error } = await supabase
        .from('profiles')
        .update({
          firebase_uid: verifiedUser.uid,
          email: email || profile.email,
          display_name: displayName || profile.display_name,
          photo_url: photoURL || profile.photo_url,
          ...(role ? { role } : {}),
          last_active_at: new Date().toISOString(),
        })
        .eq('id', profile.id)
        .select('*')
        .single();

      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ profile: updated });
    }

    // First sign-in — create profile
    const { data: created, error: insertError } = await supabase
      .from('profiles')
      .insert({
        firebase_uid: verifiedUser.uid,
        email: email,
        display_name: displayName || email.split('@')[0] || '',
        photo_url: photoURL || null,
        role: role || 'customer',
      })
      .select('*')
      .single();

    if (insertError) return res.status(500).json({ error: insertError.message });
    return res.status(200).json({ profile: created });
  } catch (err: any) {
    if (err?.statusCode === 401) return sendAuthError(res, err);
    return res.status(500).json({ error: err?.message || 'Profile sync failed' });
  }
}
