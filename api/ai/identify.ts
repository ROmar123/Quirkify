import type { Context } from 'hono';

export default async (c: Context) => {
  if (c.req.method !== 'POST') return c.json({ error: 'Method not allowed' }, 405);

  const { base64Image } = await c.req.json();
  if (!base64Image) return c.json({ error: 'No image provided' }, 400);

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
            parts: [
              { text: `You are a product analyst for Quirkify, a gamified social commerce platform. Analyze this product image and respond with ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "name": "product name here",
  "description": "2-3 sentence description",
  "category": "one of: Sneakers, Clothing, Accessories, Electronics, Collectibles, Toys & Games, Books & Media, Beauty & Health, Home & Decor, Sports & Outdoors, Art & Crafts, Vintage & Retro, Other",
  "retailPrice": number_in_ZAR,
  "rarity": "Common|Limited|Rare|Super Rare|Unique",
  "stats": { "quirkiness": 1-100, "rarity": 1-100, "utility": 1-100, "hype": 1-100 },
  "confidenceScore": 0-1
}` },
              { inlineData: { data: base64Image, mimeType: 'image/jpeg' } }
            ]
          }]
        })
      }
    );

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    let result;
    try {
      result = JSON.parse(text);
    } catch {
      result = { name: 'Product', description: text.slice(0, 200), category: 'Other', retailPrice: 0, rarity: 'Common', stats: { quirkiness: 50, rarity: 50, utility: 50, hype: 50 }, confidenceScore: 0.5 };
    }

    return c.json(result);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
};
