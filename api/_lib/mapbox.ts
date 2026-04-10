import axios from 'axios';

const MAPBOX_ACCESS_TOKEN =
  process.env.MAPBOX_ACCESS_TOKEN ||
  process.env.VITE_MAPBOX_ACCESS_TOKEN ||
  '';

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

function getContextValue(context: any[] | undefined, type: string) {
  return context?.find((entry) => entry.id?.startsWith(`${type}.`) || entry.mapbox_id?.includes(type))?.name || '';
}

export async function searchAddresses(query: string): Promise<AddressSuggestion[]> {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 3 || !MAPBOX_ACCESS_TOKEN) {
    return [];
  }

  const response = await axios.get('https://api.mapbox.com/search/geocode/v6/forward', {
    params: {
      q: trimmed,
      access_token: MAPBOX_ACCESS_TOKEN,
      country: 'ZA',
      language: 'en',
      types: 'address,street',
      limit: 5,
      autocomplete: true,
    },
    timeout: 8000,
  });

  const features = response.data?.features || [];
  return features.map((feature: any) => {
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
