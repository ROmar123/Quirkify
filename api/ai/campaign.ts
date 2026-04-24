export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { topSellers, month } = req.body ?? {};
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'AI not configured' });

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `You are a growth strategist for Quirkify, a Cape Town gamified social commerce platform selling quirky second-hand and unique items. It is currently ${month || 'an unspecified month'}. Based on these top-performing products by revenue: ${JSON.stringify(topSellers)}, suggest 1 focused campaign idea that is seasonally relevant and leverages the best-sellers. Respond with ONLY a JSON object (not an array) with fields: title (short, catchy), description (2 sentences max), strategy (one concrete action the seller should take). Nothing else.`
            }]
          }]
        })
      }
    );

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    let campaign;
    try {
      const parsed = JSON.parse(text);
      campaign = Array.isArray(parsed) ? parsed[0] : parsed;
    } catch {
      campaign = { title: 'Flash Sale', description: 'Limited time discount on your top sellers.', strategy: 'Set a 24-hour discount on your 3 best-performing products and promote via WhatsApp status.' };
    }

    res.json({ campaign });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
