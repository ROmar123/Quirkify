import axios from 'axios';

export default async function handler(req: any, res: any) {
  const yocoKey = process.env.YOCO_SECRET_KEY;

  if (!yocoKey) {
    return res.json({ error: 'No YOCO_SECRET_KEY' });
  }

  const authMethods = [
    { name: 'Bearer token', header: { 'Authorization': `Bearer ${yocoKey}` } },
    { name: 'Basic auth', header: { 'Authorization': `Basic ${Buffer.from(yocoKey + ':').toString('base64')}` } },
    { name: 'X-API-Key header', header: { 'X-API-Key': yocoKey } },
    { name: 'Key prefix', header: { 'Authorization': `Key ${yocoKey}` } },
  ];

  const endpoint = 'https://api.yoco.com/v1/checkouts';
  const results: any[] = [];

  for (const method of authMethods) {
    try {
      const response = await axios.post(endpoint, {
        amount: 100,
        currency: 'ZAR',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel'
      }, {
        headers: {
          'Content-Type': 'application/json',
          ...method.header
        },
        timeout: 5000
      });

      results.push({
        authMethod: method.name,
        status: 'SUCCESS',
        redirectUrl: response.data.redirectUrl
      });
    } catch (error: any) {
      results.push({
        authMethod: method.name,
        status: error.response?.status || error.code,
        message: error.response?.statusText || error.message
      });
    }
  }

  return res.json({ endpoint, results });
}
