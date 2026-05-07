import { isSupabaseConfigured, supabase } from '../supabase';
import { Product, AllocationSnapshot } from '../types';
import { slugify, emptyReservations } from '../lib/quirkify';

const PRODUCT_POLL_INTERVAL_MS = 30000;
let productSubscriptionSequence = 0;

// DB constraint: category CHECK only allows these 6 values.
const DB_CATEGORIES = new Set(['Sneakers', 'Clothing', 'Accessories', 'Electronics', 'Collectibles', 'Other']);

// DB ENUM product_rarity — PostgREST validates strictly; anything else → "string did not match expected pattern"
const VALID_RARITIES = new Set(['Common', 'Limited', 'Rare', 'Super Rare', 'Unique']);

// Canonical DB row → Product mapper used by ALL services
export function rowToProduct(row: any): Product {
  const salePrice = Number(row.discount_price ?? row.retail_price ?? 0);
  const retailPrice = Number(row.retail_price ?? salePrice);
  const allocations: AllocationSnapshot = {
    store:   Number(row.alloc_store   || 0),
    auction: Number(row.alloc_auction || 0),
    packs:   Number(row.alloc_packs   || 0),
  };
  const mediaUrls: string[] = row.image_urls?.length
    ? row.image_urls
    : row.image_url ? [row.image_url] : [];

  // 'pack' listing type is not in the DB enum — stored as 'store' with alloc_packs > 0 and alloc_store = 0
  const rawType = row.listing_type || 'store';
  const listingType: Product['listingType'] = (
    rawType === 'store' && allocations.store === 0 && allocations.packs > 0
  ) ? 'pack' : rawType;

  return {
    id: row.id,
    slug: slugify(row.name || row.id),
    title: row.name,
    name: row.name,
    description: row.description || '',
    category: row.category || 'Other',
    condition: row.condition || 'New',
    status: row.status,
    source: row.source === 'ai_intake' ? 'ai' : (Number(row.confidence_score || 0) > 0 ? 'ai' : 'manual'),
    channels: {
      store:         listingType === 'store'   || listingType === 'both',
      auction:       listingType === 'auction' || listingType === 'both',
      packComponent: listingType === 'pack',
    },
    listingType,
    pricing: {
      listPrice:           retailPrice,
      salePrice,
      auctionStartPrice:   Number(row.price_range_min || salePrice)   || salePrice,
      auctionReservePrice: Number(row.price_range_max || retailPrice) || retailPrice,
    },
    retailPrice,
    markdownPercentage: Number(row.markdown_percentage || 0),
    discountPrice: salePrice,
    priceRange: {
      min: Number(row.price_range_min || salePrice)   || salePrice,
      max: Number(row.price_range_max || retailPrice) || retailPrice,
    },
    inventory: {
      onHand: Number(row.stock || 0),
      allocated: allocations,
      reserved: {
        store:   Number(row.reserved_store   || 0),
        auction: Number(row.reserved_auction || 0),
        packs:   Number(row.reserved_packs   || 0),
      },
      sold: emptyReservations(),
    },
    stock:      Number(row.stock || 0),
    totalStock: Number(row.stock || 0),
    allocations,
    media:     mediaUrls.map(url => ({ url })),
    imageUrl:  row.image_url || mediaUrls[0] || '',
    imageUrls: mediaUrls,
    aiConfidence:    Number(row.confidence_score || 0),
    confidenceScore: Number(row.confidence_score || 0),
    rarity: row.rarity || undefined,
    stats: row.stats_quirkiness != null ? {
      quirkiness: Number(row.stats_quirkiness),
      rarity:     Number(row.stats_rarity  || 0),
      utility:    Number(row.stats_utility || 0),
      hype:       Number(row.stats_hype    || 0),
    } : undefined,
    tags:               row.tags || [],
    merchandisingNotes: [],
    rarityNotes:        [],
    authorUid:  row.author_uid,
    createdBy:  row.author_uid,
    updatedBy:  row.author_uid,
    createdAt:  row.created_at,
    updatedAt:  row.updated_at,
    approvalDate: row.approved_at || undefined,
    version: Number(row.version || 1),
  };
}

// Canonical Product updates → DB row builder (partial — only sets provided fields)
function productToRow(product: Partial<Product>): Record<string, any> {
  const row: Record<string, any> = {};

  if (product.name        !== undefined) row.name        = product.name.trim();
  if (product.description !== undefined) row.description = product.description.trim();
  if (product.category    !== undefined) {
    const cat = product.category.trim();
    row.category = DB_CATEGORIES.has(cat) ? cat : 'Other';
  }
  if (product.condition !== undefined) {
    const CONDITION_NORMALIZE: Record<string, string> = {
      new: 'New', like_new: 'Like New', pre_owned: 'Pre-owned', refurbished: 'Refurbished',
    };
    row.condition = CONDITION_NORMALIZE[product.condition as string] ?? product.condition;
  }
  if (product.status !== undefined) {
    // Map legacy UI aliases to DB values; all lifecycle statuses now stored directly
    const STATUS_MAP: Record<string, string> = { active: 'approved', draft: 'draft_review' };
    row.status = STATUS_MAP[product.status] ?? product.status;
  }
  if (product.listingType        !== undefined) row.listing_type       = product.listingType === 'pack' ? 'store' : product.listingType;
  if (product.retailPrice        !== undefined) row.retail_price       = Number(product.retailPrice);
  if (product.markdownPercentage !== undefined) row.markdown_percentage = Number(product.markdownPercentage);
  // Compute discount_price from retail + markdown (it is a regular column, not generated)
  if (product.discountPrice !== undefined) {
    row.discount_price = Number(product.discountPrice);
  } else if (product.retailPrice !== undefined || product.markdownPercentage !== undefined) {
    const r   = Number(product.retailPrice   ?? 0);
    const pct = Number(product.markdownPercentage ?? 0);
    if (r > 0) row.discount_price = Math.round(r * (1 - pct / 100) * 100) / 100;
  }
  if (product.stock !== undefined) row.stock = Number(product.stock);
  if (product.allocations) {
    row.alloc_store   = Number(product.allocations.store   || 0);
    row.alloc_auction = Number(product.allocations.auction || 0);
    row.alloc_packs   = Number(product.allocations.packs   || 0);
  }
  // Only send image_url when it's a real HTTPS URL — never send base64 or empty strings
  if (product.imageUrl?.startsWith('http')) row.image_url = product.imageUrl;
  if (product.confidenceScore !== undefined) {
    row.confidence_score = Math.min(1, Math.max(0, Number(product.confidenceScore)));
  }
  if (product.rarity !== undefined && VALID_RARITIES.has(product.rarity)) row.rarity = product.rarity;
  if (product.stats) {
    row.stats_quirkiness = product.stats.quirkiness ?? null;
    row.stats_rarity     = product.stats.rarity     ?? null;
    row.stats_utility    = product.stats.utility    ?? null;
    row.stats_hype       = product.stats.hype       ?? null;
  }
  if (product.priceRange) {
    row.price_range_min = Number(product.priceRange.min || 0);
    row.price_range_max = Number(product.priceRange.max || 0);
  }
  if (product.authorUid  !== undefined) row.author_uid   = product.authorUid;
  if (product.source     !== undefined) row.source        = product.source === 'ai' ? 'ai_intake' : 'manual_intake';
  if (product.tags       !== undefined) row.tags          = product.tags;
  if (product.imageUrls  !== undefined && product.imageUrls.length > 0) row.image_urls = product.imageUrls;

  return row;
}

/** Fetch products, optionally filtered by status */
export async function fetchProducts(status?: Product['status']): Promise<Product[]> {
  let query = supabase.from('products').select('*');
  if (status) query = query.eq('status', status);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map(rowToProduct);
}

/** Fetch a single product by ID */
export async function fetchProduct(id: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from('products').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToProduct(data) : null;
}

/** Create a new product (defaults to pending status) */
export async function createProduct(product: Partial<Product>): Promise<Product> {
  const row = productToRow({ ...product, status: product.status || 'pending' });
  // Ensure required fields are present for INSERT
  if (!row.name)        throw new Error('Product name is required');
  if (!row.description) throw new Error('Description is required');
  if (!row.retail_price || Number(row.retail_price) <= 0) throw new Error('Retail price must be greater than 0');
  if (row.stock === undefined) throw new Error('Stock is required');
  if (!row.image_url) {
    // Accept a data URL for image_url on initial create (storage upload may not have happened yet)
    if (product.imageUrl) row.image_url = product.imageUrl;
    else throw new Error('Product image is required');
  }
  if (!row.author_uid) throw new Error('Author UID is required');
  if (!row.condition)  row.condition  = 'New';
  if (!row.category)   row.category   = 'Other';
  if (row.listing_type === undefined) row.listing_type = 'store';
  if (row.markdown_percentage === undefined) row.markdown_percentage = 0;

  const { data, error } = await supabase.from('products').insert(row).select().single();
  if (error) throw new Error(error.message);
  return rowToProduct(data);
}

/** Update an existing product — only sends the fields explicitly provided */
export async function updateProduct(id: string, updates: Partial<Product>): Promise<Product> {
  const row = productToRow(updates);
  if (Object.keys(row).length === 0) throw new Error('No fields to update');
  const { data, error } = await supabase
    .from('products').update(row).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  return rowToProduct(data);
}

/** Delete a product */
export async function deleteProduct(id: string): Promise<void> {
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/** Subscribe to real-time product changes */
export function subscribeToProducts(
  status: Product['status'] | undefined,
  callback: (products: Product[]) => void
): () => void {
  let disposed = false;
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  const refresh = async () => {
    if (disposed) return;
    try {
      const products = await fetchProducts(status);
      if (!disposed) callback(products);
    } catch (err) {
      console.error('[productService] Failed to refresh products', { status, err });
    }
  };

  const startPolling = () => {
    if (pollTimer || disposed) return;
    pollTimer = setInterval(() => void refresh(), PRODUCT_POLL_INTERVAL_MS);
  };

  const stopPolling = () => {
    if (!pollTimer) return;
    clearInterval(pollTimer);
    pollTimer = null;
  };

  void refresh();

  if (!isSupabaseConfigured) {
    startPolling();
    return () => { disposed = true; stopPolling(); };
  }

  const channelName = `products-changes:${status ?? 'all'}:${++productSubscriptionSequence}`;
  let channel: ReturnType<typeof supabase.channel> | null = null;
  try {
    channel = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'products',
        ...(status ? { filter: `status=eq.${status}` } : {}),
      }, () => void refresh())
      .subscribe((state, err) => {
        if (disposed) return;
        if (state === 'SUBSCRIBED') { stopPolling(); return; }
        if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT' || state === 'CLOSED') {
          console.warn('[productService] Realtime unavailable, falling back to polling', { status, state, err });
          startPolling();
          void refresh();
        }
      });
  } catch {
    startPolling();
  }

  return () => {
    disposed = true;
    stopPolling();
    if (channel) void supabase.removeChannel(channel);
  };
}
