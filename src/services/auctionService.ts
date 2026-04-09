import { supabase } from '../supabase';
import type { AllocationSnapshot } from '../types';

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

export async function subscribeToAuctions(callback: (auctions: Auction[]) => void): Promise<() => void> {
  const { data } = await supabase
    .from('auctions')
    .select('*, bids:bids(*)')
    .eq('status', 'active')
    .order('endTime', { ascending: true })
    .limit(50);
  callback(data || []);

  const channel = supabase
    .channel('auctions-all')
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'auctions', filter: 'status=eq.active'
    }, () => {
      supabase.from('auctions').select('*, bids:bids(*)').eq('status', 'active')
        .order('endTime', { ascending: true }).limit(50)
        .then(({ data }) => callback(data || []));
    })
    .subscribe();

  return () => supabase.removeChannel(channel);
}

export async function subscribeToBids(
  auctionId: string,
  callback: (bids: Bid[]) => void
): Promise<() => void> {
  const { data } = await supabase
    .from('bids')
    .select('*')
    .eq('auctionId', auctionId)
    .order('createdAt', { ascending: false });
  callback(data || []);

  const channel = supabase
    .channel(`bids-${auctionId}`)
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'bids', filter: `auctionId=eq.${auctionId}`
    }, (payload) => {
      callback(prev => [payload.new as Bid, ...prev]);
    })
    .subscribe();

  return () => supabase.removeChannel(channel);
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
