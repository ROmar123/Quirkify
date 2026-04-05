import axios from 'axios';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const yocoSecretKey = process.env.YOCO_SECRET_KEY;

    if (!yocoSecretKey) {
      return res.status(400).json({
        status: 'FAIL',
        reason: 'YOCO_SECRET_KEY environment variable not set'
      });
    }

    // Test basic key format
    const keyFormatValid = yocoSecretKey.startsWith('sk_test_') || yocoSecretKey.startsWith('sk_live_');

    if (!keyFormatValid) {
      return res.status(400).json({
        status: 'FAIL',
        reason: 'Invalid key format. Must start with sk_test_ or sk_live_',
        keyPrefix: yocoSecretKey.substring(0, 15),
        keyLength: yocoSecretKey.length
      });
    }

    // Try to create a test checkout
    console.log('Testing Yoco API with key:', yocoSecretKey.substring(0, 20) + '...');

    const response = await axios.post('https://online.yoco.com/v1/checkouts', {
      amount: 100, // 1 ZAR in cents
      currency: 'ZAR',
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
      metadata: { test: true }
    }, {
      headers: {
        'Authorization': `Bearer ${yocoSecretKey}`,
        'Content-Type': 'application/json'
      }
    });

    return res.status(200).json({
      status: 'SUCCESS',
      message: 'Yoco API is working correctly',
      redirectUrl: response.data.redirectUrl,
      transactionId: response.data.id
    });

  } catch (error: any) {
    const status = error.response?.status;
    const errorData = error.response?.data;

    console.error('Yoco test failed:', {
      httpStatus: status,
      yocoError: errorData,
      message: error.message
    });

    // Diagnose the problem
    if (status === 401) {
      return res.status(400).json({
        status: 'FAIL',
        reason: 'Invalid API key (401 Unauthorized)',
        diagnosis: 'Check your YOCO_SECRET_KEY in Vercel environment variables'
      });
    }

    if (status === 403) {
      return res.status(400).json({
        status: 'FAIL',
        reason: 'API key does not have permission (403 Forbidden)',
        diagnosis: 'Your Yoco account may not have API access enabled'
      });
    }

    if (status === 404) {
      return res.status(400).json({
        status: 'FAIL',
        reason: 'Endpoint not found (404)',
        diagnosis: 'The Yoco API endpoint may have changed or your account type does not support this'
      });
    }

    if (error.code === 'ECONNREFUSED') {
      return res.status(400).json({
        status: 'FAIL',
        reason: 'Connection refused',
        diagnosis: 'Cannot reach Yoco servers. Check your internet connection.'
      });
    }

    return res.status(500).json({
      status: 'FAIL',
      reason: error.message,
      httpStatus: status,
      yocoResponse: typeof errorData === 'string' ? errorData.substring(0, 500) : errorData
    });
  }
}
