import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Hardcoded real project credentials — publishable/anon key is intentionally public,
// identical pattern to the hardcoded Firebase config. Env vars only override when they
// pass a basic format check so stale Vercel placeholders like
// "https://missing-supabase-project.invalid" are silently ignored.
const _url = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const _key = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

const supabaseUrl = /^https:\/\/[a-z0-9]+\.supabase\.co/.test(_url)
  ? _url
  : 'https://mvoigokzsaybwiogjpvr.supabase.co';

const supabaseAnonKey = /^(eyJ|sb_publishable_)/.test(_key)
  ? _key
  : 'sb_publishable_PzK-Rd37B8yJaF8c9Wz9og_uJ6Q_CLS';

export const isSupabaseConfigured = true;

// Safari private mode throws SecurityError on any localStorage access.
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
