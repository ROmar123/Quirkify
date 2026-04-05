import axios from 'axios';

export default async function handler(req: any, res: any) {
  const yocoKey = process.env.YOCO_SECRET_KEY;

  if (!yocoKey) {
    return res.json({ error: 'No key' });
  }

  try {
    const response = await axios.post('https://api.yoco.com/v1/checkouts', {
      amount: 100,
      currency: 'ZAR',
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel'
    }, {
      headers: {
        'Authorization': `Bearer ${yocoKey}`,
        'Content-Type': 'application/json'
      },
      validateStatus: () => true // Don't throw on any status
    });

    return res.json({
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      data: response.data,
      keyUsed: yocoKey.substring(0, 20) + '...'
    });
  } catch (error: any) {
    return res.json({
      error: error.message,
      keyUsed: yocoKey.substring(0, 20) + '...'
    });
  }
}
