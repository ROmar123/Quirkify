import { normalizeEnvValue } from './env.js';

type ShippingQuoteInput = {
  city?: string | null;
  zip?: string | null;
  lat?: number | null;
  lng?: number | null;
  street_address?: string | null;
  suburb?: string | null;
  entered_address?: string | null;
};

type TrackingDetailsInput = {
  trackingNumber: string;
};

// ─── Zone-based fallback ──────────────────────────────────────────────────────

const MAJOR_METRO_KEYWORDS = [
  'johannesburg', 'sandton', 'pretoria', 'centurion', 'midrand',
  'cape town', 'durban', 'gqeberha', 'port elizabeth', 'bloemfontein',
];

function normalize(value?: string | null) {
  return (value || '').trim().toLowerCase();
}

function cleanPostalCode(value?: string | null) {
  return (value || '').replace(/\s+/g, '');
}

function inferZone(city?: string | null, zip?: string | null): string {
  const c = normalize(city);
  const z = cleanPostalCode(zip);
  if (c.includes('cape town') || c.includes('stellenbosch') || c.includes('paarl') || z.startsWith('7') || z.startsWith('8')) return 'WC';
  if (c.includes('durban') || c.includes('pietermaritzburg') || c.includes('umhlanga') || z.startsWith('4') || z.startsWith('3')) return 'KZN';
  if (c.includes('port elizabeth') || c.includes('gqeberha') || c.includes('east london') || z.startsWith('6')) return 'EC';
  if (c.includes('bloemfontein') || z.startsWith('9')) return 'FS';
  if (c.includes('limpopo') || c.includes('polokwane') || z.startsWith('09') || z.startsWith('08')) return 'LP';
  if (c.includes('mpumalanga') || c.includes('nelspruit') || c.includes('mbombela')) return 'MP';
  if (c.includes('northern cape') || c.includes('kimberley')) return 'NC';
  return 'GP';
}

function zoneFallback(city?: string | null, zip?: string | null) {
  const c = normalize(city);
  const z = cleanPostalCode(zip);
  const isMetro = MAJOR_METRO_KEYWORDS.some((kw) => c.includes(kw));
  const isRemote =
    !isMetro &&
    (z.startsWith('09') || z.startsWith('82') ||
      c.includes('limpopo') || c.includes('mpumalanga') || c.includes('northern cape'));

  const price = isRemote ? 165 : isMetro ? 120 : 145;
  const estimated_delivery = isRemote ? '3-5 business days' : isMetro ? '1-3 business days' : '2-4 business days';
  const zone = isRemote ? 'remote' : isMetro ? 'metro' : 'regional';

  return {
    carrier: 'The Courier Guy',
    service: 'Economy',
    price,
    estimated_delivery,
    zone,
    is_live: false,
    quote_reference: `tcg-fallback-${zone}-${z || 'nozip'}`,
  };
}

// ─── TCG live API ─────────────────────────────────────────────────────────────

const TCG_BASE = 'https://api-tcg.co.za';

const COLLECTION_ADDRESS = {
  lat: parseFloat(normalizeEnvValue(process.env.TCG_COLLECTION_LAT) || '-26.1367'),
  lng: parseFloat(normalizeEnvValue(process.env.TCG_COLLECTION_LNG) || '27.9810'),
  street_address: normalizeEnvValue(process.env.TCG_COLLECTION_STREET) || 'Quirkify Warehouse',
  local_area: normalizeEnvValue(process.env.TCG_COLLECTION_SUBURB) || 'Randburg',
  suburb: normalizeEnvValue(process.env.TCG_COLLECTION_SUBURB) || 'Randburg',
  city: normalizeEnvValue(process.env.TCG_COLLECTION_CITY) || 'Johannesburg',
  code: normalizeEnvValue(process.env.TCG_COLLECTION_POSTAL) || '2194',
  zone: normalizeEnvValue(process.env.TCG_COLLECTION_ZONE) || 'GP',
  country: 'South Africa',
  entered_address: normalizeEnvValue(process.env.TCG_COLLECTION_ENTERED) || 'Randburg, Johannesburg, South Africa',
  type: 'residential' as const,
  company: 'Quirkify',
};

async function tcgRateQuote(input: ShippingQuoteInput) {
  const apiKey = normalizeEnvValue(process.env.TCG_API_KEY);
  if (!apiKey || !input.lat || !input.lng) return null;

  const deliveryAddress = {
    lat: input.lat,
    lng: input.lng,
    street_address: input.street_address || '',
    local_area: input.suburb || input.city || '',
    suburb: input.suburb || input.city || '',
    city: input.city || '',
    code: input.zip || '',
    zone: inferZone(input.city, input.zip),
    country: 'South Africa',
    entered_address:
      input.entered_address ||
      [input.street_address, input.city, input.zip, 'South Africa'].filter(Boolean).join(', '),
    type: 'residential' as const,
  };

  const res = await fetch(`${TCG_BASE}/rates?api_key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      collection_address: COLLECTION_ADDRESS,
      delivery_address: deliveryAddress,
      opt_in_rates: [],
      opt_in_time_based_rates: [],
    }),
  });

  if (!res.ok) return null;

  const data = await res.json() as {
    rates?: Array<{
      rate: string;
      service_level: {
        code: string;
        name: string;
        delivery_date_from?: string;
        delivery_date_to?: string;
      };
    }>;
  };

  if (!data.rates?.length) return null;

  const ecoRate = data.rates.find((r) => r.service_level.code === 'ECO') ?? data.rates[0];
  const price = Math.round(parseFloat(ecoRate.rate));

  let estimated_delivery = '2-4 business days';
  const from = ecoRate.service_level.delivery_date_from;
  const to = ecoRate.service_level.delivery_date_to;
  if (from && to) {
    const today = new Date();
    const daysFrom = Math.ceil((new Date(from).getTime() - today.getTime()) / 86400000);
    const daysTo = Math.ceil((new Date(to).getTime() - today.getTime()) / 86400000);
    if (!isNaN(daysFrom) && !isNaN(daysTo)) {
      estimated_delivery = `${Math.max(1, daysFrom)}-${Math.max(2, daysTo)} business days`;
    }
  }

  return {
    carrier: 'The Courier Guy',
    service: ecoRate.service_level.name || 'Economy',
    price,
    estimated_delivery,
    zone: inferZone(input.city, input.zip),
    is_live: true,
    quote_reference: `tcg-live-${Date.now()}`,
  };
}

async function tcgTrack(trackingNumber: string) {
  const res = await fetch(
    `${TCG_BASE}/tracking/shipments/public?waybill=${encodeURIComponent(trackingNumber)}`,
    { headers: { Accept: 'application/json' } },
  );
  if (!res.ok) return null;

  const data = await res.json() as {
    status?: string;
    estimated_delivery_to?: string;
    tracking_events?: Array<{ description?: string; time?: string; city?: string }>;
  };

  if (!data) return null;

  const events = (data.tracking_events || []).map((e) => ({
    status: e.description || '',
    time: e.time || null,
    location: e.city || null,
  }));

  const latestEvent = events[0];
  const statusLabel = latestEvent?.status || data.status || 'In transit';

  return {
    tracking_number: trackingNumber,
    carrier: 'The Courier Guy',
    is_live: true,
    status: data.status || 'in_transit',
    status_label: statusLabel,
    location: latestEvent?.location ?? null,
    estimated_delivery: data.estimated_delivery_to || null,
    message: statusLabel,
    history: events,
  };
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export async function getShippingQuote(input: ShippingQuoteInput) {
  if (input.lat && input.lng) {
    const live = await tcgRateQuote(input).catch(() => null);
    if (live) return live;
  }
  return zoneFallback(input.city, input.zip);
}

export async function getTrackingDetails(input: TrackingDetailsInput) {
  const trackingNumber = input.trackingNumber.trim();
  if (!trackingNumber) {
    return {
      tracking_number: '',
      carrier: 'The Courier Guy',
      is_live: false,
      status: 'no_tracking',
      status_label: 'No tracking number',
      location: null,
      estimated_delivery: null,
      message: 'No tracking number provided.',
      history: [],
    };
  }

  const live = await tcgTrack(trackingNumber).catch(() => null);
  if (live) return live;

  return {
    tracking_number: trackingNumber,
    carrier: 'The Courier Guy',
    is_live: false,
    status: 'tracking_pending_sync',
    status_label: 'Tracking pending sync',
    location: null,
    estimated_delivery: null,
    message: 'Tracking updates will appear here once the shipment syncs with the carrier.',
    history: [],
  };
}
