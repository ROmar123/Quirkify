import { supabase } from '../supabase';
import type { Product, AllocationSnapshot } from '../types';

export type ProductStatus = 'pending' | 'approved' | 'rejected';
export type ProductSubscription = ReturnType<typeof supabase.channel>;

export async function fetchProducts(status?: ProductStatus): Promise<{ data: Product[]; error: any }> {
  let q = supabase
    .from('products')
    .select('*')
    .order('createdAt', { ascending: false })
    .limit(100);
  if (status) q = q.eq('status', status);
  return q;
}

export async function fetchProduct(id: string): Promise<{ data: Product | null; error: any }> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single();
  return { data, error };
}

export async function createProduct(product: Partial<Product>): Promise<{ data: Product | null; error: any }> {
  const { data, error } = await supabase
    .from('products')
    .insert([product])
    .select()
    .single();
  return { data, error };
}

export async function updateProduct(id: string, updates: Partial<Product>): Promise<{ error: any }> {
  const { error } = await supabase
    .from('products')
    .update({ ...updates, updatedAt: new Date().toISOString() })
    .eq('id', id);
  return { error };
}

export async function updateProductStock(id: string, allocations: AllocationSnapshot): Promise<{ error: any }> {
  const { error } = await supabase
    .from('products')
    .update({ allocations, updatedAt: new Date().toISOString() })
    .eq('id', id);
  return { error };
}

export async function approveProduct(id: string, authorUid: string): Promise<{ error: any }> {
  const { error } = await supabase
    .from('products')
    .update({ status: 'approved', approvalDate: new Date().toISOString(), updatedAt: new Date().toISOString() })
    .eq('id', id);
  return { error };
}

export async function rejectProduct(id: string): Promise<{ error: any }> {
  const { error } = await supabase
    .from('products')
    .update({ status: 'rejected', updatedAt: new Date().toISOString() })
    .eq('id', id);
  return { error };
}

export async function deleteProduct(id: string): Promise<{ error: any }> {
  const { error } = await supabase.from('products').delete().eq('id', id);
  return { error };
}

// Real-time subscription via Supabase Realtime channel
export function subscribeToProducts(
  status: ProductStatus,
  callback: (products: Product[]) => void
): () => void {
  const channel = supabase
    .channel('products-' + status)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'products',
      filter: status ? `status=eq.${status}` : undefined
    }, (payload) => {
      if (payload.eventType === 'DELETE') {
        callback([]);
      } else {
        fetchProducts(status).then(({ data }) => callback(data || []));
      }
    })
    .subscribe();
  return () => supabase.removeChannel(channel);
}
