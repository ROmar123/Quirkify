import { auth } from '../firebase';

interface StoreCheckoutPayload {
  firebaseUid: string;
  email: string;
  displayName?: string | null;
  phone: string;
  address: string;
  city: string;
  zip: string;
  items: { productId: string; quantity: number }[];
  shippingCost?: number;
}

async function authHeaders() {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('You need to sign in before continuing.');
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export const startStoreCheckout = async (payload: StoreCheckoutPayload) => {
  const response = await fetch('/api/commerce/store-checkout', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to start checkout');
  }

  if (!data.redirectUrl) {
    throw new Error('Payment redirect URL missing from checkout response');
  }

  window.location.href = data.redirectUrl;
};

export const cancelStoreCheckout = async (orderId: string, reason?: string) => {
  const response = await fetch('/api/commerce/cancel-order', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ orderId, reason }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to cancel checkout order');
  }

  return data.order;
};

export const resumeStoreCheckout = async (orderId: string) => {
  const response = await fetch('/api/commerce/cancel-order', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ orderId, action: 'resume' }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to resume checkout');
  }

  if (!data.redirectUrl) {
    throw new Error('Payment redirect URL missing from resume response');
  }

  window.location.href = data.redirectUrl;
};

export const getStoreCheckoutStatus = async (orderId: string) => {
  const response = await fetch(`/api/commerce/order-status?orderId=${encodeURIComponent(orderId)}`, {
    headers: await authHeaders(),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to load order status');
  }

  return data.order as {
    id: string;
    order_number: string;
    status: string;
    payment_status: string | null;
    source_ref: string | null;
    channel: string;
    total: number;
    checkout_session_id: string | null;
    reservation_expires_at: string | null;
    created_at: string;
    updated_at: string;
  };
};

export const initiateYocoCheckout = async (amount: number, itemName: string, mPaymentId: string) => {
  try {
    const response = await fetch('/api/payments/yoco/initiate', {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ amount, item_name: itemName, m_payment_id: mPaymentId }),
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMessage = data.error || 'Failed to initiate payment. Please try again.';
      console.error('Payment error:', errorMessage);
      throw new Error(errorMessage);
    }

    if (!data.redirectUrl) {
      console.error('No redirect URL in response:', data);
      throw new Error('Payment service error. Please try again.');
    }

    // Redirect to Yoco's hosted checkout page
    window.location.href = data.redirectUrl;
  } catch (error) {
    throw error instanceof Error ? error : new Error('Payment error occurred');
  }
};
