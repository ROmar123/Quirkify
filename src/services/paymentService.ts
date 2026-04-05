export const initiateYocoCheckout = async (amount: number, itemName: string, mPaymentId: string) => {
  try {
    const response = await fetch('/api/payments/yoco/initiate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
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
    const message = error instanceof Error ? error.message : 'Payment error occurred';
    console.error('Yoco checkout error:', message);
    alert(`Payment Error: ${message}`);
    throw error;
  }
};
