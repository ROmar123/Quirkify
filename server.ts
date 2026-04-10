import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import axios from 'axios';
import crypto from 'crypto';
import { ensureProfileByIdentity, getSupabaseAdmin } from './api/_lib/supabaseAdmin';

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

      const profile = await ensureProfileByIdentity({
        firebaseUid: String(firebaseUid),
        email: String(email),
        displayName: displayName ? String(displayName) : null,
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
        p_shipping_cost: 120,
        p_items: normalizedItems,
      });

      if (checkoutError) {
        return res.status(400).json({ error: checkoutError.message });
      }

      const checkoutRow = Array.isArray(checkoutData) ? checkoutData[0] : checkoutData;
      if (!checkoutRow?.order_id || !checkoutRow?.total) {
        return res.status(500).json({ error: 'Checkout order was not created correctly' });
      }

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
      if (checkoutSessionId) {
        await supabase
          .from('orders')
          .update({
            checkout_session_id: checkoutSessionId,
            payment_status: 'redirected',
          })
          .eq('id', checkoutRow.order_id);
      }

      return res.json({
        orderId: checkoutRow.order_id,
        orderNumber: checkoutRow.order_number,
        total: checkoutRow.total,
        redirectUrl: yocoResponse.data?.redirectUrl,
        reservationExpiresAt: checkoutRow.reservation_expires_at,
      });
    } catch (error: any) {
      const message = error?.response?.data?.message || error?.response?.data?.error || error?.message || 'Failed to start checkout';
      console.error('Store checkout error:', message);
      return res.status(500).json({ error: message });
    }
  });

  app.post('/api/commerce/cancel-order', async (req, res) => {
    try {
      const { orderId, reason } = req.body ?? {};

      if (!orderId) {
        return res.status(400).json({ error: 'Missing orderId' });
      }

      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase.rpc('cancel_pending_order', {
        p_order_id: String(orderId),
        p_note: reason ? String(reason) : 'Checkout cancelled by customer',
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
        cancelUrl: `${req.headers.origin}/payment/cancel`,
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
      // Mocking The Courier Guy API for now
      const quote = {
        service: 'Economy',
        price: 120.00,
        estimated_delivery: '2-3 business days'
      };
      res.json(quote);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get shipping quote' });
    }
  });

  app.get('/api/shipping/track/:trackingNumber', (req, res) => {
    const { trackingNumber } = req.params;
    // Mock response from The Courier Guy
    res.json({
      tracking_number: trackingNumber,
      status: 'In Transit',
      location: 'Johannesburg Hub',
      estimated_delivery: '2026-04-05',
      history: [
        { status: 'Collected', time: '2026-04-02 09:00', location: 'Cape Town' },
        { status: 'In Transit', time: '2026-04-03 14:00', location: 'Johannesburg Hub' }
      ]
    });
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
