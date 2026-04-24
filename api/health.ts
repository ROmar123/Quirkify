export default async function handler(req: any, res: any) {
  const supabasePublic = !!process.env.VITE_SUPABASE_URL && !!process.env.VITE_SUPABASE_ANON_KEY;
  const supabaseAdmin = !!(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: {
      supabasePublic: supabasePublic ? 'configured' : 'missing',
      supabaseAdmin: supabaseAdmin ? 'configured' : 'missing',
      gemini: !!process.env.GEMINI_API_KEY ? 'configured' : 'missing',
      yoco: !!process.env.YOCO_SECRET_KEY ? 'configured' : 'missing',
      resend: !!process.env.RESEND_API_KEY && !!process.env.QUIRKIFY_FROM_EMAIL ? 'configured' : 'missing',
    }
  });
}
