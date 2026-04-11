export interface ShippingQuote {
  carrier: string;
  service: string;
  price: number;
  estimated_delivery: string;
  zone: string;
  is_live: boolean;
  quote_reference: string;
}

export interface TrackingEvent {
  status: string;
  time?: string | null;
  location?: string | null;
}

export interface ShipmentTracking {
  tracking_number: string;
  carrier: string;
  is_live: boolean;
  status: string;
  status_label: string;
  location: string | null;
  estimated_delivery: string | null;
  message: string;
  history: TrackingEvent[];
}

export async function fetchShippingQuote(input: {
  city?: string;
  zip?: string;
  lat?: number | null;
  lng?: number | null;
  street_address?: string | null;
  suburb?: string | null;
  entered_address?: string | null;
}): Promise<ShippingQuote> {
  const response = await fetch('/api/shipping/quote', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(input),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to get shipping quote');
  }
  return data;
}

export async function fetchShipmentTracking(trackingNumber: string): Promise<ShipmentTracking> {
  const response = await fetch(`/api/shipping/track/${encodeURIComponent(trackingNumber)}`, {
    headers: {
      Accept: 'application/json',
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to get tracking details');
  }
  return data;
}
