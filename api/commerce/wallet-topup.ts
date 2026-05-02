import axios from 'axios';
import { requireVerifiedUser, sendAuthError } from '../_lib/auth.js';
import { normalizeEnvValue } from '../_lib/env.js';
import { ensureProfileByIdentity, getSupabaseAdmin } from '../_lib/supabaseAdmin.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const verifiedUser = await requireVerifiedUser(req);
    if (!verifiedUser) return sendAuthError(res);

    const { amount } = req.body ?? {};
    const topupAmount = Number(amount);
    if (!topupAmount || topupAmount < 10 || topupAmount > 50000) {
      return res.status(400).json({ error: 'Amount must be between R10 and R50,000' });
    }

    const yocoSecretKey = normalizeEnvValue(process.env.YOCO_SECRET_KEY);
    if (!yocoSecretKey) {
      return res.status(503).json({ error: 'Payment system not configured' });
    }

    const profile = await ensureProfileByIdentity({
      firebaseUid: verifiedUser.uid,
      email: verifiedUser.email!,
      displayName: verifiedUser.name,
    });

    const supabase = getSupabaseAdmin();

    // Create a wallet topup order (no items)
    const orderNumber = `QRK-TOPUP-${Date.now()}`;
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        profile_id: profile.id,
        customer_email: verifiedUser.email,
        customer_name: profile.display_name || verifiedUser.email,
        channel: 'store',
        source_ref: 'wallet_topup',
        subtotal: topupAmount,
        discount: 0,
        shipping_cost: 0,
        payment_method: 'yoco',
        payment_status: 'initiated',
        status: 'pending',
        reservation_expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      })
      .select('id')
      .single();

    if (orderError) throw new Error(orderError.message);

    const origin = req.headers.origin || `https://${req.headers.host}`;
    const amountCents = Math.round(topupAmount * 100);

    const yocoResponse = await axios.post(
      'https://payments.yoco.com/api/checkouts',
      {
        amount: amountCents,
        currency: 'ZAR',
        successUrl: `${origin}/payment-result?orderId=${order.id}`,
        cancelUrl: `${origin}/payment-result?orderId=${order.id}&cancelled=true`,
        metadata: { orderId: order.id, type: 'wallet_topup' },
      },
      {
        headers: {
          Authorization: `Bearer ${yocoSecretKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return res.status(200).json({
      redirectUrl: yocoResponse.data.redirectUrl,
      orderId: order.id,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to initiate top-up' });
  }
}
