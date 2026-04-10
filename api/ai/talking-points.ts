export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { productName, category } = req.body ?? {};
  if (!productName) return res.status(400).json({ error: 'Missing productName' });

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
              text: `You are a live stream host for Quirkify, a gamified social commerce platform. For the product "${productName}" (category: ${category}), generate 5 engaging talking points a host could use during a live auction. Respond with ONLY a JSON array of 5 strings, nothing else. Example: ["Point 1...", "Point 2..."]`
            }]
          }]
        })
      }
    );

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    let points;
    try {
      points = JSON.parse(text);
      if (!Array.isArray(points)) points = [text];
    } catch {
      points = [text.slice(0, 300)];
    }

    res.json({ talkingPoints: points.slice(0, 5) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
