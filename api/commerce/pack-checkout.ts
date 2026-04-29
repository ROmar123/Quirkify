import axios from 'axios';
import { requireVerifiedUser, sendAuthError } from '../_lib/auth.js';
import { normalizeEnvValue } from '../_lib/env.js';
import { ensureProfileByIdentity, expireStalePendingOrders, getSupabaseAdmin } from '../_lib/supabaseAdmin.js';
import { getShippingQuote } from '../_lib/shipping.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let createdOrderId: string | null = null;

  try {
    const verifiedUser = await requireVerifiedUser(req);
    const { phone, address, city, zip, packId, quantity } = req.body ?? {};

    if (!verifiedUser.email || !packId) {
      return res.status(400).json({ error: 'Missing required fields: packId' });
    }

    const qty = Math.max(1, Number(quantity) || 1);

    await expireStalePendingOrders();
    const profile = await ensureProfileByIdentity({
      firebaseUid: verifiedUser.uid,
      email: verifiedUser.email,
      displayName: verifiedUser.name,
    });

    const shippingQuote = await getShippingQuote({
      city: city ? String(city) : null,
      zip: zip ? String(zip) : null,
    });

    const supabase = getSupabaseAdmin();
    const { data: checkoutData, error: checkoutError } = await supabase.rpc('create_pack_checkout_order', {
      p_profile_id: profile.id,
      p_customer_email: verifiedUser.email,
      p_customer_name: profile.display_name || verifiedUser.name || verifiedUser.email,
      p_customer_phone: phone ? String(phone) : null,
      p_shipping_address: address ? String(address) : null,
      p_shipping_city: city ? String(city) : null,
      p_shipping_zip: zip ? String(zip) : null,
      p_shipping_cost: shippingQuote.price,
      p_pack_id: String(packId),
      p_quantity: qty,
    });

    if (checkoutError) {
      return res.status(400).json({ error: checkoutError.message });
    }

    const checkoutRow = Array.isArray(checkoutData) ? checkoutData[0] : checkoutData;
    if (!checkoutRow?.order_id || !checkoutRow?.total) {
      return res.status(500).json({ error: 'Pack checkout order was not created correctly' });
    }
    createdOrderId = checkoutRow.order_id;

    const yocoSecretKey = normalizeEnvValue(process.env.YOCO_SECRET_KEY);
    if (!yocoSecretKey) {
      return res.status(500).json({ error: 'Payment system not configured' });
    }

    const origin = req.headers.origin || `https://${req.headers.host}`;
    const amountCents = Math.round(Number(checkoutRow.total) * 100);

    const yocoResponse = await axios.post('https://payments.yoco.com/api/checkouts', {
      amount: amountCents,
      currency: 'ZAR',
      successUrl: `${origin}/payment/success?orderId=${checkoutRow.order_id}`,
      cancelUrl: `${origin}/payment/cancel?orderId=${checkoutRow.order_id}`,
      metadata: {
        orderId: checkoutRow.order_id,
        orderNumber: checkoutRow.order_number,
        itemName: checkoutRow.item_name,
        channel: 'pack',
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
      await supabase.rpc('cancel_pending_order', {
        p_order_id: checkoutRow.order_id,
        p_note: 'checkout_session_creation_failed',
      });
      return res.status(502).json({ error: 'Payment provider did not return a valid checkout session' });
    }

    const { error: updateError } = await supabase
      .from('orders')
      .update({ checkout_session_id: checkoutSessionId, payment_status: 'redirected' })
      .eq('id', checkoutRow.order_id);

    if (updateError) {
      await supabase.rpc('cancel_pending_order', {
        p_order_id: checkoutRow.order_id,
        p_note: 'checkout_order_update_failed',
      });
      return res.status(500).json({ error: updateError.message });
    }

    return res.status(200).json({
      orderId: checkoutRow.order_id,
      orderNumber: checkoutRow.order_number,
      total: checkoutRow.total,
      shippingQuote,
      redirectUrl: yocoResponse.data?.redirectUrl,
      reservationExpiresAt: checkoutRow.reservation_expires_at,
    });
  } catch (error: any) {
    if (error?.statusCode === 401) {
      return sendAuthError(res, error);
    }
    const message =
      error?.response?.data?.message ||
      error?.response?.data?.error ||
      error?.message ||
      'Failed to start pack checkout';
    console.error('Pack checkout error:', message);
    try {
      if (createdOrderId) {
        const supabase = getSupabaseAdmin();
        await supabase.rpc('cancel_pending_order', {
          p_order_id: String(createdOrderId),
          p_note: 'checkout_redirect_failed',
        });
      }
    } catch (cleanupError) {
      console.error('Failed to release pending pack checkout after error:', cleanupError);
    }
    return res.status(500).json({ error: message });
  }
}
