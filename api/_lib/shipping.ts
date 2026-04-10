type ShippingQuoteInput = {
  city?: string | null;
  zip?: string | null;
};

type TrackingDetailsInput = {
  trackingNumber: string;
};

const MAJOR_METRO_KEYWORDS = [
  'johannesburg',
  'sandton',
  'pretoria',
  'centurion',
  'midrand',
  'cape town',
  'durban',
  'gqeberha',
  'port elizabeth',
  'bloemfontein',
];

function normalize(value?: string | null) {
  return (value || '').trim().toLowerCase();
}

function cleanPostalCode(value?: string | null) {
  return (value || '').replace(/\s+/g, '');
}

export async function getShippingQuote(input: ShippingQuoteInput) {
  const city = normalize(input.city);
  const zip = cleanPostalCode(input.zip);
  const isMetro = MAJOR_METRO_KEYWORDS.some((keyword) => city.includes(keyword));
  const isRemote = zip.startsWith('8') || zip.startsWith('09') || zip.startsWith('82') || city.includes('limpopo') || city.includes('mpumalanga');

  const price = isRemote ? 165 : isMetro ? 120 : 145;
  const estimatedDelivery = isRemote ? '3-5 business days' : isMetro ? '1-3 business days' : '2-4 business days';
  const zone = isRemote ? 'remote' : isMetro ? 'metro' : 'regional';

  return {
    carrier: 'The Courier Guy',
    service: 'Economy',
    price,
    estimated_delivery: estimatedDelivery,
    zone,
    is_live: false,
    quote_reference: `tcg-${zone}-${zip || 'nozip'}`,
  };
}

export async function getTrackingDetails(input: TrackingDetailsInput) {
  const trackingNumber = input.trackingNumber.trim();

  return {
    tracking_number: trackingNumber,
    carrier: 'The Courier Guy',
    is_live: false,
    status: 'tracking_pending_sync',
    status_label: 'Tracking pending sync',
    location: null,
    estimated_delivery: null,
    message: 'Tracking updates will appear here once fulfilment syncs with the carrier.',
    history: [],
  };
}
