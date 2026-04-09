import type { Context } from 'hono';

export default async (c: Context) => {
  if (c.req.method !== 'POST') return c.json({ error: 'Method not allowed' }, 405);

  const { productName, category } = await c.req.json();
  if (!productName) return c.json({ error: 'Missing productName' }, 400);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return c.json({ error: 'AI not configured' }, 503);

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

    return c.json({ talkingPoints: points.slice(0, 5) });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
};
