import { supabase } from '../supabase';
import type { AllocationSnapshot } from '../types';

let auctionSubscriptionSequence = 0;
let bidSubscriptionSequence = 0;

export interface Bid {
  id: string;
  auctionId: string;
  bidderId: string;
  amount: number;
  createdAt: string;
}

export interface Auction {
  id: string;
  productId: string;
  startingPrice: number;
  currentPrice: number;
  endTime: string;
  status: 'active' | 'ended' | 'scheduled';
  winnerId?: string;
  bids: Bid[];
}

export function subscribeToAuctions(callback: (auctions: Auction[]) => void): () => void {
  const loadAuctions = () => {
    void supabase
      .from('auctions')
      .select('*, bids:bids(*)')
      .eq('status', 'active')
      .order('endTime', { ascending: true })
      .limit(50)
      .then(({ data, error }) => {
        if (error) {
          console.error('Failed to load auctions:', error);
          callback([]);
          return;
        }
        callback(data || []);
      });
  };

  loadAuctions();

  const channel = supabase
    .channel(`auctions-all:${++auctionSubscriptionSequence}`)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'auctions', filter: 'status=eq.active'
    }, loadAuctions)
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeToBids(
  auctionId: string,
  callback: (bids: Bid[]) => void
): () => void {
  const loadBids = () => {
    void supabase
      .from('bids')
      .select('*')
      .eq('auctionId', auctionId)
      .order('createdAt', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          console.error(`Failed to load bids for auction ${auctionId}:`, error);
          callback([]);
          return;
        }
        callback(data || []);
      });
  };

  loadBids();

  const channel = supabase
    .channel(`bids:${auctionId}:${++bidSubscriptionSequence}`)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'bids', filter: `auctionId=eq.${auctionId}`
    }, loadBids)
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export async function placeBid(
  auctionId: string,
  bidderId: string,
  amount: number
): Promise<{ error: any }> {
  const { error } = await supabase.from('bids').insert([{
    auctionId,
    bidderId,
    amount,
    createdAt: new Date().toISOString()
  }]);
  if (error) return { error };
  // Update auction current price
  await supabase.from('auctions').update({ currentPrice: amount }).eq('id', auctionId);
  return { error: null };
}

export async function concludeAuction(
  auctionId: string,
  winnerId: string,
  finalPrice: number
): Promise<{ error: any }> {
  const { error } = await supabase.from('auctions').update({
    status: 'ended',
    winnerId,
    currentPrice: finalPrice
  }).eq('id', auctionId);
  return { error };
}
