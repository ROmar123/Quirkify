import { getShippingQuote } from '../_lib/shipping';

export default function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  return getShippingQuote({
    city: req.body?.city,
    zip: req.body?.zip,
  })
    .then((quote) => res.json(quote))
    .catch(() => {
      res.status(500).json({ error: 'Failed to get shipping quote' });
    });
}
