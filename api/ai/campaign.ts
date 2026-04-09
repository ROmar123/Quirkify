import type { Context } from 'hono';

export default async (c: Context) => {
  if (c.req.method !== 'POST') return c.json({ error: 'Method not allowed' }, 405);

  const { topSellers } = await c.req.json();
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
              text: `You are a growth strategist for Quirkify, a gamified social commerce platform. Based on these top sellers: ${JSON.stringify(topSellers)}, suggest 3 campaign ideas to boost sales and engagement. Respond with ONLY a JSON array of 3 objects with fields: title, description, expectedImpact (High/Medium/Low). Nothing else.`
            }]
          }]
        })
      }
    );

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    let campaigns;
    try {
      campaigns = JSON.parse(text);
    } catch {
      campaigns = [
        { title: 'Flash Sale', description: 'Limited time discount on top sellers', expectedImpact: 'High' },
        { title: 'Bundle Deal', description: 'Buy 2 get 10% off', expectedImpact: 'Medium' },
        { title: 'Referral Program', description: 'Reward customers who refer friends', expectedImpact: 'Medium' },
      ];
    }

    return c.json({ campaigns });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
};
