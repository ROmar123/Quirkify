export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { browsingHistory, cart } = req.body ?? {};
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
              text: `You are a personalization engine for Quirkify, a gamified social commerce platform. A user has viewed: ${JSON.stringify(browsingHistory)}. Their cart contains: ${JSON.stringify(cart)}. Suggest 3 products they might like. Respond with ONLY a JSON array of 3 product names/IDs, nothing else.`
            }]
          }]
        })
      }
    );

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    let recommendations;
    try {
      recommendations = JSON.parse(text);
    } catch {
      recommendations = [];
    }

    res.json({ recommendations });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
