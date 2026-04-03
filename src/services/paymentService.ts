export const initiateYocoCheckout = async (amount: number, itemName: string, mPaymentId: string) => {
  try {
    const response = await fetch('/api/payments/yoco/initiate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ amount, item_name: itemName, m_payment_id: mPaymentId }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to initiate Yoco checkout');
    }

    const { redirectUrl } = await response.json();
    
    // Redirect to Yoco's hosted checkout page
    window.location.href = redirectUrl;
  } catch (error) {
    console.error('Yoco Payment initiation error:', error);
    throw error;
  }
};
