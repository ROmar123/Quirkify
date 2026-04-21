import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Fallbacks mirror the published values in firebase.ts — anon key is intentionally public
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mvoigokzsaybwiogjpvr.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_PzK-Rd37B8yJaF8c9Wz9og_uJ6Q_CLS';
export const isSupabaseConfigured = true;

// Safari private mode (and some hardened browsers) throw SecurityError: The operation
// is insecure when any code touches localStorage. Wrap it so auth never crashes.
const safeStorage = {
  getItem: (key: string): string | null => { try { return localStorage.getItem(key); } catch { return null; } },
  setItem: (key: string, value: string): void => { try { localStorage.setItem(key, value); } catch {} },
  removeItem: (key: string): void => { try { localStorage.removeItem(key); } catch {} },
};

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storage: safeStorage,
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
