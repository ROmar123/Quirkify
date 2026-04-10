import { searchAddresses } from '../_lib/mapbox';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const query = String(req.query?.q || '');
    const suggestions = await searchAddresses(query);
    return res.status(200).json({ suggestions });
  } catch (error: any) {
    const status = error?.response?.status;
    const message = error?.response?.data?.message || error?.message || 'Failed to load address suggestions';
    return res.status(status === 401 ? 500 : 500).json({ error: message });
  }
}
