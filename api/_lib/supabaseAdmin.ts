import { createClient } from '@supabase/supabase-js';

// @supabase/realtime-js calls getWebSocketConstructor() in RealtimeClient constructor,
// which throws on any Node.js build that lacks a globalThis.WebSocket. Polyfill it
// before the first createClient() so cold-starts never crash on this check.
if (typeof (globalThis as any).WebSocket === 'undefined') {
  (globalThis as any).WebSocket = class {};
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://mvoigokzsaybwiogjpvr.supabase.co';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.warn('[Supabase Admin] Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

export function getSupabaseAdmin() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Supabase admin environment is not configured');
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function ensureProfileByIdentity(params: {
  firebaseUid: string;
  email: string;
  displayName?: string | null;
}) {
  const supabase = getSupabaseAdmin();
  const normalizedEmail = params.email.trim().toLowerCase();

  const { data: existingByUid, error: uidError } = await supabase
    .from('profiles')
    .select('*')
    .eq('firebase_uid', params.firebaseUid)
    .maybeSingle();

  if (uidError) {
    throw new Error(uidError.message);
  }

  if (existingByUid) {
    return existingByUid;
  }

  const { data: existingByEmail, error: emailError } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (emailError) {
    throw new Error(emailError.message);
  }

  if (existingByEmail) {
    const { data: updated, error: updateError } = await supabase
      .from('profiles')
      .update({
        firebase_uid: params.firebaseUid,
        display_name: params.displayName || existingByEmail.display_name || '',
        last_active_at: new Date().toISOString(),
      })
      .eq('id', existingByEmail.id)
      .select('*')
      .single();

    if (updateError) {
      throw new Error(updateError.message);
    }

    return updated;
  }

  const { data: inserted, error: insertError } = await supabase
    .from('profiles')
    .insert({
      firebase_uid: params.firebaseUid,
      email: normalizedEmail,
      display_name: params.displayName || '',
    })
    .select('*')
    .single();

  if (insertError) {
    throw new Error(insertError.message);
  }

  return inserted;
}

export async function expireStalePendingOrders() {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.rpc('expire_stale_pending_orders');
  if (error) {
    throw new Error(error.message);
  }
}
