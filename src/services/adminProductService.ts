import { supabase } from '../supabase';
import { Product } from '../types';
import { subscribeToProducts } from './productService';

type DbRow = Record<string, unknown>;

function rowToProduct(row: DbRow): Product {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    condition: row.condition,
    status: row.status,
    listingType: row.listing_type,
    retailPrice: Number(row.retail_price),
    markdownPercentage: row.markdown_percentage,
    discountPrice: Number(row.discount_price),
    stock: row.stock,
    totalStock: row.stock,
    allocations: { store: row.alloc_store, auction: row.alloc_auction, packs: row.alloc_packs },
    imageUrl: row.image_url,
    imageUrls: row.image_urls || [],
    confidenceScore: Number(row.confidence_score) || 0,
    rarity: row.rarity,
    stats: row.stats_quirkiness != null ? {
      quirkiness: row.stats_quirkiness,
      rarity: row.stats_rarity,
      utility: row.stats_utility,
      hype: row.stats_hype,
    } : undefined,
    priceRange: { min: Number(row.price_range_min) || 0, max: Number(row.price_range_max) || 0 },
    authorUid: row.author_uid,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    approvalDate: row.approved_at,
    version: row.version,
  };
}

async function getAdminToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

/** Fetch all products (bypasses RLS) via Vercel admin API.
 *  Falls back to direct Supabase query if API unavailable. */
export async function fetchAllProductsAdmin(status?: string): Promise<Product[]> {
  try {
    const token = await getAdminToken();
    if (!token) throw new Error('Not authenticated');

    const url = status ? `/api/admin/products?status=${encodeURIComponent(status)}` : '/api/admin/products';
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const json = await res.json();
    return (json.products || []).map(rowToProduct);
  } catch {
    // Fallback to direct Supabase (works after migration 007 is applied)
    return subscribeToProductsAdmin_directFetch(status as any);
  }
}

async function subscribeToProductsAdmin_directFetch(status?: Product['status']): Promise<Product[]> {
  const { supabase: sb } = await import('../supabase');
  let q = sb.from('products').select('*').order('created_at', { ascending: false });
  if (status) q = q.eq('status', status);
  const { data } = await q;
  return (data || []).map(rowToProduct);
}

/** Subscribe to admin product changes with polling (30s interval). */
export function subscribeToProductsAdmin(
  status: Product['status'] | undefined,
  callback: (products: Product[]) => void
): () => void {
  let disposed = false;

  const refresh = async () => {
    if (disposed) return;
    try {
      const products = await fetchAllProductsAdmin(status);
      if (!disposed) callback(products);
    } catch { /* silent */ }
  };

  void refresh();

  const interval = setInterval(() => void refresh(), 30000);

  // Also subscribe to Supabase realtime as an update trigger
  const channel = supabase
    .channel(`admin-products:${status ?? 'all'}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => void refresh())
    .subscribe();

  return () => {
    disposed = true;
    clearInterval(interval);
    void supabase.removeChannel(channel);
  };
}
