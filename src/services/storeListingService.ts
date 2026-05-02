import { supabase } from '../supabase';

export interface StoreListing {
  id: string;
  productId: string;
  title: string;
  description: string;
  images: string[];
  retailPrice: number;
  sellingPrice: number;
  discountPercent: number;
  quantityTotal: number;
  quantityRemaining: number;
  status: 'draft' | 'published' | 'paused' | 'sold_out' | 'removed';
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  // joined from products
  condition?: string;
  category?: string;
}

function rowToListing(row: any): StoreListing {
  return {
    id: row.id,
    productId: row.product_id,
    title: row.title,
    description: row.description || '',
    images: row.images || [],
    retailPrice: Number(row.retail_price),
    sellingPrice: Number(row.selling_price),
    discountPercent: Number(row.discount_percent || 0),
    quantityTotal: Number(row.quantity_total),
    quantityRemaining: Number(row.quantity_remaining),
    status: row.status,
    publishedAt: row.published_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    condition: row.products?.condition,
    category: row.products?.category,
  };
}

/** Customer store: published listings with stock available */
export async function fetchPublishedListings(): Promise<StoreListing[]> {
  const { data, error } = await supabase
    .from('store_listings')
    .select('*, products(condition, category)')
    .eq('status', 'published')
    .gt('quantity_remaining', 0)
    .order('published_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map(rowToListing);
}

/** Admin: all listings, optionally filtered by status */
export async function fetchAllListings(status?: StoreListing['status']): Promise<StoreListing[]> {
  let query = supabase
    .from('store_listings')
    .select('*, products(condition, category)')
    .order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data || []).map(rowToListing);
}

/** Admin: listings for a specific product */
export async function fetchListingsForProduct(productId: string): Promise<StoreListing[]> {
  const { data, error } = await supabase
    .from('store_listings')
    .select('*')
    .eq('product_id', productId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map(rowToListing);
}

/** Admin: create a new draft store listing */
export async function createStoreListing(params: {
  productId: string;
  title: string;
  description?: string;
  images: string[];
  retailPrice: number;
  sellingPrice: number;
  quantityTotal: number;
  publish?: boolean;
}): Promise<StoreListing> {
  const { data, error } = await supabase
    .from('store_listings')
    .insert({
      product_id: params.productId,
      title: params.title.trim(),
      description: params.description?.trim() || null,
      images: params.images,
      retail_price: params.retailPrice,
      selling_price: params.sellingPrice,
      quantity_total: params.quantityTotal,
      quantity_remaining: params.quantityTotal,
      status: params.publish ? 'published' : 'draft',
      published_at: params.publish ? new Date().toISOString() : null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToListing(data);
}

/** Admin: publish a draft listing */
export async function publishListing(listingId: string): Promise<StoreListing> {
  const { data, error } = await supabase.rpc('publish_store_listing', {
    p_listing_id: listingId,
  });
  if (error) throw new Error(error.message);
  return rowToListing(data);
}

/** Admin: pause or un-pause a listing */
export async function setListingStatus(
  listingId: string,
  status: 'published' | 'paused' | 'removed'
): Promise<StoreListing> {
  const { data, error } = await supabase
    .from('store_listings')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', listingId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToListing(data);
}

export interface WalletAccount {
  id: string;
  profileId: string;
  availableBalance: number;
  heldBalance: number;
  status: string;
}

export interface WalletLedgerEntry {
  id: string;
  direction: 'credit' | 'debit';
  entryType: string;
  amount: number;
  availableBalanceAfter: number;
  referenceType: string | null;
  referenceId: string | null;
  createdAt: string;
}

/** Get wallet for the current user */
export async function fetchMyWallet(): Promise<WalletAccount | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('auth_uid', user.id)
    .maybeSingle();
  if (!profile) return null;

  const { data, error } = await supabase
    .from('wallet_accounts')
    .select('*')
    .eq('profile_id', profile.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    id: data.id,
    profileId: data.profile_id,
    availableBalance: Number(data.available_balance),
    heldBalance: Number(data.held_balance),
    status: data.status,
  };
}

/** Get wallet ledger (transaction history) for the current user */
export async function fetchMyLedger(limit = 30): Promise<WalletLedgerEntry[]> {
  const wallet = await fetchMyWallet();
  if (!wallet) return [];

  const { data, error } = await supabase
    .from('wallet_ledger')
    .select('*')
    .eq('wallet_account_id', wallet.id)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);

  return (data || []).map((r: any) => ({
    id: r.id,
    direction: r.direction,
    entryType: r.entry_type,
    amount: Number(r.amount),
    availableBalanceAfter: Number(r.available_balance_after),
    referenceType: r.reference_type || null,
    referenceId: r.reference_id || null,
    createdAt: r.created_at,
  }));
}
