import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

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

  app.post('/api/payments/yoco/webhook', async (req, res) => {
    // Yoco Webhook handler
    console.log('Yoco Webhook Received:', req.body);
    res.sendStatus(200);
  });

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
