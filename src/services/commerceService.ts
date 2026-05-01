import { auth } from '../firebase';

async function authHeaders() {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('You need to sign in before continuing.');
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

/** Start a Yoco checkout — creates the order + stock reservation + returns the payment redirect URL */
export async function createCheckoutOrder(payload: {
  customerId: string;
  customerEmail: string;
  customerName: string;
  customerPhone?: string;
  line1: string;
  city: string;
  postalCode: string;
  items: Array<{ productId?: string; refId?: string; kind?: string; quantity: number }>;
}) {
  const firebaseUid = auth.currentUser?.uid;
  if (!firebaseUid) throw new Error('You need to sign in before checking out.');

  const response = await fetch('/api/commerce/store-checkout', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({
      firebaseUid,
      email:       payload.customerEmail,
      displayName: payload.customerName,
      phone:       payload.customerPhone,
      address:     payload.line1,
      city:        payload.city,
      zip:         payload.postalCode,
      items: payload.items.map(item => ({
        productId: item.productId || item.refId,
        quantity:  item.quantity,
      })),
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Checkout failed');

  return {
    checkoutUrl: data.redirectUrl as string | undefined,
    redirectUrl: data.redirectUrl as string | undefined,
    order: {
      id:          data.orderId as string,
      orderNumber: data.orderNumber as string,
    },
  };
}

/** Cancel an in-progress checkout and release the stock reservation */
export async function cancelOrder(orderId: string, reason?: string) {
  const response = await fetch('/api/commerce/cancel-order', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ orderId, reason }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to cancel order');
  return data;
}
