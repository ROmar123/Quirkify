import { searchAddresses } from '../_lib/mapbox';
import { getShippingQuote } from '../_lib/shipping';

export default function handler(req: any, res: any) {
  if (req.method === 'GET') {
    return searchAddresses(String(req.query?.q || ''))
      .then((suggestions) => res.json({ suggestions }))
      .catch(() => {
        res.status(500).json({ error: 'Failed to load address suggestions' });
      });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
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
