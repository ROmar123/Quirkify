import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY;

const supabase =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { amount, item_name, m_payment_id } = req.body;

    // Validate inputs
    if (!amount || !m_payment_id) {
      console.error('Missing required fields:', { amount, m_payment_id });
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const yocoSecretKey = process.env.YOCO_SECRET_KEY;

    if (!yocoSecretKey) {
      console.error('YOCO_SECRET_KEY not configured');
      return res.status(500).json({ error: 'Payment system not configured. Contact support.' });
    }

    // Validate API key format
    if (!yocoSecretKey.startsWith('sk_test_') && !yocoSecretKey.startsWith('sk_live_')) {
      console.error('Invalid YOCO_SECRET_KEY format:', yocoSecretKey.substring(0, 10));
      return res.status(500).json({ error: 'Invalid payment key configuration' });
    }

    const origin = req.headers.origin || `https://${req.headers.host}`;
    const amountCents = Math.round(amount * 100);

    console.log('Initiating Yoco checkout:', {
      amount,
      amountCents,
      currency: 'ZAR',
      orderId: m_payment_id,
      keyPrefix: yocoSecretKey.substring(0, 10)
    });

    const response = await axios.post('https://payments.yoco.com/api/checkouts', {
      amount: amountCents,
      currency: 'ZAR',
      successUrl: `${origin}/payment/success?orderId=${m_payment_id}&amount=${amount}`,
      cancelUrl: `${origin}/payment/cancel?orderId=${m_payment_id}`,
      metadata: {
        orderId: m_payment_id,
        itemName: item_name
      }
    }, {
      headers: {
        'Authorization': `Bearer ${yocoSecretKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    console.log('Yoco checkout created successfully:', response.data.id);
    res.json({ redirectUrl: response.data.redirectUrl });
  } catch (error: any) {
    const status = error.response?.status;
    const errorData = error.response?.data;

    console.error('Yoco API Error:', {
      status,
      statusText: error.response?.statusText,
      data: typeof errorData === 'string' ? errorData.substring(0, 200) : errorData,
      message: error.message
    });

    // Return detailed error to frontend
    if (status === 401 || status === 403) {
      return res.status(400).json({
        error: 'Invalid payment credentials. Check Yoco API key.'
      });
    }

    if (status === 404) {
      return res.status(400).json({
        error: 'Payment service endpoint not found. Check Yoco account.'
      });
    }

    res.status(500).json({
      error: 'Payment initiation failed. Please try again.'
    });
  }
}
