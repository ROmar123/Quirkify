import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase environment variables — Supabase features will be unavailable.');
}

// Chainable stub that always resolves with empty data
// Every method returns itself so .from().select().eq().single() works
function createStub(): any {
  const result = { data: null, error: { message: 'Supabase not configured', code: 'NOT_CONFIGURED' } };
  const stub: any = new Proxy(() => Promise.resolve(result), {
    get(_, prop) {
      // Terminal await — return the result promise
      if (prop === 'then') return (resolve: any) => resolve(result);
      // Everything else returns the chainable stub
      return () => stub;
    },
    apply() {
      return stub;
    },
  });
  return stub;
}

export const supabase: SupabaseClient = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : new Proxy({} as SupabaseClient, {
      get(_, prop) {
        if (prop === 'from' || prop === 'channel' || prop === 'removeChannel' || prop === 'rpc') {
          return () => createStub();
        }
        return () => createStub();
      },
    });
