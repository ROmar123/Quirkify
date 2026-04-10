import { getSupabaseAdmin } from '../_lib/supabaseAdmin';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const orderId = String(req.query?.orderId || '').trim();
    if (!orderId) {
      return res.status(400).json({ error: 'Missing orderId' });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('orders')
      .select('id, order_number, status, payment_status, total, checkout_session_id, reservation_expires_at, created_at, updated_at')
      .eq('id', orderId)
      .maybeSingle();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    if (!data) {
      return res.status(404).json({ error: 'Order not found' });
    }

    return res.status(200).json({ order: data });
  } catch (error: any) {
    const message = error?.message || 'Failed to load order status';
    console.error('Order status error:', message);
    return res.status(500).json({ error: message });
  }
}
