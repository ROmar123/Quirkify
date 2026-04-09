import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Supabase] Missing env vars — Supabase features will be disabled');
}

export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder');

// Re-export the storage bucket ref helper
export const getImageUrl = (path: string) => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  const bucket = supabase.storage_bucket('product-images');
  // Build public URL from storage
  return `${supabaseUrl}/storage/v1/object/public/product-images/${path}`;
};

export default supabase;
