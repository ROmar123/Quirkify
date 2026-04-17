import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Fallbacks mirror the published values in firebase.ts — anon key is intentionally public
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mvoigokzsaybwiogjpvr.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_PzK-Rd37B8yJaF8c9Wz9og_uJ6Q_CLS';
export const isSupabaseConfigured = true;

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export const getImageUrl = (path: string) => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${supabaseUrl}/storage/v1/object/public/product-images/${path}`;
};

export default supabase;
