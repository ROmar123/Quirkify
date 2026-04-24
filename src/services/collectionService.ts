import { supabase } from '../supabase';
import type { Product } from '../types';

export interface CollectionItemRecord {
  id: string;
  profileId: string;
  productId: string | null;
  acquiredAt: string;
  purchasePrice: number;
  product?: Product;
}

type DbRow = Record<string, unknown>;

function rowToProduct(row: DbRow): Product {
  return {
    id: row.id as string,
    name: row.name as string,
    description: row.description as string,
    category: row.category as string,
    condition: row.condition as Product['condition'],
    status: row.status as Product['status'],
    listingType: row.listing_type as Product['listingType'],
    retailPrice: Number(row.retail_price) || 0,
    markdownPercentage: Number(row.markdown_percentage) || 0,
    discountPrice: row.discount_price != null
      ? Number(row.discount_price)
      : Number(row.retail_price) || 0,
    stock: Number(row.stock) || 0,
    totalStock: Number(row.stock) || 0,
    allocations: {
      store: Number(row.alloc_store) || 0,
      auction: Number(row.alloc_auction) || 0,
      packs: Number(row.alloc_packs) || 0,
    },
    imageUrl: (row.image_url as string) || '',
    imageUrls: (row.image_urls as string[]) || [],
    confidenceScore: Number(row.confidence_score) || 0,
    rarity: row.rarity as Product['rarity'],
    priceRange: {
      min: Number(row.price_range_min) || 0,
      max: Number(row.price_range_max) || 0,
    },
    authorUid: (row.author_uid as string) || '',
    createdAt: (row.created_at as string) || '',
    updatedAt: row.updated_at as string | undefined,
  };
}

/** Fetch all collection items for a profile, with product data joined */
export async function fetchCollectionItems(profileId: string): Promise<CollectionItemRecord[]> {
  const { data, error } = await supabase
    .from('collection_items')
    .select('*, products(*)')
    .eq('profile_id', profileId)
    .order('acquired_at', { ascending: false });

  if (error) throw new Error(error.message);

  return (data || []).map((row: any) => ({
    id: row.id,
    profileId: row.profile_id,
    productId: row.product_id,
    acquiredAt: row.acquired_at,
    purchasePrice: Number(row.purchase_price) || 0,
    product: row.products ? rowToProduct(row.products as DbRow) : undefined,
  }));
}

/** Add a product to a user's collection after purchase */
export async function addToCollection(
  profileId: string,
  productId: string,
  purchasePrice: number
): Promise<void> {
  const { error } = await supabase.from('collection_items').insert({
    profile_id: profileId,
    product_id: productId,
    purchase_price: purchasePrice,
    acquired_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}
