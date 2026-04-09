import type { Context } from 'hono';

export default async (c: Context) => {
  if (c.req.method !== 'POST') return c.json({ error: 'Method not allowed' }, 405);

  const { userId, browsingHistory, cart } = await c.req.json();
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

    return c.json({ recommendations });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
};
