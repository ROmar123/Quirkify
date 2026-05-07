import { requireVerifiedUser, sendAuthError } from '../_lib/auth.js';
import { ensureProfileByIdentity, getSupabaseAdmin } from '../_lib/supabaseAdmin.js';
import { getAdminDb } from '../_lib/firebaseAdmin.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let verifiedUser: Awaited<ReturnType<typeof requireVerifiedUser>>;
  try {
    verifiedUser = await requireVerifiedUser(req);
  } catch (err: any) {
    return sendAuthError(res, err);
  }

  const { auctionId, amount } = req.body ?? {};
  if (!auctionId || !amount) return res.status(400).json({ error: 'Missing auctionId or amount' });

  const bidAmount = Number(amount);
  if (!Number.isFinite(bidAmount) || bidAmount <= 0)
    return res.status(400).json({ error: 'Invalid bid amount' });

  const supabase = getSupabaseAdmin();

  const profile = await ensureProfileByIdentity({
    firebaseUid: verifiedUser.uid,
    email: verifiedUser.email!,
    displayName: verifiedUser.name,
  });

  const { error } = await supabase.rpc('place_auction_bid', {
    p_auction_id: auctionId,
    p_bidder_id: profile.id,
    p_amount: bidAmount,
  });

  if (error) {
    const msg = error.message || '';
    if (msg.includes('INSUFFICIENT_BALANCE'))
      return res.status(402).json({ error: 'Insufficient wallet balance', code: 'INSUFFICIENT_BALANCE' });
    if (msg.includes('BID_TOO_LOW'))
      return res.status(409).json({ error: msg, code: 'BID_TOO_LOW' });
    if (msg.includes('AUCTION_ENDED'))
      return res.status(409).json({ error: 'Auction has ended', code: 'AUCTION_ENDED' });
    if (msg.includes('AUCTION_NOT_LIVE'))
      return res.status(409).json({ error: 'Auction is not live', code: 'AUCTION_NOT_LIVE' });
    if (msg.includes('ALREADY_HIGHEST_BIDDER'))
      return res.status(409).json({ error: 'You are already the highest bidder', code: 'ALREADY_HIGHEST_BIDDER' });
    return res.status(400).json({ error: msg });
  }

  // Broadcast updated bid to Firestore for real-time UI
  try {
    const { data: auction } = await supabase
      .from('auctions')
      .select('current_highest_bid, bid_count')
      .eq('id', auctionId)
      .single();

    const adminDb = getAdminDb();
    await adminDb.collection('auctions').doc(auctionId).update({
      currentBid: auction?.current_highest_bid ?? bidAmount,
      bidCount: auction?.bid_count ?? 1,
      highestBidderId: verifiedUser.uid,
      updatedAt: new Date().toISOString(),
    });
  } catch {
    // Firestore broadcast failure is non-fatal — Supabase is authoritative
  }

  return res.status(200).json({ success: true, amount: bidAmount });
}
