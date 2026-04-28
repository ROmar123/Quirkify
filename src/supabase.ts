import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { normalizeEnvValue } from './lib/env';

// Fallbacks are the real project credentials — anon key is intentionally public (publishable),
// same pattern as the hardcoded Firebase config. Env vars override when set.
const supabaseUrl = normalizeEnvValue(import.meta.env.VITE_SUPABASE_URL) || 'https://mvoigokzsaybwiogjpvr.supabase.co';
const supabaseAnonKey = normalizeEnvValue(import.meta.env.VITE_SUPABASE_ANON_KEY) || 'sb_publishable_PzK-Rd37B8yJaF8c9Wz9og_uJ6Q_CLS';
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
    detectSessionInUrl: true,
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
