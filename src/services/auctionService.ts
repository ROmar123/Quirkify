import { isSupabaseConfigured, supabase } from '../supabase';
import { rowToProduct } from './productService';
import type { Auction, Bid, Product } from '../types';

// ── Row mappers ────────────────────────────────────────────────────────────

function rowToAuction(row: any): Auction {
  const product = row.product ? rowToProduct(row.product) : undefined;
  return {
    id: row.id,
    productId: row.product_id,
    product,
    title: product?.name || product?.title || `Lot #${String(row.id).slice(-6).toUpperCase()}`,
    heroImage: product?.imageUrl || product?.media?.[0]?.url,
    status: row.status,
    startsAt: row.start_time,
    endsAt: row.end_time,
    startTime: row.start_time,
    endTime: row.end_time,
    currentBid: Number(row.current_highest_bid ?? row.start_price ?? 0),
    startPrice: Number(row.start_price ?? 0),
    reservePrice: row.reserve_price != null ? Number(row.reserve_price) : undefined,
    increment: Number(row.increment ?? 50),
    bidCount: Number(row.bid_count ?? 0),
    highestBidderId: row.highest_bidder_id ?? null,
    winnerOrderId: row.winner_order_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToBid(row: any): Bid {
  const bidder = row.bidder || {};
  return {
    id: row.id,
    auctionId: row.auction_id,
    bidderId: row.bidder_id,
    bidderName: bidder.display_name || bidder.email || 'Bidder',
    amount: Number(row.amount),
    createdAt: row.timestamp,
    updatedAt: row.timestamp,
  };
}

const AUCTION_SELECT = '*, product:products(*)';
const BID_SELECT = '*, bidder:profiles!bidder_id(display_name, email)';

// ── Reads ──────────────────────────────────────────────────────────────────

export async function listAuctions() {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('auctions')
    .select(AUCTION_SELECT)
    .order('start_time', { ascending: true })
    .limit(40);
  if (error) throw new Error(error.message);
  return (data || []).map(rowToAuction);
}

// ── Realtime subscriptions ─────────────────────────────────────────────────

export function subscribeToAuctions(
  callback: (auctions: Auction[]) => void,
  onError?: (message: string) => void,
) {
  if (!isSupabaseConfigured) {
    callback([]);
    onError?.('Realtime auctions are not configured for this environment.');
    return () => undefined;
  }

  let cancelled = false;

  const reload = async () => {
    try {
      const auctions = await listAuctions();
      if (!cancelled) callback(auctions);
    } catch (err) {
      if (!cancelled) {
        callback([]);
        onError?.(err instanceof Error ? err.message : 'Realtime auction data is unavailable');
      }
    }
  };

  void reload();

  const channel = supabase
    .channel('public:auctions')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'auctions' },
      () => { void reload(); },
    )
    .subscribe();

  return () => {
    cancelled = true;
    void supabase.removeChannel(channel);
  };
}

export function subscribeToBids(auctionId: string, callback: (bids: Bid[]) => void) {
  if (!isSupabaseConfigured) {
    callback([]);
    return () => undefined;
  }

  let cancelled = false;

  const reload = async () => {
    const { data, error } = await supabase
      .from('auction_bids')
      .select(BID_SELECT)
      .eq('auction_id', auctionId)
      .order('amount', { ascending: false })
      .limit(25);
    if (error) {
      if (!cancelled) callback([]);
      return;
    }
    if (!cancelled) callback((data || []).map(rowToBid));
  };

  void reload();

  const channel = supabase
    .channel(`bids:${auctionId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'auction_bids', filter: `auction_id=eq.${auctionId}` },
      () => { void reload(); },
    )
    .subscribe();

  return () => {
    cancelled = true;
    void supabase.removeChannel(channel);
  };
}

// ── Bid placement (atomic RPC) ─────────────────────────────────────────────

const BID_ERROR_MAP: Array<[RegExp, (m: RegExpMatchArray) => string]> = [
  [/^AUCTION_NOT_FOUND/,        () => 'Auction not found'],
  [/^AUCTION_NOT_LIVE/,         () => 'Auction is not live'],
  [/^AUCTION_ENDED/,            () => 'Auction has ended'],
  [/^ALREADY_HIGHEST_BIDDER/,   () => "You're already the highest bidder"],
  [/^WALLET_NOT_FOUND/,         () => 'Top up your wallet to bid'],
  [/^BID_TOO_LOW: minimum is (\S+)/, (m) => `Minimum bid is R${m[1]}`],
  [/^INSUFFICIENT_BALANCE: have (\S+) need (\S+)/, (m) => `Insufficient balance — you have R${m[1]} and need R${m[2]}`],
];

function humanizeBidError(message: string): string {
  for (const [re, format] of BID_ERROR_MAP) {
    const match = message.match(re);
    if (match) return format(match);
  }
  return message;
}

export async function placeBid(auctionId: string, amount: number): Promise<{ error: Error | null }> {
  if (!isSupabaseConfigured) {
    return { error: new Error('Bidding requires Supabase configuration') };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: new Error('Sign in to bid') };

  const { error } = await supabase.rpc('place_auction_bid', {
    p_auction_id: auctionId,
    p_bidder_id: user.id,
    p_amount: amount,
  });

  if (error) return { error: new Error(humanizeBidError(error.message)) };
  return { error: null };
}

// ── Auction creation ───────────────────────────────────────────────────────

export async function createAuctionFromProduct(params: {
  product: Product;
  startsAt: string;
  endsAt: string;
  startPrice: number;
  reservePrice?: number;
  increment?: number;
  createdBy?: string; // accepted for API compatibility; not stored
}) {
  if (!isSupabaseConfigured) {
    throw new Error('Auctions require Supabase configuration');
  }

  const status = new Date(params.startsAt).getTime() <= Date.now() ? 'live' : 'scheduled';

  const { data, error } = await supabase
    .from('auctions')
    .insert({
      product_id: params.product.id,
      start_price: params.startPrice,
      reserve_price: params.reservePrice ?? null,
      start_time: params.startsAt,
      end_time: params.endsAt,
      status,
      increment: params.increment ?? 50,
      current_highest_bid: 0,
      bid_count: 0,
    })
    .select(AUCTION_SELECT)
    .single();

  if (error) throw new Error(error.message);
  return rowToAuction(data);
}

// Backwards-compatible alias used by Inventory
export async function createAuction(params: {
  product: Product;
  productId?: string;
  startsAt?: string;
  endsAt?: string;
  startTime?: string;
  endTime?: string;
  startPrice: number;
  reservePrice?: number;
  increment?: number;
  createdBy?: string;
  sellerId?: string;
}) {
  return createAuctionFromProduct({
    product: params.product,
    startsAt: params.startsAt || params.startTime || new Date().toISOString(),
    endsAt: params.endsAt || params.endTime || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    startPrice: params.startPrice,
    reservePrice: params.reservePrice,
    increment: params.increment,
  });
}

// ── Settlement ─────────────────────────────────────────────────────────────

export async function closeAuction(auctionId: string) {
  const response = await fetch('/api/commerce/auction-close', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ auctionId }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to close auction');
  return data;
}

// ── Live sessions (UI prototype, Firestore — see liveSessionService.ts) ────
// Re-export for backwards compat. New code should import from liveSessionService directly.
export { listLiveSessions, createLiveSession, advanceLiveSession } from './liveSessionService';
