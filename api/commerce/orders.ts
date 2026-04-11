import { expireStalePendingOrders, getSupabaseAdmin } from '../_lib/supabaseAdmin';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await expireStalePendingOrders();

    const profileId = typeof req.query?.profileId === 'string' ? req.query.profileId.trim() : '';
    const status = typeof req.query?.status === 'string' ? req.query.status.trim() : '';
    const channel = typeof req.query?.channel === 'string' ? req.query.channel.trim() : '';
    const limitRaw = typeof req.query?.limit === 'string' ? Number(req.query.limit) : null;
    const limit = Number.isFinite(limitRaw) && limitRaw && limitRaw > 0 ? Math.min(limitRaw, 200) : null;

    const supabase = getSupabaseAdmin();
    let query = supabase.from('orders').select('*').order('created_at', { ascending: false });

    if (profileId) query = query.eq('profile_id', profileId);
    if (status) query = query.eq('status', status);
    if (channel) query = query.eq('channel', channel);
    if (limit) query = query.limit(limit);

    const { data: orders, error: ordersError } = await query;
    if (ordersError) {
      return res.status(400).json({ error: ordersError.message });
    }

    const orderIds = (orders || []).map((order) => order.id);
    if (orderIds.length === 0) {
      return res.status(200).json({ orders: [], itemsByOrder: {} });
    }

    const { data: allItems, error: itemsError } = await supabase
      .from('order_items')
      .select('*')
      .in('order_id', orderIds);

    if (itemsError) {
      return res.status(400).json({ error: itemsError.message });
    }

    const itemsByOrder = (allItems || []).reduce((acc: Record<string, any[]>, item) => {
      (acc[item.order_id] = acc[item.order_id] || []).push(item);
      return acc;
    }, {});

    return res.status(200).json({ orders: orders || [], itemsByOrder });
  } catch (error: any) {
    const message = error?.message || 'Failed to load orders';
    console.error('Orders list error:', message);
    return res.status(500).json({ error: message });
  }
}
