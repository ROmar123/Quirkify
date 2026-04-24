import { normalizeEnvValue } from '../lib/env';

export interface AddressSuggestion {
  id: string;
  label: string;
  addressLine: string;
  city: string;
  postcode: string;
  province: string;
  country: string;
  longitude: number | null;
  latitude: number | null;
}

const MAPBOX_ACCESS_TOKEN = normalizeEnvValue(import.meta.env.VITE_MAPBOX_ACCESS_TOKEN);

function getContextValue(context: any[] | undefined, type: string) {
  return context?.find((entry) => entry.id?.startsWith(`${type}.`) || entry.mapbox_id?.includes(type))?.text || '';
}

export async function searchAddressSuggestions(query: string): Promise<AddressSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3 || !MAPBOX_ACCESS_TOKEN) {
    return [];
  }

  const response = await fetch(
    `https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(trimmed)}&country=ZA&language=en&types=address,street&limit=5&autocomplete=true&access_token=${encodeURIComponent(MAPBOX_ACCESS_TOKEN)}`
  );

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Failed to load address suggestions');
  }

  return (data.features || []).map((feature: any) => {
    const addressLine = feature.properties?.full_address || feature.properties?.name || feature.name || trimmed;
    const city = feature.properties?.context?.place?.name || getContextValue(feature.properties?.context, 'place');
    const postcode = feature.properties?.context?.postcode?.name || getContextValue(feature.properties?.context, 'postcode');
    const province = feature.properties?.context?.region?.name || getContextValue(feature.properties?.context, 'region');
    const country = feature.properties?.context?.country?.name || getContextValue(feature.properties?.context, 'country');

    return {
      id: feature.id || feature.properties?.mapbox_id || addressLine,
      label: [addressLine, city, postcode].filter(Boolean).join(', '),
      addressLine,
      city,
      postcode,
      province,
      country: country || 'South Africa',
      longitude: Array.isArray(feature.geometry?.coordinates) ? Number(feature.geometry.coordinates[0]) : null,
      latitude: Array.isArray(feature.geometry?.coordinates) ? Number(feature.geometry.coordinates[1]) : null,
    };
  });
}
