import axios from 'axios';

export default async function handler(req: any, res: any) {
  const yocoKey = process.env.YOCO_SECRET_KEY;

  if (!yocoKey) {
    return res.json({ error: 'No YOCO_SECRET_KEY' });
  }

  const endpoints = [
    'https://online.yoco.com/v1/checkouts',
    'https://api.yoco.com/v1/checkouts',
    'https://online.yoco.com/api/checkouts',
    'https://online.yoco.com/checkouts',
    'https://api.yoco.com/checkouts',
  ];

  const results: any[] = [];

  for (const endpoint of endpoints) {
    try {
      const response = await axios.post(endpoint, {
        amount: 100,
        currency: 'ZAR',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel'
      }, {
        headers: {
          'Authorization': `Bearer ${yocoKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      });

      results.push({
        endpoint,
        status: 'SUCCESS',
        redirectUrl: response.data.redirectUrl
      });
    } catch (error: any) {
      results.push({
        endpoint,
        status: error.response?.status || error.code,
        message: error.response?.statusText || error.message
      });
    }
  }

  return res.json({ results });
}
