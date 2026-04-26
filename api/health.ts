import type { IncomingMessage, ServerResponse } from 'node:http';

export default function handler(_req: IncomingMessage, res: ServerResponse) {
  const supabasePublic = !!process.env.VITE_SUPABASE_URL && !!process.env.VITE_SUPABASE_ANON_KEY;
  const supabaseAdmin = !!(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: {
      supabasePublic: supabasePublic ? 'ok' : 'missing',
      supabaseAdmin: supabaseAdmin ? 'ok' : 'missing',
      gemini: process.env.GEMINI_API_KEY ? 'ok' : 'missing',
      yoco: process.env.YOCO_SECRET_KEY ? 'ok' : 'missing',
      resend: process.env.RESEND_API_KEY && process.env.QUIRKIFY_FROM_EMAIL ? 'ok' : 'missing',
    },
  }));
}
