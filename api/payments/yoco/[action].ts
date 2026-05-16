// Merged Yoco handler — routes /api/payments/yoco/initiate and /api/payments/yoco/webhook
import axios from 'axios';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { requireVerifiedUser, sendAuthError } from '../../_lib/auth.js';
import { normalizeEnvValue } from '../../_lib/env.js';
import { getSupabaseAdmin } from '../../_lib/supabaseAdmin.js';
import { sendOrderStatusEmail, sendWalletTopupEmail } from '../../_lib/orderNotifications';
import { withSentry } from '../../_lib/sentry';

// ─── Yoco initiate ─────────────────────────────────────────────────────────
async function handleInitiate(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const verifiedUser = await requireVerifiedUser(req);
    const { amount, item_name, m_payment_id } = req.body;

    if (!amount || !m_payment_id) return res.status(400).json({ error: 'Missing required fields' });

    const supabase = getSupabaseAdmin();
    const { data: order, error: orderError } = await supabase
      .from('orders').select('id, profile_id, total, source_ref, channel, status')
      .eq('id', String(m_payment_id)).single();
    if (orderError || !order) return res.status(404).json({ error: 'Order not found' });
    if (!verifiedUser.isAdmin && order.profile_id !== verifiedUser.profileId)
      return res.status(403).json({ error: 'Order access denied' });
    if (order.source_ref !== 'wallet_topup')
      return res.status(400).json({ error: 'This payment route is only available for wallet top-ups' });
    if (Math.round(Number(order.total) * 100) !== Math.round(Number(amount) * 100))
      return res.status(400).json({ error: 'Payment amount does not match the order total' });

    const yocoSecretKey = normalizeEnvValue(process.env.YOCO_SECRET_KEY);
    if (!yocoSecretKey) return res.status(500).json({ error: 'Payment system not configured' });
    if (!yocoSecretKey.startsWith('sk_test_') && !yocoSecretKey.startsWith('sk_live_'))
      return res.status(500).json({ error: 'Invalid payment key configuration' });

    const origin = req.headers.origin || `https://${req.headers.host}`;
    const amountCents = Math.round(amount * 100);

    const response = await axios.post('https://payments.yoco.com/api/checkouts', {
      amount: amountCents,
      currency: 'ZAR',
      successUrl: `${origin}/payment/success?orderId=${m_payment_id}&amount=${amount}`,
      cancelUrl: `${origin}/payment/cancel?orderId=${m_payment_id}`,
      metadata: { orderId: m_payment_id, itemName: item_name },
    }, {
      headers: { Authorization: `Bearer ${yocoSecretKey}`, 'Content-Type': 'application/json' },
      timeout: 10000,
    });

    return res.json({ redirectUrl: response.data.redirectUrl });
  } catch (error: any) {
    if (error?.statusCode === 401) return sendAuthError(res, error);
    const status = error.response?.status;
    if (status === 401 || status === 403) return res.status(400).json({ error: 'Invalid payment credentials.' });
    if (status === 404) return res.status(400).json({ error: 'Payment service endpoint not found.' });
    return res.status(500).json({ error: 'Payment initiation failed. Please try again.' });
  }
}

// ─── Yoco webhook ──────────────────────────────────────────────────────────
interface YocoEvent {
  id: string;
  type: string;
  createdAt: number;
  data: {
    id: string;
    amount?: number;
    currency?: string;
    createdAt?: string;
    metadata?: { orderId?: string; [key: string]: unknown };
    failureReason?: string;
  };
}

function verifyYocoSignature(rawBody: Buffer, signature: string, secret: string): boolean {
  if (!secret) return false;
  try {
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (sigBuffer.length !== expectedBuffer.length) return false;
    return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

async function handlePaymentCompleted(event: YocoEvent): Promise<void> {
  const orderId = event.data?.metadata?.orderId;
  if (!orderId) return;

  const supabase = getSupabaseAdmin();
  const { data: currentOrder } = await supabase
    .from('orders').select('id, status, source_ref, profile_id, total').eq('id', orderId).maybeSingle();

  if (currentOrder && currentOrder.status !== 'pending') return; // idempotent

  const shouldCreditWallet = currentOrder?.status === 'pending'
    && currentOrder?.source_ref === 'wallet_topup'
    && !!currentOrder.profile_id;

  const { error } = await supabase.rpc('mark_order_payment_succeeded', {
    p_order_id: orderId,
    p_payment_id: event.data.id,
    p_payment_status: 'completed',
    p_provider_event_id: event.id,
    p_payload: { amount: event.data.amount, currency: event.data.currency, createdAt: event.data.createdAt, metadata: event.data.metadata || {} },
  });
  if (error) throw new Error(error.message);

  if (shouldCreditWallet && currentOrder?.profile_id) {
    const { error: walletError } = await supabase.rpc('wallet_credit', {
      p_profile_id: currentOrder.profile_id,
      p_amount: Number(currentOrder.total || 0),
      p_entry_type: 'topup',
      p_reference_type: 'order',
      p_reference_id: orderId,
      p_metadata: { yoco_payment_id: event.data.id },
    });
    if (walletError) throw new Error(walletError.message);

    // Send wallet top-up confirmation email (non-blocking)
    const { data: orderFull } = await supabase
      .from('orders').select('customer_email, customer_name, total').eq('id', orderId).single();
    if (orderFull?.customer_email) {
      void sendWalletTopupEmail(orderFull.customer_email, orderFull.customer_name || '', Number(orderFull.total || 0)).catch(() => {});
    }
    return; // Don't send order paid email for wallet top-ups
  }

  if (!shouldCreditWallet && currentOrder?.profile_id) {
    const { data: items } = await supabase
      .from('order_items').select('product_id, unit_price, quantity').eq('order_id', orderId);
    if (items && items.length > 0) {
      const collectionRows = items.flatMap((item: any) =>
        Array.from({ length: item.quantity ?? 1 }, () => ({
          profile_id: currentOrder.profile_id,
          product_id: item.product_id,
          purchase_price: Number(item.unit_price) || 0,
          acquired_at: new Date().toISOString(),
        }))
      );
      await supabase.from('collection_items').insert(collectionRows);
    }
  }

  try { await sendOrderStatusEmail(orderId, 'paid'); } catch (e) { console.warn('Email send failed:', e); }
}

async function handlePaymentFailed(event: YocoEvent): Promise<void> {
  const orderId = event.data?.metadata?.orderId;
  if (!orderId) return;

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.rpc('mark_order_payment_failed', {
    p_order_id: orderId,
    p_payment_status: event.data.failureReason || 'failed',
    p_provider_event_id: event.id,
    p_payload: { failureReason: event.data.failureReason || null, metadata: event.data.metadata || {} },
  });
  if (error) throw new Error(error.message);
  try { await sendOrderStatusEmail(orderId, 'payment_failed'); } catch (e) { console.warn('Email send failed:', e); }
}

async function handleWebhook(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body));
  const signatureHeader = req.headers['x-yoco-signature'] as string | null;

  if (!signatureHeader) return res.status(401).json({ error: 'Missing signature header' });

  const secret = normalizeEnvValue(process.env.YOCO_SECRET_KEY);
  if (!secret) return res.status(500).json({ error: 'Server configuration error' });

  if (!verifyYocoSignature(rawBody, signatureHeader, secret))
    return res.status(401).json({ error: 'Invalid signature' });

  const body = req.body as YocoEvent;
  if (!body?.id || !body?.type) return res.status(400).json({ error: 'Invalid event structure' });

  try {
    switch (body.type) {
      case 'payment.completed': await handlePaymentCompleted(body); break;
      case 'payment.failed': await handlePaymentFailed(body); break;
      default: break;
    }
    return res.status(200).json({ received: true });
  } catch (error: any) {
    console.error('Webhook processing failed:', error);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
}

// ─── Router ────────────────────────────────────────────────────────────────
async function handler(req: any, res: any) {
  const action = String(req.query.action || '');
  if (action === 'initiate') return handleInitiate(req, res);
  if (action === 'webhook')  return handleWebhook(req, res);
  return res.status(404).json({ error: `Unknown payment action: ${action}` });
}

export default withSentry(handler);
