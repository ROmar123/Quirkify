import { getShippingQuote, getTrackingDetails } from '../_lib/shipping.js';

export default async function handler(req: any, res: any) {
  const action = String(req.query?.action || '').trim();

  if (action === 'quote') {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      const quote = await getShippingQuote({
        city: req.body?.city ?? null,
        zip: req.body?.zip ?? null,
        lat: req.body?.lat ?? null,
        lng: req.body?.lng ?? null,
        street_address: req.body?.street_address ?? null,
        suburb: req.body?.suburb ?? null,
        entered_address: req.body?.entered_address ?? null,
      });
      return res.json(quote);
    } catch {
      return res.status(500).json({ error: 'Failed to get shipping quote' });
    }
  }

  if (action === 'track') {
    try {
      const details = await getTrackingDetails({
        trackingNumber: String(req.query?.trackingNumber || ''),
      });
      return res.json(details);
    } catch {
      return res.status(500).json({ error: 'Failed to load tracking details' });
    }
  }

  return res.status(404).json({ error: 'Unknown shipping action' });
}
