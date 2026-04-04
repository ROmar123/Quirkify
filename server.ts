import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import axios from 'axios';
import admin from 'firebase-admin';
import crypto from 'crypto';

dotenv.config();

// Initialize Firebase Admin
let adminDb: admin.firestore.Firestore;
try {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    : null;

  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    adminDb = admin.firestore();
  }
} catch (error) {
  console.warn('Firebase Admin not initialized - webhook updates will not work:', error);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Yoco Payment Integration
  app.post('/api/payments/yoco/initiate', async (req, res) => {
    try {
      const { amount, item_name, m_payment_id } = req.body;
      
      const yocoSecretKey = process.env.YOCO_SECRET_KEY || 'sk_test_960bf73aeb0c406638f8'; // Test key
      
      const response = await axios.post('https://online.yoco.com/v1/checkouts', {
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
      const yocoSecretKey = process.env.YOCO_SECRET_KEY || 'sk_test_960bf73aeb0c406638f8';

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

        if (!adminDb) {
          console.warn('Firebase Admin not initialized - cannot update order');
          return res.sendStatus(500);
        }

        try {
          await adminDb.collection('orders').doc(orderId).update({
            status: 'processing',
            paymentConfirmedAt: new Date().toISOString(),
            paymentInfo: {
              transactionId: event.data.id,
              amount: event.data.amount,
              currency: event.data.currency,
              completedAt: event.data.createdAt
            }
          });
          console.log(`Order ${orderId} payment confirmed, status updated to processing`);
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

        if (!adminDb) {
          console.warn('Firebase Admin not initialized - cannot update failed order');
          return res.sendStatus(500);
        }

        try {
          await adminDb.collection('orders').doc(orderId).update({
            status: 'payment_failed',
            failureReason: event.data.failureReason,
            failedAt: new Date().toISOString()
          });
          console.log(`Order ${orderId} payment failed`);
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
