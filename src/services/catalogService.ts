import { isSupabaseConfigured, supabase } from '../supabase';
import type {
  CampaignDraft,
  ChannelAllocations,
  Pack,
  Product,
  ProductCondition,
  ProductStatus,
  ReviewEntry,
  SalesChannel,
} from '../types';
import { defaultAllocations, emptyReservations, slugify } from '../lib/quirkify';

const PRODUCT_POLL_INTERVAL_MS = 30000;

type ProductRow = {
  id: string;
  name: string;
  description: string;
  category: string;
  condition: string;
  status: string;
  listing_type: string;
  retail_price: number | string;
  markdown_percentage: number | null;
  discount_price: number | string | null;
  stock: number;
  alloc_store: number;
  alloc_auction: number;
  alloc_packs: number;
  reserved_store?: number;
  reserved_auction?: number;
  reserved_packs?: number;
  image_url: string | null;
  image_urls: string[] | null;
  confidence_score: number | string | null;
  rarity: string | null;
  stats_quirkiness?: number | null;
  stats_rarity?: number | null;
  stats_utility?: number | null;
  stats_hype?: number | null;
  price_range_min?: number | string | null;
  price_range_max?: number | string | null;
  author_uid: string;
  created_at: string;
  updated_at: string;
  approved_at?: string | null;
  version?: number | null;
};

type PackRow = {
  id: string;
  name: string;
  description: string;
  price: number | string;
  image_url: string | null;
  item_count: number;
  total_packs: number;
  packs_sold: number;
  packs_remaining: number;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
};

type PackProductRow = {
  pack_id: string;
  product_id: string;
  max_quantity: number;
};

type CampaignDraftRow = {
  id: string;
  status: string;
  goal: string;
  constraints: string;
  authored_by: string;
  approved_by: string | null;
  approved_at: string | null;
  ai_summary: string;
  recommendation: CampaignDraft['recommendation'];
  created_at: string;
  updated_at: string;
};

function normalizeCondition(condition?: string | null): ProductCondition {
  switch ((condition || '').toLowerCase()) {
    case 'like new':
    case 'like_new':
      return 'Like New';
    case 'pre-owned':
    case 'pre_owned':
      return 'Pre-owned';
    case 'refurbished':
      return 'Refurbished';
    default:
      return 'New';
  }
}

function conditionToDb(condition?: ProductCondition) {
  switch (condition) {
    case 'Like New':
    case 'like_new':
      return 'Like New';
    case 'Pre-owned':
    case 'pre_owned':
      return 'Pre-owned';
    case 'Refurbished':
    case 'refurbished':
      return 'Refurbished';
    default:
      return 'New';
  }
}

function listingTypeToChannels(listingType?: string | null) {
  return {
    store: listingType === 'store' || listingType === 'both',
    auction: listingType === 'auction' || listingType === 'both',
    packComponent: false,
  };
}

function inferChannel(allocations: ChannelAllocations): SalesChannel {
  if (allocations.auction > 0 && allocations.store === 0 && allocations.packs === 0) return 'auction';
  if (allocations.packs > 0 && allocations.store === 0 && allocations.auction === 0) return 'pack';
  return 'store';
}

function rowToProduct(row: ProductRow): Product {
  const salePrice = Number(row.discount_price ?? row.retail_price ?? 0);
  const retailPrice = Number(row.retail_price ?? salePrice);
  const allocations = {
    store: Number(row.alloc_store || 0),
    auction: Number(row.alloc_auction || 0),
    packs: Number(row.alloc_packs || 0),
  };
  const mediaUrls = row.image_urls?.length ? row.image_urls : row.image_url ? [row.image_url] : [];

  return {
    id: row.id,
    slug: slugify(row.name || row.id),
    title: row.name,
    name: row.name,
    description: row.description || '',
    category: row.category || 'Other',
    condition: normalizeCondition(row.condition),
    status: row.status as ProductStatus,
    source: Number(row.confidence_score || 0) > 0 ? 'ai' : 'manual',
    channels: listingTypeToChannels(row.listing_type),
    listingType: (row.listing_type as Product['listingType']) || 'store',
    pricing: {
      listPrice: retailPrice,
      salePrice,
      auctionStartPrice: Number(row.price_range_min || salePrice) || salePrice,
      auctionReservePrice: Number(row.price_range_max || retailPrice) || retailPrice,
    },
    retailPrice,
    markdownPercentage: Number(row.markdown_percentage || 0),
    discountPrice: salePrice,
    priceRange: {
      min: Number(row.price_range_min || salePrice) || salePrice,
      max: Number(row.price_range_max || retailPrice) || retailPrice,
    },
    inventory: {
      onHand: Number(row.stock || 0),
      allocated: allocations,
      reserved: {
        store: Number(row.reserved_store || 0),
        auction: Number(row.reserved_auction || 0),
        packs: Number(row.reserved_packs || 0),
      },
      sold: emptyReservations(),
    },
    stock: Number(row.stock || 0),
    totalStock: Number(row.stock || 0),
    allocations,
    media: mediaUrls.map((url) => ({ url })),
    imageUrl: row.image_url || mediaUrls[0] || '',
    imageUrls: mediaUrls,
    aiConfidence: Number(row.confidence_score || 0),
    confidenceScore: Number(row.confidence_score || 0),
    rarity: (row.rarity as Product['rarity']) || undefined,
    stats:
      row.stats_quirkiness != null
        ? {
            quirkiness: Number(row.stats_quirkiness),
            rarity: Number(row.stats_rarity || 0),
            utility: Number(row.stats_utility || 0),
            hype: Number(row.stats_hype || 0),
          }
        : undefined,
    tags: [],
    merchandisingNotes: [],
    rarityNotes: [],
    authorUid: row.author_uid,
    createdBy: row.author_uid,
    updatedBy: row.author_uid,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    approvalDate: row.approved_at || undefined,
    version: Number(row.version || 1),
  };
}

function productToInsertRow(product: Partial<Product>, status: ProductStatus) {
  const title = (product.title || product.name || '').trim();
  const imageUrls =
    product.media?.map((item) => item.url).filter(Boolean) ||
    product.imageUrls?.filter(Boolean) ||
    (product.imageUrl ? [product.imageUrl] : []);
  const primaryImage = imageUrls[0] || '';
  const stock = Number(product.inventory?.onHand ?? product.stock ?? 0);
  const allocations = product.inventory?.allocated || product.allocations || defaultAllocations('store', stock);
  const listingType =
    product.listingType ||
    (allocations.store > 0 && allocations.auction > 0 ? 'both' : allocations.auction > 0 ? 'auction' : 'store');

  return {
    name: title,
    description: product.description?.trim() || '',
    category: product.category?.trim() || 'Other',
    condition: conditionToDb(product.condition),
    status: status === 'active' ? 'approved' : status,
    listing_type: listingType,
    retail_price: Number(product.pricing?.listPrice ?? product.retailPrice ?? product.pricing?.salePrice ?? 0),
    markdown_percentage: Number(product.markdownPercentage ?? 0),
    stock,
    alloc_store: Number(allocations.store || 0),
    alloc_auction: Number(allocations.auction || 0),
    alloc_packs: Number(allocations.packs || 0),
    image_url: primaryImage,
    image_urls: imageUrls,
    confidence_score: Number(product.aiConfidence ?? product.confidenceScore ?? 0),
    rarity: product.rarity || null,
    stats_quirkiness: product.stats?.quirkiness ?? null,
    stats_rarity: product.stats?.rarity ?? null,
    stats_utility: product.stats?.utility ?? null,
    stats_hype: product.stats?.hype ?? null,
    price_range_min: Number(product.priceRange?.min ?? product.pricing?.salePrice ?? 0),
    price_range_max: Number(product.priceRange?.max ?? product.pricing?.listPrice ?? 0),
    author_uid: product.createdBy || product.authorUid || 'system',
  };
}

function mapPendingProductToReviewEntry(product: Product): ReviewEntry {
  const channel = inferChannel(product.inventory?.allocated || defaultAllocations('store', product.stock || 1));
  const entry: ReviewEntry = {
    id: product.id,
    status: product.status === 'pending' ? 'pending' : product.status === 'rejected' ? 'rejected' : 'approved',
    source: product.source || 'ai',
    sourceInput: {
      notes: product.description || '',
      categoryHint: product.category,
      channelHint: channel,
      media: product.media || [],
    },
    generatedDraft: {
      title: product.title || product.name || 'Untitled item',
      description: product.description || '',
      category: product.category,
      condition: product.condition,
      tags: product.tags || [],
      suggestedChannel: channel,
      pricing: {
        listPrice: product.pricing?.listPrice || product.retailPrice || 0,
        salePrice: product.pricing?.salePrice || product.discountPrice || 0,
        auctionStartPrice: product.pricing?.auctionStartPrice || product.discountPrice || 0,
        auctionReservePrice: product.pricing?.auctionReservePrice || product.retailPrice || 0,
      },
      inventory: {
        onHand: product.inventory?.onHand || product.stock || 0,
        allocated: product.inventory?.allocated || product.allocations || defaultAllocations(channel, product.stock || 0),
      },
      merchandisingNotes: product.merchandisingNotes || [],
      rarityNotes: product.rarityNotes || [],
    },
    aiNotes: product.aiNotes || [],
    confidenceMarkers: [],
    confidenceScore: product.aiConfidence || product.confidenceScore || 0,
    createdBy: product.createdBy || product.authorUid || 'system',
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
  // Carry listingType alongside the ReviewEntry so the review panel can restore the
  // channel selection correctly (including 'both', which SalesChannel can't represent)
  return { ...entry, listingType: product.listingType } as ReviewEntry;
}

async function fetchProductRows(statuses?: string[]) {
  let query = supabase.from('products').select('*').order('created_at', { ascending: false });
  if (statuses?.length) {
    query = query.in('status', statuses);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data || []) as ProductRow[];
}

async function refreshProducts(statuses: string[] | undefined, callback: (products: Product[]) => void) {
  const rows = await fetchProductRows(statuses);
  const products = rows.map(rowToProduct);
  callback(products);
}

function subscribeToProductRows(statuses: string[] | undefined, callback: (products: Product[]) => void) {
  let disposed = false;
  let timer: ReturnType<typeof setInterval> | null = null;

  const refresh = async () => {
    if (disposed) return;
    try {
      await refreshProducts(statuses, callback);
    } catch (error) {
      console.error('[catalogService] Failed to refresh products', error);
    }
  };

  const startPolling = () => {
    if (timer || disposed) return;
    timer = setInterval(() => void refresh(), PRODUCT_POLL_INTERVAL_MS);
  };

  const stopPolling = () => {
    if (!timer) return;
    clearInterval(timer);
    timer = null;
  };

  void refresh();

  if (!isSupabaseConfigured) {
    startPolling();
    return () => {
      disposed = true;
      stopPolling();
    };
  }

  let channel: ReturnType<typeof supabase.channel> | null = null;
  try {
    channel = supabase
      .channel(`catalog-products:${statuses?.join(',') || 'all'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => void refresh())
      .subscribe((state) => {
        if (disposed) return;
        if (state === 'SUBSCRIBED') { stopPolling(); return; }
        if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT' || state === 'CLOSED') { startPolling(); }
      });
  } catch {
    // WebSocket unavailable — polling fallback
    startPolling();
  }

  return () => {
    disposed = true;
    stopPolling();
    if (channel) void supabase.removeChannel(channel);
  };
}

export async function listActiveProducts() {
  if (!isSupabaseConfigured) {
    return [];
  }
  const rows = await fetchProductRows(['approved', 'active']);
  return rows.map(rowToProduct);
}

export async function listProductsByAuthor(authorUid: string) {
  if (!isSupabaseConfigured) {
    return [];
  }
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('author_uid', authorUid)
    .in('status', ['approved', 'active'])
    .order('created_at', { ascending: false })
    .limit(12);

  if (error) throw new Error(error.message);
  return ((data || []) as ProductRow[]).map(rowToProduct);
}

export async function listFeaturedProducts() {
  const products = await listActiveProducts();
  return products.slice(0, 6);
}

export async function getProduct(productId: string) {
  if (!isSupabaseConfigured) {
    return null;
  }
  const { data, error } = await supabase.from('products').select('*').eq('id', productId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return rowToProduct(data as ProductRow);
}

export function subscribeToInventory(callback: (products: Product[]) => void) {
  return subscribeToProductRows(undefined, callback);
}

export function subscribeToReviewQueue(callback: (items: ReviewEntry[]) => void) {
  return subscribeToProductRows(['pending'], (products) => callback(products.map(mapPendingProductToReviewEntry)));
}

export async function createCatalogProduct(product: Partial<Product>, status: ProductStatus = 'pending') {
  const row = productToInsertRow(product, status);
  const { data, error } = await supabase.from('products').insert(row).select('*').single();
  if (error) throw new Error(error.message);
  return rowToProduct(data as ProductRow);
}

export async function createPack(pack: Pack) {
  const selectedIds = pack.components.map((component) => component.productId);
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, alloc_packs')
    .in('id', selectedIds);

  if (productsError) throw new Error(productsError.message);

  const availableCaps = (products || [])
    .map((item: any) => Number(item.alloc_packs || 0))
    .filter((value: number) => value > 0);
  const totalPacks = availableCaps.length ? Math.min(...availableCaps) : Math.max(pack.componentCount, 1);

  const { data, error } = await supabase
    .from('packs')
    .insert({
      name: pack.title || pack.name || 'Untitled pack',
      description: pack.description || '',
      price: Number(pack.price || 0),
      image_url: pack.heroImage || pack.imageUrl || null,
      item_count: Math.max(pack.componentCount || pack.components.length || 1, 1),
      total_packs: Math.max(totalPacks, 1),
      status: pack.active ? 'available' : 'draft',
      created_by: pack.createdBy,
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);

  const packRow = data as PackRow;
  const packProducts = pack.components.map((component) => ({
    pack_id: packRow.id,
    product_id: component.productId,
    max_quantity: Math.max(component.quantity || 1, 1),
  }));

  if (packProducts.length) {
    const { error: packProductsError } = await supabase.from('pack_products').insert(packProducts);
    if (packProductsError) throw new Error(packProductsError.message);
  }

  return {
    id: packRow.id,
    title: packRow.name,
    name: packRow.name,
    description: packRow.description,
      heroImage: packRow.image_url || undefined,
      imageUrl: packRow.image_url || undefined,
      price: Number(packRow.price),
      componentCount: packProducts.length || pack.componentCount,
      components: pack.components,
      active: packRow.status === 'available',
      status: packRow.status,
    createdBy: packRow.created_by,
    createdAt: packRow.created_at,
    updatedAt: packRow.updated_at,
  } as Pack;
}

export async function listPacks() {
  if (!isSupabaseConfigured) {
    return [];
  }
  const [{ data: packRows, error: packsError }, { data: packProductRows, error: packProductsError }] =
    await Promise.all([
      supabase.from('packs').select('*').in('status', ['available', 'sold_out', 'draft']).order('created_at', { ascending: false }),
      supabase.from('pack_products').select('*'),
    ]);

  if (packsError) throw new Error(packsError.message);
  if (packProductsError) throw new Error(packProductsError.message);

  const grouped = new Map<string, PackProductRow[]>();
  ((packProductRows || []) as PackProductRow[]).forEach((row) => {
    const current = grouped.get(row.pack_id) || [];
    current.push(row);
    grouped.set(row.pack_id, current);
  });

  return ((packRows || []) as PackRow[]).map((row) => {
    const components = (grouped.get(row.id) || []).map((item) => ({
      productId: item.product_id,
      quantity: item.max_quantity,
    }));

    return {
      id: row.id,
      title: row.name,
      name: row.name,
      description: row.description,
      heroImage: row.image_url || undefined,
      imageUrl: row.image_url || undefined,
      price: Number(row.price),
      componentCount: row.item_count,
      components,
      active: row.status === 'available',
      status: row.status,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    } as Pack;
  });
}

export async function updateProduct(productId: string, updates: Partial<Product>) {
  const current = await getProduct(productId);
  const merged = { ...current, ...updates } as Product;
  const row = productToInsertRow(merged, merged.status || current?.status || 'pending');
  const { data, error } = await supabase.from('products').update(row).eq('id', productId).select('*').single();
  if (error) throw new Error(error.message);
  return rowToProduct(data as ProductRow);
}

export async function listCampaignDrafts() {
  if (!isSupabaseConfigured) {
    return [];
  }
  const { data, error } = await supabase
    .from('campaign_drafts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) throw new Error(error.message);

  return ((data || []) as CampaignDraftRow[]).map((row) => ({
    id: row.id,
    status: row.status as CampaignDraft['status'],
    goal: row.goal,
    constraints: row.constraints,
    authoredBy: row.authored_by,
    approvedBy: row.approved_by || undefined,
    approvedAt: row.approved_at || undefined,
    aiSummary: row.ai_summary,
    recommendation: row.recommendation,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function saveCampaignDraft(input: Omit<CampaignDraft, 'id' | 'createdAt' | 'updatedAt'>) {
  const { data, error } = await supabase
    .from('campaign_drafts')
    .insert({
      status: input.status,
      goal: input.goal,
      constraints: input.constraints,
      authored_by: input.authoredBy,
      approved_by: input.approvedBy || null,
      approved_at: input.approvedAt || null,
      ai_summary: input.aiSummary,
      recommendation: input.recommendation,
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);

  const row = data as CampaignDraftRow;
  return {
    id: row.id,
    status: row.status as CampaignDraft['status'],
    goal: row.goal,
    constraints: row.constraints,
    authoredBy: row.authored_by,
    approvedBy: row.approved_by || undefined,
    approvedAt: row.approved_at || undefined,
    aiSummary: row.ai_summary,
    recommendation: row.recommendation,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  } as CampaignDraft;
}
