import axios from 'axios';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { amount, item_name, m_payment_id } = req.body;

    const yocoSecretKey = process.env.YOCO_SECRET_KEY;

    if (!yocoSecretKey) {
      return res.status(500).json({ error: 'Yoco API key not configured' });
    }

    const origin = req.headers.origin || `https://${req.headers.host}`;

    const response = await axios.post('https://online.yoco.com/v1/checkouts', {
      amount: Math.round(amount * 100),
      currency: 'ZAR',
      successUrl: `${origin}/payment/success?orderId=${m_payment_id}&amount=${amount}`,
      cancelUrl: `${origin}/payment/cancel`,
      metadata: {
        orderId: m_payment_id,
        itemName: item_name
      }
    }, {
      headers: {
        'Authorization': `Bearer ${yocoSecretKey}`,
        'Content-Type': 'application/json'
      }
    });

    res.json({ redirectUrl: response.data.redirectUrl });
  } catch (error: any) {
    const errorDetail = error.response?.data || error.message;
    console.error('Yoco Error:', errorDetail);
    res.status(500).json({ error: 'Failed to initiate Yoco payment', details: errorDetail });
  }
}
