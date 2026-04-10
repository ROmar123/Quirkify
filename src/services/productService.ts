import { supabase } from '../supabase';
import { Product, AllocationSnapshot } from '../types';

let productSubscriptionSequence = 0;

function rowToProduct(row: any): Product {
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
    allocations: {
      store: row.alloc_store,
      auction: row.alloc_auction,
      packs: row.alloc_packs,
    },
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

function productToRow(product: Partial<Product>) {
  const row: Record<string, any> = {};

  if (product.name !== undefined) row.name = product.name.trim();
  if (product.description !== undefined) row.description = product.description.trim();
  if (product.category !== undefined) row.category = product.category.trim();
  if (product.condition !== undefined) row.condition = product.condition;
  if (product.status !== undefined) row.status = product.status;
  if (product.listingType !== undefined) row.listing_type = product.listingType;
  if (product.retailPrice !== undefined) row.retail_price = product.retailPrice;
  if (product.markdownPercentage !== undefined) row.markdown_percentage = product.markdownPercentage;
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

export async function fetchProducts(status?: Product['status']): Promise<Product[]> {
  let query = supabase.from('products').select('*');
  if (status) {
    query = query.eq('status', status);
  }
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map(rowToProduct);
}

export async function fetchProduct(id: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(error.message);
  }
  return rowToProduct(data);
}

export async function createProduct(product: Partial<Product>): Promise<Product> {
  const row = productToRow({ ...product, status: product.status ?? 'pending' });
  const { data, error } = await supabase
    .from('products')
    .insert(row)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToProduct(data);
}

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

export async function deleteProduct(id: string): Promise<void> {
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export function subscribeToProducts(
  status: Product['status'] | undefined,
  callback: (products: Product[]) => void
) {
  fetchProducts(status).then(callback).catch(console.error);

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
        fetchProducts(status).then(callback).catch(console.error);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export async function updateProductStock(id: string, allocations: AllocationSnapshot): Promise<Product> {
  return updateProduct(id, { allocations });
}

export async function approveProduct(id: string, authorUid: string): Promise<Product> {
  return updateProduct(id, {
    status: 'approved',
    authorUid,
    approvalDate: new Date().toISOString(),
  });
}

export async function rejectProduct(id: string): Promise<Product> {
  return updateProduct(id, { status: 'rejected' });
}
