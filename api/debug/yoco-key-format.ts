import axios from 'axios';

export default async function handler(req: any, res: any) {
  const fullKey = process.env.YOCO_SECRET_KEY;

  if (!fullKey) {
    return res.json({ error: 'No YOCO_SECRET_KEY' });
  }

  // Try different key formats
  const keyVariations = [
    { name: 'Full key (as-is)', key: fullKey },
    { name: 'Key without sk_test_ prefix', key: fullKey.replace('sk_test_', '') },
    { name: 'Key with colon suffix', key: fullKey + ':' },
  ];

  const endpoint = 'https://api.yoco.com/v1/checkouts';
  const results: any[] = [];

  for (const variation of keyVariations) {
    try {
      const response = await axios.post(endpoint, {
        amount: 100,
        currency: 'ZAR',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel'
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${variation.key}`
        },
        timeout: 5000
      });

      results.push({
        keyFormat: variation.name,
        status: 'SUCCESS',
        redirectUrl: response.data.redirectUrl
      });
    } catch (error: any) {
      results.push({
        keyFormat: variation.name,
        status: error.response?.status || error.code,
        message: error.response?.statusText || error.message,
        detail: error.response?.data?.message || ''
      });
    }
  }

  return res.json({ endpoint, fullKeyPrefix: fullKey.substring(0, 20), results });
}
