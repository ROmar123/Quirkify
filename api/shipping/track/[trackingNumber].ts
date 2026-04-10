import { getTrackingDetails } from '../../_lib/shipping.js';

export default function handler(req: any, res: any) {
  const { trackingNumber } = req.query;

  return getTrackingDetails({ trackingNumber: String(trackingNumber || '') })
    .then((details) => res.json(details))
    .catch(() => {
      res.status(500).json({ error: 'Failed to load tracking details' });
    });
}
