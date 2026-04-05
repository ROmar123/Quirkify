import axios from 'axios';

export default async function handler(req: any, res: any) {
  const yocoKey = process.env.YOCO_SECRET_KEY;

  if (!yocoKey) {
    return res.json({ error: 'No YOCO_SECRET_KEY' });
  }

  try {
    const response = await axios.post('https://online.yoco.com/v1/checkouts', {
      amount: 100,
      currency: 'ZAR',
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel'
    }, {
      headers: {
        'Authorization': `Bearer ${yocoKey}`,
        'Content-Type': 'application/json'
      }
    });

    return res.json({ success: true, data: response.data });
  } catch (error: any) {
    return res.json({
      error: true,
      status: error.response?.status,
      statusText: error.response?.statusText,
      message: error.message,
      yocoResponse: error.response?.data
    });
  }
}
