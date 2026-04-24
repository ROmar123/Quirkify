export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const action = String(req.query?.action || '').trim();
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'AI not configured' });

  async function generateText(body: unknown) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );
    const data = await response.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  try {
    if (action === 'identify') {
      const { base64Image } = req.body ?? {};
      if (!base64Image) return res.status(400).json({ error: 'No image provided' });

      const text = await generateText({
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
            { inlineData: { data: base64Image, mimeType: 'image/jpeg' } },
          ],
        }],
      });

      try {
        return res.json(JSON.parse(text));
      } catch {
        return res.json({
          name: 'Product',
          description: text.slice(0, 200),
          category: 'Other',
          retailPrice: 0,
          rarity: 'Common',
          stats: { quirkiness: 50, rarity: 50, utility: 50, hype: 50 },
          confidenceScore: 0.5,
        });
      }
    }

    if (action === 'campaign') {
      const { topSellers, month } = req.body ?? {};
      const text = await generateText({
        contents: [{
          parts: [{
            text: `You are a growth strategist for Quirkify, a Cape Town gamified social commerce platform selling quirky second-hand and unique items. It is currently ${month || 'an unspecified month'}. Based on these top-performing products by revenue: ${JSON.stringify(topSellers)}, suggest 1 focused campaign idea that is seasonally relevant and leverages the best-sellers. Respond with ONLY a JSON object (not an array) with fields: title (short, catchy), description (2 sentences max), strategy (one concrete action the seller should take). Nothing else.`,
          }],
        }],
      });

      try {
        const parsed = JSON.parse(text);
        return res.json({ campaign: Array.isArray(parsed) ? parsed[0] : parsed });
      } catch {
        return res.json({
          campaign: {
            title: 'Flash Sale',
            description: 'Limited time discount on your top sellers.',
            strategy: 'Set a 24-hour discount on your 3 best-performing products and promote via WhatsApp status.',
          },
        });
      }
    }

    if (action === 'personalize') {
      const { browsingHistory, cart } = req.body ?? {};
      const text = await generateText({
        contents: [{
          parts: [{
            text: `You are a personalization engine for Quirkify, a gamified social commerce platform. A user has viewed: ${JSON.stringify(browsingHistory)}. Their cart contains: ${JSON.stringify(cart)}. Suggest 3 products they might like. Respond with ONLY a JSON array of 3 product names/IDs, nothing else.`,
          }],
        }],
      });

      try {
        return res.json({ recommendations: JSON.parse(text) });
      } catch {
        return res.json({ recommendations: [] });
      }
    }

    if (action === 'talking-points') {
      const { productName, category } = req.body ?? {};
      if (!productName) return res.status(400).json({ error: 'Missing productName' });

      const text = await generateText({
        contents: [{
          parts: [{
            text: `You are a live stream host for Quirkify, a gamified social commerce platform. For the product "${productName}" (category: ${category}), generate 5 engaging talking points a host could use during a live auction. Respond with ONLY a JSON array of 5 strings, nothing else. Example: ["Point 1...", "Point 2..."]`,
          }],
        }],
      });

      try {
        const parsed = JSON.parse(text);
        return res.json({ talkingPoints: Array.isArray(parsed) ? parsed.slice(0, 5) : [text] });
      } catch {
        return res.json({ talkingPoints: [text.slice(0, 300)] });
      }
    }

    return res.status(404).json({ error: 'Unknown AI action' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
