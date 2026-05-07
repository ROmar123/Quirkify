import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js';
import { getAdminDb } from '../_lib/firebaseAdmin.js';
import { sendOrderStatusEmail } from '../_lib/orderNotifications.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers['authorization'] ?? '';
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`)
    return res.status(401).json({ error: 'Unauthorized' });

  const supabase = getSupabaseAdmin();

  // Mark all live auctions past their end_time as ended
  await supabase
    .from('auctions')
    .update({ status: 'ended' })
    .eq('status', 'live')
    .lte('end_time', new Date().toISOString());

  // Fetch all auctions awaiting settlement
  const { data: toSettle, error: fetchError } = await supabase
    .from('auctions')
    .select('id')
    .eq('status', 'ended');

  if (fetchError) {
    console.error('[settle-auctions] fetch error:', fetchError.message);
    return res.status(500).json({ error: fetchError.message });
  }

  if (!toSettle || toSettle.length === 0)
    return res.status(200).json({ settled: 0 });

  const results: any[] = [];

  for (const auction of toSettle) {
    try {
      const { data: result, error: settleError } = await supabase.rpc('settle_auction', {
        p_auction_id: auction.id,
      });

      if (settleError) {
        console.error(`[settle-auctions] settle_auction failed for ${auction.id}:`, settleError.message);
        results.push({ auctionId: auction.id, error: settleError.message });
        continue;
      }

      // Broadcast result to Firestore for UI
      try {
        const adminDb = getAdminDb();
        await adminDb.collection('auctions').doc(auction.id).update({
          status: result?.status ?? 'ended',
          winnerOrderId: result?.orderId ?? null,
          settledAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      } catch {
        // Firestore broadcast failure is non-fatal
      }

      // Send winner email if auction completed
      if (result?.status === 'completed' && result?.orderId) {
        try {
          await sendOrderStatusEmail(result.orderId, 'paid');
        } catch (emailErr: any) {
          console.warn(`[settle-auctions] email failed for order ${result.orderId}:`, emailErr.message);
        }
      }

      results.push({ auctionId: auction.id, ...result });
    } catch (err: any) {
      console.error(`[settle-auctions] unexpected error for ${auction.id}:`, err.message);
      results.push({ auctionId: auction.id, error: err.message });
    }
  }

  return res.status(200).json({ settled: results.length, results });
}
