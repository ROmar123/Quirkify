import axios from 'axios';

export default async function handler(req: any, res: any) {
  const liveKey = process.env.YOCO_SECRET_KEY;

  if (!liveKey) {
    return res.json({ error: 'No key' });
  }

  const endpoint = 'https://api.yoco.com/v1/checkouts';
  const payload = {
    amount: 100,
    currency: 'ZAR',
    successUrl: 'https://example.com/success',
    cancelUrl: 'https://example.com/cancel'
  };

  const tests = [
    {
      name: 'Bearer in header',
      headers: { 'Authorization': `Bearer ${liveKey}` }
    },
    {
      name: 'Key in Authorization without Bearer',
      headers: { 'Authorization': liveKey }
    },
    {
      name: 'X-API-Key header',
      headers: { 'X-API-Key': liveKey }
    },
    {
      name: 'Key in body as apiKey',
      headers: {},
      bodyAddition: { apiKey: liveKey }
    },
    {
      name: 'Key in body as key',
      headers: {},
      bodyAddition: { key: liveKey }
    },
  ];

  const results: any[] = [];

  for (const test of tests) {
    try {
      const body = test.bodyAddition ? { ...payload, ...test.bodyAddition } : payload;

      const response = await axios.post(endpoint, body, {
        headers: {
          'Content-Type': 'application/json',
          ...test.headers
        },
        validateStatus: () => true,
        timeout: 5000
      });

      results.push({
        test: test.name,
        status: response.status,
        success: response.status === 200 || response.status === 201,
        data: response.status === 200 ? response.data : response.data?.detail || response.data?.message
      });
    } catch (error: any) {
      results.push({
        test: test.name,
        status: 'ERROR',
        error: error.message
      });
    }
  }

  return res.json({ endpoint, results });
}
