import axios from 'axios';
import { expireStalePendingOrders, getSupabaseAdmin } from '../_lib/supabaseAdmin';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const orderId = String(req.body?.orderId || '').trim();

    if (!orderId) {
      return res.status(400).json({ error: 'Missing orderId' });
    }

    await expireStalePendingOrders();
    const supabase = getSupabaseAdmin();
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, order_number, status, total, checkout_session_id, reservation_expires_at, source_ref, channel')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.channel !== 'store' || order.source_ref === 'wallet_topup') {
      return res.status(400).json({ error: 'Only active store checkouts can be resumed' });
    }

    if (order.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending orders can be resumed' });
    }

    const { data: orderItems, error: itemsError } = await supabase
      .from('order_items')
      .select('product_name')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true })
      .limit(1);

    if (itemsError) {
      return res.status(400).json({ error: itemsError.message });
    }

    const yocoSecretKey = process.env.YOCO_SECRET_KEY;
    if (!yocoSecretKey) {
      return res.status(500).json({ error: 'Payment system not configured' });
    }

    const origin = req.headers.origin || `https://${req.headers.host}`;
    const amountCents = Math.round(Number(order.total) * 100);
    const itemName = orderItems?.[0]?.product_name || `Quirkify Order ${order.order_number}`;

    const yocoResponse = await axios.post('https://payments.yoco.com/api/checkouts', {
      amount: amountCents,
      currency: 'ZAR',
      successUrl: `${origin}/payment/success?orderId=${order.id}`,
      cancelUrl: `${origin}/payment/cancel?orderId=${order.id}`,
      metadata: {
        orderId: order.id,
        orderNumber: order.order_number,
        itemName,
      },
    }, {
      headers: {
        Authorization: `Bearer ${yocoSecretKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    const checkoutSessionId = yocoResponse.data?.id || null;
    if (!checkoutSessionId || !yocoResponse.data?.redirectUrl) {
      return res.status(502).json({ error: 'Payment provider did not return a valid checkout session' });
    }

    const { error: updateError } = await supabase
      .from('orders')
      .update({
        checkout_session_id: checkoutSessionId,
        payment_status: 'redirected',
      })
      .eq('id', order.id);

    if (updateError) {
      return res.status(400).json({ error: updateError.message });
    }

    await supabase.rpc('log_order_event', {
      p_order_id: order.id,
      p_event_type: 'checkout_resumed',
      p_from_status: order.status,
      p_to_status: order.status,
      p_note: 'customer_resumed_checkout',
      p_metadata: {
        checkout_session_id: checkoutSessionId,
      },
    });

    return res.status(200).json({
      orderId: order.id,
      redirectUrl: yocoResponse.data.redirectUrl,
    });
  } catch (error: any) {
    const message = error?.response?.data?.message || error?.response?.data?.error || error?.message || 'Failed to resume checkout';
    console.error('Resume checkout error:', message);
    return res.status(500).json({ error: message });
  }
}
