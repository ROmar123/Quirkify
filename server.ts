import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import axios from 'axios';
import crypto from 'crypto';
import { sendOrderStatusEmail } from './api/_lib/orderNotifications';
import { ensureProfileByIdentity, expireStalePendingOrders, getSupabaseAdmin } from './api/_lib/supabaseAdmin';
import { getShippingQuote, getTrackingDetails } from './api/_lib/shipping';

dotenv.config({ path: '.env.local' });
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const {
    identifyProduct,
    suggestCampaign,
    getHostTalkingPoints,
    getPersonalizedRecommendations,
  } = await import('./server/ai/controller');

  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.post('/api/commerce/store-checkout', async (req, res) => {
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

      const normalizedItems = items.map((item: any) => ({
        productId: String(item?.productId || ''),
        quantity: Number(item?.quantity || 0),
      }));

      if (normalizedItems.some((item: any) => !item.productId || item.quantity <= 0)) {
        return res.status(400).json({ error: 'Invalid checkout items' });
      }

      await expireStalePendingOrders();
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

      const origin = req.headers.origin || `http://${req.headers.host}`;
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
        }
      }, {
        headers: {
          Authorization: `Bearer ${yocoSecretKey}`,
          'Content-Type': 'application/json'
        }
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
        .update({
          checkout_session_id: checkoutSessionId,
          payment_status: 'redirected',
        })
        .eq('id', checkoutRow.order_id);

      if (updateError) {
        await supabase.rpc('cancel_pending_order', {
          p_order_id: checkoutRow.order_id,
          p_note: 'checkout_order_update_failed',
        });
        return res.status(500).json({ error: updateError.message });
      }

      return res.json({
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
            p_note: 'checkout_redirect_failed',
          });
        }
      } catch (cleanupError) {
        console.error('Failed to release pending checkout after store-checkout error:', cleanupError);
      }
      return res.status(500).json({ error: message });
    }
  });

  app.post('/api/commerce/cancel-order', async (req, res) => {
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

      return res.json({ order: Array.isArray(data) ? data[0] : data });
    } catch (error: any) {
      const message = error?.message || 'Failed to cancel order';
      console.error('Cancel order error:', message);
      return res.status(500).json({ error: message });
    }
  });

  app.post('/api/commerce/resume-checkout', async (req, res) => {
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

      const origin = req.headers.origin || `http://${req.headers.host}`;
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
        }
      }, {
        headers: {
          Authorization: `Bearer ${yocoSecretKey}`,
          'Content-Type': 'application/json'
        }
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

      return res.json({
        orderId: order.id,
        redirectUrl: yocoResponse.data.redirectUrl,
      });
    } catch (error: any) {
      const message = error?.response?.data?.message || error?.response?.data?.error || error?.message || 'Failed to resume checkout';
      console.error('Resume checkout error:', message);
      return res.status(500).json({ error: message });
    }
  });

  app.get('/api/commerce/order-status', async (req, res) => {
    try {
      const orderId = String(req.query?.orderId || '').trim();
      const includeEvents = req.query?.includeEvents === '1';
      if (!orderId) {
        return res.status(400).json({ error: 'Missing orderId' });
      }

      await expireStalePendingOrders();
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from('orders')
        .select(includeEvents ? '*' : 'id, order_number, status, payment_status, total, checkout_session_id, reservation_expires_at, created_at, updated_at, source_ref, channel')
        .eq('id', orderId)
        .maybeSingle();

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      if (!data) {
        return res.status(404).json({ error: 'Order not found' });
      }

      if (!includeEvents) {
        return res.json({ order: data });
      }

      const [{ data: items }, { data: events }] = await Promise.all([
        supabase.from('order_items').select('*').eq('order_id', orderId).order('created_at', { ascending: true }),
        supabase.from('order_events').select('*').eq('order_id', orderId).order('created_at', { ascending: false }),
      ]);

      return res.json({ order: data, items: items || [], events: events || [] });
    } catch (error: any) {
      const message = error?.message || 'Failed to load order status';
      console.error('Order status error:', message);
      return res.status(500).json({ error: message });
    }
  });

  app.patch('/api/commerce/order-status', async (req, res) => {
    try {
      const orderId = String(req.body?.orderId || '').trim();
      const nextStatus = String(req.body?.status || '').trim();
      const trackingNumber = typeof req.body?.trackingNumber === 'string' ? req.body.trackingNumber.trim() : '';
      const carrier = typeof req.body?.carrier === 'string' ? req.body.carrier.trim() : '';
      const adminNotes = typeof req.body?.adminNotes === 'string' ? req.body.adminNotes.trim() : '';

      if (!orderId) {
        return res.status(400).json({ error: 'Missing orderId' });
      }

      await expireStalePendingOrders();
      const supabase = getSupabaseAdmin();
      const { data: currentOrder, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (orderError || !currentOrder) {
        return res.status(404).json({ error: 'Order not found' });
      }

      const updates: Record<string, unknown> = {};
      const previousStatus = currentOrder.status;
      const allowedTransitions: Record<string, string[]> = {
        pending: ['processing', 'cancelled', 'payment_failed'],
        paid: ['processing', 'shipped', 'cancelled', 'refunded'],
        processing: ['shipped', 'cancelled', 'refunded'],
        shipped: ['delivered', 'refunded'],
        delivered: ['refunded'],
        cancelled: [],
        refunded: [],
        payment_failed: [],
      };

      if (trackingNumber) updates.tracking_number = trackingNumber;
      if (carrier) updates.carrier = carrier;
      if (adminNotes) updates.admin_notes = adminNotes;

      if (nextStatus && nextStatus !== previousStatus) {
        const allowed = allowedTransitions[previousStatus] || [];
        if (!allowed.includes(nextStatus)) {
          return res.status(400).json({ error: `Cannot move order from ${previousStatus} to ${nextStatus}` });
        }

        updates.status = nextStatus;
        if (nextStatus === 'processing' && !currentOrder.paid_at) updates.paid_at = new Date().toISOString();
        if (nextStatus === 'shipped') updates.shipped_at = new Date().toISOString();
        if (nextStatus === 'delivered') updates.delivered_at = new Date().toISOString();
        if (nextStatus === 'cancelled') updates.cancelled_at = new Date().toISOString();
      }

      if (Object.keys(updates).length === 0) {
        return res.json({ order: currentOrder });
      }

      const { data: updatedOrder, error: updateError } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', orderId)
        .select('*')
        .single();

      if (updateError) {
        return res.status(400).json({ error: updateError.message });
      }

      if (nextStatus && nextStatus !== previousStatus) {
        await supabase.rpc('log_order_event', {
          p_order_id: orderId,
          p_event_type: 'admin_status_updated',
          p_from_status: previousStatus,
          p_to_status: nextStatus,
          p_note: adminNotes || `Admin moved order to ${nextStatus}`,
          p_metadata: {
            tracking_number: trackingNumber || null,
            carrier: carrier || null,
          },
        });
      } else if (trackingNumber || carrier || adminNotes) {
        await supabase.rpc('log_order_event', {
          p_order_id: orderId,
          p_event_type: 'admin_fulfilment_updated',
          p_from_status: previousStatus,
          p_to_status: previousStatus,
          p_note: adminNotes || 'Fulfilment details updated',
          p_metadata: {
            tracking_number: trackingNumber || null,
            carrier: carrier || null,
          },
        });
      }

      const [{ data: items }, { data: events }] = await Promise.all([
        supabase.from('order_items').select('*').eq('order_id', orderId).order('created_at', { ascending: true }),
        supabase.from('order_events').select('*').eq('order_id', orderId).order('created_at', { ascending: false }),
      ]);

      return res.json({ order: updatedOrder, items: items || [], events: events || [] });
    } catch (error: any) {
      const message = error?.message || 'Failed to update order';
      console.error('Order update error:', message);
      return res.status(500).json({ error: message });
    }
  });

  // Yoco Payment Integration
  app.post('/api/payments/yoco/initiate', async (req, res) => {
    try {
      const { amount, item_name, m_payment_id } = req.body;
      
      // PROD: Yoco secret MUST come from env var - no fallback
      const yocoSecretKey = process.env.YOCO_SECRET_KEY;
      if (!yocoSecretKey) {
        throw new Error('YOCO_SECRET_KEY env var is required');
      } // Test key
      
      const response = await axios.post('https://payments.yoco.com/api/checkouts', {
        amount: Math.round(amount * 100), // Yoco expects amount in cents
        currency: 'ZAR',
        successUrl: `${req.headers.origin}/payment/success?orderId=${m_payment_id}&amount=${amount}`,
        cancelUrl: `${req.headers.origin}/payment/cancel?orderId=${m_payment_id}`,
        metadata: {
          orderId: m_payment_id,
          itemName: item_name
        }
      }, {
        headers: {
          'Authorization': `Bearer ${yocoSecretKey}`,
          'Content-Type': 'application/json'
        }
      });

      res.json({ redirectUrl: response.data.redirectUrl });
    } catch (error: any) {
      const errorDetail = error.response?.data || error.message;
      console.error('Yoco Error:', errorDetail);
      res.status(500).json({ 
        error: 'Failed to initiate Yoco payment', 
        details: errorDetail 
      });
    }
  });

  // Yoco Webhook Handler
  app.post('/api/payments/yoco/webhook', async (req, res) => {
    try {
      const event = req.body;
      const signatureHeader = req.headers['x-yoco-signature'];
      // PROD: Yoco secret MUST come from env var - no fallback
      const yocoSecretKey = process.env.YOCO_SECRET_KEY;
      if (!yocoSecretKey) {
        throw new Error('YOCO_SECRET_KEY env var is required');
      }

      // Verify signature (skip in test environment)
      if (process.env.NODE_ENV === 'production') {
        if (!signatureHeader || !verifyYocoSignature(event, signatureHeader as string, yocoSecretKey)) {
          console.warn('Invalid webhook signature');
          return res.sendStatus(401);
        }
      }

      console.log('Processing Yoco webhook event:', event.type);

      // Handle payment.completed
      if (event.type === 'payment.completed') {
        const orderId = event.data?.metadata?.orderId;
        if (!orderId) {
          console.warn('No orderId in webhook metadata');
          return res.sendStatus(400);
        }

        try {
          const supabase = getSupabaseAdmin();
          const { data: currentOrder, error: orderReadError } = await supabase
            .from('orders')
            .select('id, status, source_ref, profile_id, total')
            .eq('id', orderId)
            .maybeSingle();

          if (orderReadError) {
            throw new Error(orderReadError.message);
          }

          const shouldCreditWallet =
            currentOrder?.status === 'pending' &&
            currentOrder?.source_ref === 'wallet_topup' &&
            !!currentOrder.profile_id;

          const { error } = await supabase.rpc('mark_order_payment_succeeded', {
            p_order_id: orderId,
            p_payment_id: event.data.id,
            p_payment_status: 'completed',
            p_provider_event_id: event.id,
            p_payload: {
              amount: event.data.amount,
              currency: event.data.currency,
              createdAt: event.data.createdAt,
              metadata: event.data.metadata || {},
            }
          });
          if (error) {
            throw new Error(error.message);
          }

          if (shouldCreditWallet && currentOrder?.profile_id) {
            const { data: profile, error: profileReadError } = await supabase
              .from('profiles')
              .select('id, balance')
              .eq('id', currentOrder.profile_id)
              .single();

            if (profileReadError) {
              throw new Error(profileReadError.message);
            }

            const { error: balanceUpdateError } = await supabase
              .from('profiles')
              .update({ balance: Number(profile?.balance || 0) + Number(currentOrder.total || 0) })
              .eq('id', currentOrder.profile_id);

            if (balanceUpdateError) {
              throw new Error(balanceUpdateError.message);
            }
          }

          try {
            await sendOrderStatusEmail(orderId, 'paid');
          } catch (emailError) {
            console.error(`Paid email send failed for order ${orderId}:`, emailError);
          }
          console.log(`Order ${orderId} payment confirmed in Supabase`);
        } catch (error) {
          console.error(`Failed to update order ${orderId}:`, error);
          return res.sendStatus(500);
        }
      }

      // Handle payment.failed
      if (event.type === 'payment.failed') {
        const orderId = event.data?.metadata?.orderId;
        if (!orderId) {
          console.warn('No orderId in failed payment webhook');
          return res.sendStatus(400);
        }

        try {
          const supabase = getSupabaseAdmin();
          const { error } = await supabase.rpc('mark_order_payment_failed', {
            p_order_id: orderId,
            p_payment_status: event.data.failureReason || 'failed',
            p_provider_event_id: event.id,
            p_payload: {
              failureReason: event.data.failureReason || null,
              metadata: event.data.metadata || {},
            }
          });
          if (error) {
            throw new Error(error.message);
          }
          try {
            await sendOrderStatusEmail(orderId, 'payment_failed');
          } catch (emailError) {
            console.error(`Failed-payment email send failed for order ${orderId}:`, emailError);
          }
          console.log(`Order ${orderId} payment failed in Supabase`);
        } catch (error) {
          console.error(`Failed to update failed order ${orderId}:`, error);
          return res.sendStatus(500);
        }
      }

      res.sendStatus(200);
    } catch (error) {
      console.error('Webhook processing error:', error);
      res.sendStatus(500);
    }
  });

  // Verify Yoco webhook signature using HMAC-SHA256
  function verifyYocoSignature(payload: any, signature: string, secret: string): boolean {
    try {
      const hash = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(payload))
        .digest('base64');
      return hash === signature;
    } catch (error) {
      console.error('Signature verification error:', error);
      return false;
    }
  }

  // The Courier Guy API Proxy
  app.post('/api/shipping/quote', async (req, res) => {
    try {
      const quote = await getShippingQuote({
        city: req.body?.city,
        zip: req.body?.zip,
      });
      res.json(quote);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get shipping quote' });
    }
  });

  app.get('/api/shipping/track/:trackingNumber', async (req, res) => {
    try {
      const tracking = await getTrackingDetails({
        trackingNumber: String(req.params.trackingNumber || ''),
      });
      res.json(tracking);
    } catch (error) {
      res.status(500).json({ error: 'Failed to load tracking details' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
