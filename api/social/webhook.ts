import type { IncomingMessage, ServerResponse } from 'node:http';
import crypto from 'node:crypto';

interface WebhookBody {
  source?: string;
  event?: string;
  data?: Record<string, unknown>;
}

function verifyTikTokSignature(payload: string, signature: string, secret: string): boolean {
  if (!secret || !signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

function verifyWhatsAppSignature(payload: string, signature: string, secret: string): boolean {
  if (!secret || !signature) return false;
  const sig = signature.startsWith('sha256=') ? signature.slice(7) : signature;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

async function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const method = req.method?.toUpperCase();

  // WhatsApp webhook verification challenge
  if (method === 'GET') {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    const expected = process.env.WHATSAPP_VERIFY_TOKEN;

    if (mode === 'subscribe' && token === expected && challenge) {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(challenge);
      return;
    }
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Verification failed' }));
    return;
  }

  if (method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  const rawBody = await readBody(req);
  const source = (req.headers['x-webhook-source'] as string | undefined) ?? 'unknown';
  const tiktokSig = req.headers['x-tiktok-signature'] as string | undefined;
  const whatsappSig = req.headers['x-hub-signature-256'] as string | undefined;

  // Signature verification
  if (source === 'tiktok' && tiktokSig) {
    const secret = process.env.TIKTOK_WEBHOOK_SECRET ?? '';
    if (!verifyTikTokSignature(rawBody, tiktokSig, secret)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid TikTok signature' }));
      return;
    }
  }

  if (source === 'whatsapp' && whatsappSig) {
    const secret = process.env.WHATSAPP_APP_SECRET ?? '';
    if (!verifyWhatsAppSignature(rawBody, whatsappSig, secret)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid WhatsApp signature' }));
      return;
    }
  }

  let body: WebhookBody;
  try {
    body = JSON.parse(rawBody) as WebhookBody;
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
    return;
  }

  const event = body.event ?? 'unknown';

  // Route events
  switch (event) {
    case 'tiktok.product.comment':
    case 'tiktok.video.purchase_intent':
      // Future: create a pending WhatsApp conversation thread via Twilio/360dialog
      console.info('[social-webhook] TikTok purchase intent received', { event, data: body.data });
      break;

    case 'whatsapp.message':
      // Future: route to Aura AI bot for automated order processing
      console.info('[social-webhook] WhatsApp message received', { event, data: body.data });
      break;

    case 'whatsapp.order':
      // Future: create Supabase order from WhatsApp cart
      console.info('[social-webhook] WhatsApp order received', { event, data: body.data });
      break;

    default:
      console.info('[social-webhook] Unhandled event', { event, source });
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ received: true, event }));
}
