export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { topSellers } = req.body ?? {};
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

    res.json({ campaigns });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
