import { getSupabaseAdmin } from './supabaseAdmin';

type NotificationStatus = 'paid' | 'payment_failed' | 'cancelled';

function formatCurrency(amount: number | null | undefined) {
  return `R${Number(amount ?? 0).toFixed(2)}`;
}

function buildEmailCopy(params: {
  orderNumber: string;
  customerName: string;
  status: NotificationStatus;
  total: number;
  itemNames: string[];
}) {
  const itemSummary = params.itemNames.length > 0 ? params.itemNames.join(', ') : 'your Quirkify order';

  if (params.status === 'paid') {
    return {
      subject: `Quirkify order confirmed: ${params.orderNumber}`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#2D1B69">
          <h2>Payment confirmed</h2>
          <p>Hi ${params.customerName || 'there'},</p>
          <p>Your payment for <strong>${params.orderNumber}</strong> has been confirmed.</p>
          <p><strong>Items:</strong> ${itemSummary}</p>
          <p><strong>Total:</strong> ${formatCurrency(params.total)}</p>
          <p>We’ll email you again when your order moves forward.</p>
        </div>
      `,
    };
  }

  if (params.status === 'payment_failed') {
    return {
      subject: `Quirkify payment failed: ${params.orderNumber}`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#2D1B69">
          <h2>Payment failed</h2>
          <p>Hi ${params.customerName || 'there'},</p>
          <p>Your payment for <strong>${params.orderNumber}</strong> did not go through.</p>
          <p>Your reserved stock has been released, so you can try checkout again if the items are still available.</p>
        </div>
      `,
    };
  }

  return {
    subject: `Quirkify checkout cancelled: ${params.orderNumber}`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#2D1B69">
        <h2>Checkout cancelled</h2>
        <p>Hi ${params.customerName || 'there'},</p>
        <p>Your checkout for <strong>${params.orderNumber}</strong> was cancelled before payment was confirmed.</p>
        <p>You can return to Quirkify any time to complete the purchase again.</p>
      </div>
    `,
  };
}

export async function sendOrderStatusEmail(orderId: string, status: NotificationStatus) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.QUIRKIFY_FROM_EMAIL;

  if (!resendApiKey || !fromEmail) {
    return;
  }

  const supabase = getSupabaseAdmin();
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, order_number, customer_email, customer_name, total')
    .eq('id', orderId)
    .maybeSingle();

  if (orderError) {
    throw new Error(orderError.message);
  }

  if (!order?.customer_email) {
    return;
  }

  const { data: items, error: itemsError } = await supabase
    .from('order_items')
    .select('product_name')
    .eq('order_id', orderId);

  if (itemsError) {
    throw new Error(itemsError.message);
  }

  const emailCopy = buildEmailCopy({
    orderNumber: order.order_number,
    customerName: order.customer_name || '',
    status,
    total: Number(order.total ?? 0),
    itemNames: (items || []).map((item) => item.product_name).filter(Boolean),
  });

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [order.customer_email],
      subject: emailCopy.subject,
      html: emailCopy.html,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Resend request failed: ${response.status} ${text}`);
  }
}
