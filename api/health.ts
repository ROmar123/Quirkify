export default async function handler(_req: any, res: any) {
  const supabasePublic = !!process.env.VITE_SUPABASE_URL && !!process.env.VITE_SUPABASE_ANON_KEY;
  const supabaseAdmin = !!(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

  return res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      supabasePublic: supabasePublic ? 'configured' : 'missing',
      supabaseAdmin: supabaseAdmin ? 'configured' : 'missing',
      gemini: process.env.GEMINI_API_KEY ? 'configured' : 'missing',
      yoco: process.env.YOCO_SECRET_KEY ? 'configured' : 'missing',
    },
  });
}
