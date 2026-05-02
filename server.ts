import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const { default: healthHandler } = await import('./api/health');
  const { default: aiHandler } = await import('./api/ai/[action]');
  const { default: shippingHandler } = await import('./api/shipping/[action]');
  const { default: commerceHandler } = await import('./api/commerce/[action]');
  const { default: yocoHandler } = await import('./api/payments/yoco/[action]');

  const app = express();
  const PORT = Number(process.env.PORT || 3000);

  app.use(express.json({ limit: '10mb' }));

  app.get('/api/health', (req, res) => void healthHandler(req, res));

  app.post('/api/ai/:action', (req, res) =>
    void aiHandler({ ...req, query: { ...req.query, action: req.params.action } }, res));

  app.all('/api/commerce/:action', (req, res) =>
    void commerceHandler({ ...req, query: { ...req.query, action: req.params.action } }, res));

  app.all('/api/payments/yoco/:action', (req, res) =>
    void yocoHandler({ ...req, query: { ...req.query, action: req.params.action } }, res));

  app.all('/api/shipping/:action', (req, res) =>
    void shippingHandler({ ...req, query: { ...req.query, action: req.params.action, trackingNumber: req.query.trackingNumber } }, res));

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
