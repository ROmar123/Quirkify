# Yoco Payment Integration Setup

This document explains how to set up Yoco payments and webhooks for Quirkify.

## Current Implementation

The payment flow has three parts:

1. **Checkout Initiation** - Customer creates an order and initiates checkout
   - Order created with status: `pending`
   - Redirects to Yoco hosted checkout page

2. **Payment Processing** - Customer completes payment on Yoco
   - Yoco processes the payment
   - Sends webhook event to `/api/payments/yoco/webhook`
   - OR customer returns via success/cancel URL

3. **Order Confirmation** - Order status updates based on payment result
   - Success: Order status → `processing` (ready to ship)
   - Failed: Order status → `payment_failed`
   - Webhook handler also stores payment transaction details

## Setup Instructions

### Step 1: Get Yoco API Keys

1. Sign up for Yoco at https://www.yoco.com
2. Go to Dashboard > Settings > API Keys
3. Copy your **Secret Key** (starts with `sk_live_` or `sk_test_`)
4. Copy your **Public Key** (starts with `pk_live_` or `pk_test_`)

### Step 2: Configure Environment Variables

Create a `.env` file in the project root with:

```bash
# Yoco Payment Keys
YOCO_SECRET_KEY=sk_live_YOUR_SECRET_KEY_HERE
YOCO_PUBLIC_KEY=pk_live_YOUR_PUBLIC_KEY_HERE

# Firebase Admin SDK credentials (see Step 3)
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}

# Environment
NODE_ENV=production
```

### Step 3: Set Up Firebase Admin SDK

The webhook handler needs Firebase Admin SDK credentials to update order status in Firestore.

1. Go to Firebase Console > Project Settings > Service Accounts
2. Click "Generate New Private Key"
3. Copy the entire JSON content
4. Set as environment variable (minified):
   ```bash
   FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"...","private_key":"...","client_email":"...","client_id":"...","auth_uri":"...","token_uri":"...","auth_provider_x509_cert_url":"...","client_x509_cert_url":"..."}'
   ```

Or store as a file and load in server.ts (update the implementation if needed).

### Step 4: Configure Yoco Webhook

1. Go to Yoco Dashboard > Settings > Webhooks
2. Add a new webhook with:
   - **URL**: `https://your-domain.com/api/payments/yoco/webhook`
   - **Events**: Select `payment.completed` and `payment.failed`

3. Copy the webhook secret key (shown once)

**Note**: Webhook signature verification is currently disabled in test mode. Enable it in production:
- Add the secret key to a new env variable: `YOCO_WEBHOOK_SECRET`
- Update server.ts line 81 to verify the signature

### Step 5: Test the Flow

1. Start the server: `npm run dev`
2. Create a test order on the store
3. Use Yoco test card: `4242 4242 4242 4242`, any future date, any CVC
4. Check Firebase Console > Firestore > orders collection to verify status changed

## Order Status Flow

```
pending
  ↓
  ├─→ [Payment on Yoco] ←─┐
  ↓                        │
  ├─→ Webhook received     │
  │   (payment.completed)  │
  ↓                        │
processing                 │
  ↓                        │
shipping (manual)          │
  ↓                        │
delivered (manual)         │


pending
  ↓
  ├─→ [Payment Failed] ←─┐
  ↓                      │
payment_failed ←─────────┘
```

## Webhook Events

The webhook handler processes these Yoco events:

### payment.completed
- Updates order status to `processing`
- Stores transaction ID and payment details
- Sets `paymentConfirmedAt` timestamp

### payment.failed
- Updates order status to `payment_failed`
- Stores failure reason
- Sets `failedAt` timestamp

## Troubleshooting

### Webhook Not Being Called

1. Check Yoco dashboard for webhook delivery logs
2. Verify the webhook URL is publicly accessible (not localhost)
3. Ensure `YOCO_SECRET_KEY` is correct
4. Check server logs for errors

### Order Status Not Updating

1. Verify `FIREBASE_SERVICE_ACCOUNT` is configured
2. Check Firebase Console for permission errors
3. Ensure the service account has Firestore write access
4. Verify order document exists in Firestore

### Signature Verification Failing

1. Ensure you're using the correct secret key
2. Verify the webhook payload hasn't been modified
3. Check that HMAC-SHA256 verification logic is correct
4. Enable debug logging in `verifyYocoSignature` function

## Security Notes

1. **Do NOT** commit `.env` file with real keys to version control
2. **Do NOT** expose Yoco secret keys in frontend code
3. Always use HTTPS in production (required by Yoco)
4. Enable webhook signature verification in production
5. Regularly rotate API keys
6. Monitor webhook delivery logs for anomalies

## Next Steps

1. Test payment flow end-to-end
2. Set up error notifications (Slack, email)
3. Implement payment retry logic
4. Add refund processing endpoint
5. Set up payment analytics dashboard

