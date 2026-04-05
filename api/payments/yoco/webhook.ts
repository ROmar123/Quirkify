import admin from 'firebase-admin';
import crypto from 'crypto';

let adminDb: admin.firestore.Firestore | null = null;

// Initialize Firebase Admin
try {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    : null;

  if (serviceAccount && !admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }

  if (admin.apps.length > 0) {
    adminDb = admin.firestore();
  }
} catch (error) {
  console.warn('Firebase Admin not initialized:', error);
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const event = req.body;
    const signatureHeader = req.headers['x-yoco-signature'];
    const yocoSecretKey = process.env.YOCO_SECRET_KEY;

    // Verify signature in production
    if (process.env.NODE_ENV === 'production') {
      if (!signatureHeader || !verifyYocoSignature(event, signatureHeader as string, yocoSecretKey || '')) {
        console.warn('Invalid webhook signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    console.log('Processing Yoco webhook event:', event.type);

    // Handle payment.completed
    if (event.type === 'payment.completed') {
      const orderId = event.data?.metadata?.orderId;

      if (!orderId) {
        console.warn('No orderId in webhook');
        return res.status(400).json({ error: 'No orderId' });
      }

      if (!adminDb) {
        console.warn('Firebase not initialized');
        return res.status(500).json({ error: 'Database not available' });
      }

      try {
        await adminDb.collection('orders').doc(orderId).update({
          status: 'processing',
          paymentConfirmedAt: new Date().toISOString(),
          paymentInfo: {
            transactionId: event.data.id,
            amount: event.data.amount,
            currency: event.data.currency,
            completedAt: event.data.createdAt
          }
        });
        console.log(`Order ${orderId} payment confirmed`);
      } catch (error) {
        console.error(`Failed to update order ${orderId}:`, error);
        return res.status(500).json({ error: 'Failed to update order' });
      }
    }

    // Handle payment.failed
    if (event.type === 'payment.failed') {
      const orderId = event.data?.metadata?.orderId;

      if (!orderId) {
        console.warn('No orderId in failed payment webhook');
        return res.status(400).json({ error: 'No orderId' });
      }

      if (!adminDb) {
        console.warn('Firebase not initialized');
        return res.status(500).json({ error: 'Database not available' });
      }

      try {
        await adminDb.collection('orders').doc(orderId).update({
          status: 'payment_failed',
          failureReason: event.data.failureReason,
          failedAt: new Date().toISOString()
        });
        console.log(`Order ${orderId} payment failed`);
      } catch (error) {
        console.error(`Failed to update failed order ${orderId}:`, error);
        return res.status(500).json({ error: 'Failed to update order' });
      }
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
}

function verifyYocoSignature(payload: any, signature: string, secret: string): boolean {
  try {
    const hash = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('base64');
    return hash === signature;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}
