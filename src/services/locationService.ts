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

export async function searchAddressSuggestions(query: string): Promise<AddressSuggestion[]> {
  const response = await fetch(`/api/location/address-autocomplete?q=${encodeURIComponent(query)}`, {
    headers: {
      Accept: 'application/json',
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to load address suggestions');
  }

  return data.suggestions || [];
}
