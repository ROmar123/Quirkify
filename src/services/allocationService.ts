import { isSupabaseConfigured, supabase } from '../supabase';
import { rowToProduct } from './productService';
import type { AllocationSnapshot, Product } from '../types';

// Friendly error mapping for `set_product_allocations` and the underlying
// allocation CHECK constraints.
function humanizeAllocError(message: string): string {
  if (message.startsWith('PRODUCT_NOT_FOUND')) return 'Product not found';
  if (message.includes('products_allocations_within_stock')) {
    return 'Allocations cannot exceed total stock';
  }
  if (message.includes('products_allocations_nonnegative')) {
    return 'Allocations cannot be negative';
  }
  if (message.includes('products_reserved_within_allocations')) {
    return 'Reserved units exceed the new allocation — release reservations first';
  }
  return message;
}

/**
 * Atomically set the three allocation channels for a product. Writes one
 * `inventory_movements` row per non-zero delta. The DB enforces the
 * reconciliation invariants via CHECK constraints; this function surfaces
 * any violation as a human-readable error.
 *
 * @param productId  Target product UUID
 * @param allocs     Desired allocations (store/auction/packs)
 * @param reason     Free-form tag appended to movement.reason (e.g. 'approval', 'rebalance')
 */
export async function setAllocations(
  productId: string,
  allocs: AllocationSnapshot,
  reason: string = 'manual',
): Promise<Product> {
  if (!isSupabaseConfigured) {
    throw new Error('Allocations require Supabase configuration');
  }

  const { data: { user } } = await supabase.auth.getUser();
  const actor = user?.id ?? 'system';

  const { data, error } = await supabase.rpc('set_product_allocations', {
    p_product_id:   productId,
    p_alloc_store:   Math.max(0, Math.floor(allocs.store)),
    p_alloc_auction: Math.max(0, Math.floor(allocs.auction)),
    p_alloc_packs:   Math.max(0, Math.floor(allocs.packs)),
    p_reason:        reason,
    p_actor:         actor,
  });

  if (error) throw new Error(humanizeAllocError(error.message));
  if (!data) throw new Error('Allocation update returned no row');

  return rowToProduct(data);
}

/** Recent inventory movements for a product (newest first). */
export async function listMovements(productId: string, limit: number = 50) {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('inventory_movements')
    .select('*')
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data || [];
}
