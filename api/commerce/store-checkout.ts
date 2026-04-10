import axios from 'axios';
import { ensureProfileByIdentity, getSupabaseAdmin } from '../_lib/supabaseAdmin';
import { getShippingQuote } from '../_lib/shipping';

interface CheckoutItemInput {
  productId: string;
  quantity: number;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let createdOrderId: string | null = null;

  try {
    const {
      firebaseUid,
      email,
      displayName,
      phone,
      address,
      city,
      zip,
      items,
    } = req.body ?? {};

    if (!firebaseUid || !email || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Missing required checkout fields' });
    }

    const normalizedItems: CheckoutItemInput[] = items.map((item: any) => ({
      productId: String(item?.productId || ''),
      quantity: Number(item?.quantity || 0),
    }));

    if (normalizedItems.some((item) => !item.productId || item.quantity <= 0)) {
      return res.status(400).json({ error: 'Invalid checkout items' });
    }

    const profile = await ensureProfileByIdentity({
      firebaseUid: String(firebaseUid),
      email: String(email),
      displayName: displayName ? String(displayName) : null,
    });

    const shippingQuote = await getShippingQuote({
      city: city ? String(city) : null,
      zip: zip ? String(zip) : null,
    });

    const supabase = getSupabaseAdmin();
    const { data: checkoutData, error: checkoutError } = await supabase.rpc('create_store_checkout_order', {
      p_profile_id: profile.id,
      p_customer_email: String(email),
      p_customer_name: displayName ? String(displayName) : String(email),
      p_customer_phone: phone ? String(phone) : null,
      p_shipping_address: address ? String(address) : null,
      p_shipping_city: city ? String(city) : null,
      p_shipping_zip: zip ? String(zip) : null,
      p_shipping_cost: shippingQuote.price,
      p_items: normalizedItems,
    });

    if (checkoutError) {
      return res.status(400).json({ error: checkoutError.message });
    }

    const checkoutRow = Array.isArray(checkoutData) ? checkoutData[0] : checkoutData;
    if (!checkoutRow?.order_id || !checkoutRow?.total) {
      return res.status(500).json({ error: 'Checkout order was not created correctly' });
    }
    createdOrderId = checkoutRow.order_id;

    const yocoSecretKey = process.env.YOCO_SECRET_KEY;
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
        p_note: 'Yoco checkout session could not be created',
      });
      return res.status(502).json({ error: 'Payment provider did not return a valid checkout session' });
    }

    const { error: updateError } = await supabase
        .from('orders')
        .update({
          checkout_session_id: checkoutSessionId,
          payment_status: 'redirected',
        })
        .eq('id', checkoutRow.order_id);
    if (updateError) {
      await supabase.rpc('cancel_pending_order', {
        p_order_id: checkoutRow.order_id,
        p_note: 'Checkout session created but order could not be updated',
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
    const message = error?.response?.data?.message || error?.response?.data?.error || error?.message || 'Failed to start checkout';
    console.error('Store checkout error:', message);
    try {
      if (createdOrderId) {
        const supabase = getSupabaseAdmin();
        await supabase.rpc('cancel_pending_order', {
          p_order_id: String(createdOrderId),
          p_note: 'Checkout failed before redirecting to Yoco',
        });
      }
    } catch (cleanupError) {
      console.error('Failed to release pending checkout after store-checkout error:', cleanupError);
    }
    return res.status(500).json({ error: message });
  }
}
