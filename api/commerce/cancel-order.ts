import axios from 'axios';
import { requireVerifiedUser, sendAuthError } from '../_lib/auth.js';
import { normalizeEnvValue } from '../_lib/env.js';
import { expireStalePendingOrders, getSupabaseAdmin } from '../_lib/supabaseAdmin.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const verifiedUser = await requireVerifiedUser(req);
    const { orderId, reason, action } = req.body ?? {};

    if (!orderId) {
      return res.status(400).json({ error: 'Missing orderId' });
    }

    await expireStalePendingOrders();
    const supabase = getSupabaseAdmin();

    if (action === 'resume') {
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('id, order_number, status, total, source_ref, channel, profile_id')
        .eq('id', String(orderId))
        .single();

      if (orderError || !order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      if (order.channel !== 'store' || order.source_ref === 'wallet_topup') {
        return res.status(400).json({ error: 'Only active store checkouts can be resumed' });
      }

      if (!verifiedUser.isAdmin && order.profile_id !== verifiedUser.profileId) {
        return res.status(403).json({ error: 'Order access denied' });
      }

      if (order.status !== 'pending') {
        return res.status(400).json({ error: 'Only pending orders can be resumed' });
      }

      const { data: orderItems, error: itemsError } = await supabase
        .from('order_items')
        .select('product_name')
        .eq('order_id', String(orderId))
        .order('created_at', { ascending: true })
        .limit(1);

      if (itemsError) {
        return res.status(400).json({ error: itemsError.message });
      }

      const yocoSecretKey = normalizeEnvValue(process.env.YOCO_SECRET_KEY);
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
    }

    const { data: currentOrder, error: currentOrderError } = await supabase
      .from('orders')
      .select('id, profile_id')
      .eq('id', String(orderId))
      .single();

    if (currentOrderError || !currentOrder) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (!verifiedUser.isAdmin && currentOrder.profile_id !== verifiedUser.profileId) {
      return res.status(403).json({ error: 'Order access denied' });
    }

    const { data, error } = await supabase.rpc('cancel_pending_order', {
      p_order_id: String(orderId),
      p_note: reason ? String(reason) : 'customer_cancelled_from_orders',
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({ order: Array.isArray(data) ? data[0] : data });
  } catch (error: any) {
    if (error?.statusCode === 401) {
      return sendAuthError(res, error);
    }
    const message = error?.message || 'Failed to cancel order';
    console.error('Cancel order error:', message);
    return res.status(500).json({ error: message });
  }
}
