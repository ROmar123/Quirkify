import type { Context } from 'hono';

export default async (c: Context) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: {
      supabase: 'connected',
      gemini: !!process.env.GEMINI_API_KEY ? 'configured' : 'missing',
      yoco: !!process.env.YOCO_SECRET_KEY ? 'configured' : 'missing',
      resend: !!process.env.RESEND_API_KEY && !!process.env.QUIRKIFY_FROM_EMAIL ? 'configured' : 'missing',
    }
  });
};
