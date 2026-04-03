export default function handler(req: any, res: any) {
  const { trackingNumber } = req.query;

  res.json({
    tracking_number: trackingNumber,
    status: 'In Transit',
    location: 'Johannesburg Hub',
    estimated_delivery: '2026-04-05',
    history: [
      { status: 'Collected', time: '2026-04-02 09:00', location: 'Cape Town' },
      { status: 'In Transit', time: '2026-04-03 14:00', location: 'Johannesburg Hub' }
    ]
  });
}
