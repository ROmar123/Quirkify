export default function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const quote = {
      service: 'Economy',
      price: 120.00,
      estimated_delivery: '2-3 business days'
    };
    res.json(quote);
  } catch {
    res.status(500).json({ error: 'Failed to get shipping quote' });
  }
}
