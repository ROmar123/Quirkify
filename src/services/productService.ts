import { isSupabaseConfigured, supabase } from '../supabase';
import { Product, AllocationSnapshot } from '../types';
import { DEMO_PRODUCTS, isDemoProductId } from '../constants/demoProducts';

const PRODUCT_POLL_INTERVAL_MS = 30000;
let productSubscriptionSequence = 0;

type DbRow = Record<string, unknown>;

// Maps Supabase row → frontend Product type
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
    discountPrice: row.discount_price != null ? Number(row.discount_price) : (Number(row.retail_price) || 0),
    stock: row.stock,
    totalStock: row.stock,
    allocations: {
      store: row.alloc_store,
      auction: row.alloc_auction,
      packs: row.alloc_packs,
    },
    imageUrl: row.image_url,
    imageUrls: row.image_urls || [],
    confidenceScore: Number(row.confidence_score) || 0,
    rarity: row.rarity,
    stats: (row.stats_quirkiness != null) ? {
      quirkiness: row.stats_quirkiness,
      rarity: row.stats_rarity,
      utility: row.stats_utility,
      hype: row.stats_hype,
    } : undefined,
    priceRange: {
      min: Number(row.price_range_min) || 0,
      max: Number(row.price_range_max) || 0,
    },
    authorUid: row.author_uid,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    approvalDate: row.approved_at,
    version: row.version,
  };
}

// Maps frontend Product → Supabase insert/update
function productToRow(product: Partial<Product>) {
  const row: Record<string, unknown> = {};

  if (product.name !== undefined) row.name = product.name.trim();
  if (product.description !== undefined) row.description = product.description.trim();
  if (product.category !== undefined) row.category = product.category.trim();
  if (product.condition !== undefined) row.condition = product.condition;
  if (product.status !== undefined) row.status = product.status;
  if (product.listingType !== undefined) row.listing_type = product.listingType;
  if (product.retailPrice !== undefined) row.retail_price = product.retailPrice;
  if (product.markdownPercentage !== undefined) row.markdown_percentage = product.markdownPercentage;
  // discount_price is a generated column — never set it
  if (product.stock !== undefined) row.stock = product.stock;
  if (product.allocations) {
    row.alloc_store = product.allocations.store;
    row.alloc_auction = product.allocations.auction;
    row.alloc_packs = product.allocations.packs;
  }
  if (product.imageUrl !== undefined) row.image_url = product.imageUrl;
  if (product.imageUrls !== undefined) row.image_urls = product.imageUrls;
  if (product.confidenceScore !== undefined) row.confidence_score = product.confidenceScore;
  if (product.rarity !== undefined) row.rarity = product.rarity;
  if (product.stats) {
    row.stats_quirkiness = product.stats.quirkiness;
    row.stats_rarity = product.stats.rarity;
    row.stats_utility = product.stats.utility;
    row.stats_hype = product.stats.hype;
  }
  if (product.priceRange) {
    row.price_range_min = product.priceRange.min;
    row.price_range_max = product.priceRange.max;
  }
  if (product.authorUid !== undefined) row.author_uid = product.authorUid;

  return row;
}

/** Fetch products by status.
 *  Pass skipDemo=true in admin views so empty DB shows an empty list rather than demo data. */
export async function fetchProducts(status?: Product['status'], opts?: { skipDemo?: boolean }): Promise<Product[]> {
  try {
    let query = supabase.from('products').select('*');
    if (status) {
      query = query.eq('status', status);
    }
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw new Error(error.message);

    const products = (data || []).map(rowToProduct);
    if (products.length > 0) {
      return products;
    }
  } catch (error) {
    if (status && status !== 'approved') {
      throw error;
    }
  }

  if (opts?.skipDemo) return [];

  if (!status || status === 'approved') {
    return DEMO_PRODUCTS;
  }

  return [];
}

/** Fetch a single product by ID */
export async function fetchProduct(id: string): Promise<Product | null> {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();
    if (error) {
      if (error.code === 'PGRST116' && isDemoProductId(id)) {
        return DEMO_PRODUCTS.find(product => product.id === id) ?? null;
      }
      if (error.code === 'PGRST116') return null;
      throw new Error(error.message);
    }
    return rowToProduct(data);
  } catch (error) {
    if (isDemoProductId(id)) {
      return DEMO_PRODUCTS.find(product => product.id === id) ?? null;
    }
    throw error;
  }
}

/** Create a new product (status defaults to 'pending') */
export async function createProduct(product: Partial<Product>): Promise<Product> {
  const row = productToRow({ ...product, status: 'pending' });
  const { data, error } = await supabase
    .from('products')
    .insert(row)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToProduct(data);
}

/** Update an existing product */
export async function updateProduct(id: string, updates: Partial<Product>): Promise<Product> {
  const row = productToRow(updates);
  const { data, error } = await supabase
    .from('products')
    .update(row)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToProduct(data);
}

/** Delete a product */
export async function deleteProduct(id: string): Promise<void> {
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id);
  if (error) throw new Error(error.message);
}

/** Subscribe to real-time product changes (uses Supabase Realtime).
 *  Pass skipDemo=true in admin views to avoid showing demo products. */
export function subscribeToProducts(
  status: Product['status'] | undefined,
  callback: (products: Product[]) => void,
  opts?: { skipDemo?: boolean }
) {
  let disposed = false;
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  const refresh = async () => {
    if (disposed) return;

    try {
      const products = await fetchProducts(status, opts);
      if (!disposed) {
        callback(products);
      }
    } catch (error) {
      console.error('[Supabase] Failed to refresh products', { status, error });
    }
  };

  const startPolling = () => {
    if (pollTimer || disposed) return;
    pollTimer = setInterval(() => {
      void refresh();
    }, PRODUCT_POLL_INTERVAL_MS);
  };

  const stopPolling = () => {
    if (!pollTimer) return;
    clearInterval(pollTimer);
    pollTimer = null;
  };

  void refresh();

  if (!isSupabaseConfigured) {
    startPolling();
    return () => {
      disposed = true;
      stopPolling();
    };
  }

  const channelName = `products-changes:${status ?? 'all'}:${++productSubscriptionSequence}`;
  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'products',
        ...(status ? { filter: `status=eq.${status}` } : {}),
      },
      () => {
        void refresh();
      }
    )
    .subscribe((channelStatus, error) => {
      if (disposed) return;

      if (channelStatus === 'SUBSCRIBED') {
        stopPolling();
        return;
      }

      if (channelStatus === 'CHANNEL_ERROR' || channelStatus === 'TIMED_OUT' || channelStatus === 'CLOSED') {
        console.warn('[Supabase] Product realtime unavailable, falling back to polling', {
          status,
          channelStatus,
          error,
        });
        startPolling();
        void refresh();
      }
    });

  return () => {
    disposed = true;
    stopPolling();
    void supabase.removeChannel(channel);
  };
}
