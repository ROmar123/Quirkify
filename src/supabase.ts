import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Accept both Vite-style and Next.js-style env var names for flexibility.
const supabaseUrl =
  import.meta.env.NEXT_PUBLIC_SUPABASE_URL ||
  import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey =
  import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  console.warn('[Supabase] Missing env vars — Supabase features will be disabled');
}

function createStub(): any {
  const result = {
    data: null,
    error: { message: 'Supabase not configured', code: 'NOT_CONFIGURED' },
  };

  const stub: any = new Proxy(() => Promise.resolve(result), {
    get(_, prop) {
      if (prop === 'then') return (resolve: (value: typeof result) => void) => resolve(result);
      return () => stub;
    },
    apply() {
      return stub;
    },
  });

  return stub;
}

export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
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
    })
  : new Proxy({} as SupabaseClient, {
      get() {
        return () => createStub();
      },
    });

// Re-export the storage bucket ref helper
export const getImageUrl = (path: string) => {
  if (!path) return '';
  if (path.startsWith('http')) return path;

  // Build public URL from storage
  return `https://mvoigokzsaybwiogjpvr.supabase.co/storage/v1/object/public/product-images/${path}`;
};

export default supabase;
