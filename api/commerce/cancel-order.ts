import { expireStalePendingOrders, getSupabaseAdmin } from '../_lib/supabaseAdmin';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { orderId, reason } = req.body ?? {};

    if (!orderId) {
      return res.status(400).json({ error: 'Missing orderId' });
    }

    await expireStalePendingOrders();
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc('cancel_pending_order', {
      p_order_id: String(orderId),
      p_note: reason ? String(reason) : 'customer_cancelled_from_orders',
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({ order: Array.isArray(data) ? data[0] : data });
  } catch (error: any) {
    const message = error?.message || 'Failed to cancel order';
    console.error('Cancel order error:', message);
    return res.status(500).json({ error: message });
  }
}
