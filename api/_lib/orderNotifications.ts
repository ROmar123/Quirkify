import { getSupabaseAdmin } from './supabaseAdmin.js';

type NotificationStatus = 'paid' | 'payment_failed' | 'cancelled' | 'shipped' | 'delivered';

function formatCurrency(amount: number | null | undefined) {
  return `R${Number(amount ?? 0).toFixed(2)}`;
}

function buildEmailCopy(params: {
  orderNumber: string;
  customerName: string;
  status: NotificationStatus;
  total: number;
  itemNames: string[];
  trackingNumber?: string | null;
  carrier?: string | null;
}) {
  const name = params.customerName || 'there';
  const itemSummary = params.itemNames.length > 0 ? params.itemNames.join(', ') : 'your Quirkify order';
  const trackingLine = params.trackingNumber
    ? `<p><strong>Tracking number:</strong> ${params.trackingNumber}${params.carrier ? ` (${params.carrier})` : ''}</p>`
    : '';

  const base = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;max-width:560px;margin:0 auto">
      <div style="background:linear-gradient(135deg,#ec4899,#a855f7);padding:24px 28px;border-radius:12px 12px 0 0">
        <h1 style="color:#fff;margin:0;font-size:20px;font-weight:800;letter-spacing:-0.3px">Quirkify</h1>
      </div>
      <div style="background:#fff;padding:28px;border:1px solid #f3f4f6;border-top:none;border-radius:0 0 12px 12px">
  `;
  const footer = `
      </div>
      <p style="text-align:center;color:#9ca3af;font-size:11px;margin-top:16px">
        Questions? Reply to this email or visit quirkify.co.za
      </p>
    </div>
  `;

  if (params.status === 'paid') {
    return {
      subject: `Order confirmed ✓ — ${params.orderNumber}`,
      html: base + `
        <h2 style="margin:0 0 8px;font-size:22px;color:#111827">Payment confirmed</h2>
        <p>Hi ${name},</p>
        <p>Your payment for order <strong>${params.orderNumber}</strong> has been confirmed. We're preparing your items now.</p>
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0">
          <p style="margin:0 0 4px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em">Order summary</p>
          <p style="margin:4px 0;font-size:14px;color:#111827"><strong>${itemSummary}</strong></p>
          <p style="margin:4px 0;font-size:14px;color:#111827">Total: <strong>${formatCurrency(params.total)}</strong></p>
        </div>
        <p>We'll send you another email as soon as your order ships.</p>
      ` + footer,
    };
  }

  if (params.status === 'shipped') {
    return {
      subject: `Your order is on its way 🚚 — ${params.orderNumber}`,
      html: base + `
        <h2 style="margin:0 0 8px;font-size:22px;color:#111827">Your order has shipped</h2>
        <p>Hi ${name},</p>
        <p>Great news — order <strong>${params.orderNumber}</strong> is on its way to you!</p>
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0">
          <p style="margin:0 0 4px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em">Items shipped</p>
          <p style="margin:4px 0;font-size:14px;color:#111827">${itemSummary}</p>
          ${trackingLine}
        </div>
        <p>You can track your order status any time in your <a href="https://quirkify.co.za/orders" style="color:#a855f7;font-weight:600">order history</a>.</p>
      ` + footer,
    };
  }

  if (params.status === 'delivered') {
    return {
      subject: `Delivered! Enjoy your order 🎉 — ${params.orderNumber}`,
      html: base + `
        <h2 style="margin:0 0 8px;font-size:22px;color:#111827">Order delivered</h2>
        <p>Hi ${name},</p>
        <p>Your order <strong>${params.orderNumber}</strong> has been marked as delivered. We hope you love what's inside!</p>
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:16px 0">
          <p style="margin:0;font-size:14px;color:#166534">${itemSummary}</p>
        </div>
        <p>If something's not right, reply to this email and we'll sort it out.</p>
      ` + footer,
    };
  }

  if (params.status === 'payment_failed') {
    return {
      subject: `Payment not completed — ${params.orderNumber}`,
      html: base + `
        <h2 style="margin:0 0 8px;font-size:22px;color:#111827">Payment failed</h2>
        <p>Hi ${name},</p>
        <p>Your payment for <strong>${params.orderNumber}</strong> did not go through. Your reserved items have been released.</p>
        <p>Head back to <a href="https://quirkify.co.za" style="color:#a855f7;font-weight:600">Quirkify</a> to try again — items may still be available.</p>
      ` + footer,
    };
  }

  // cancelled
  return {
    subject: `Checkout cancelled — ${params.orderNumber}`,
    html: base + `
      <h2 style="margin:0 0 8px;font-size:22px;color:#111827">Checkout cancelled</h2>
      <p>Hi ${name},</p>
      <p>Your checkout for <strong>${params.orderNumber}</strong> was cancelled before payment was completed.</p>
      <p>You can <a href="https://quirkify.co.za" style="color:#a855f7;font-weight:600">return to Quirkify</a> any time to place a new order.</p>
    ` + footer,
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
    .select('id, order_number, customer_email, customer_name, total, tracking_number, carrier')
    .eq('id', orderId)
    .maybeSingle();

  if (orderError) throw new Error(orderError.message);
  if (!order?.customer_email) return;

  const { data: items } = await supabase
    .from('order_items')
    .select('product_name')
    .eq('order_id', orderId);

  const emailCopy = buildEmailCopy({
    orderNumber: order.order_number,
    customerName: order.customer_name || '',
    status,
    total: Number(order.total ?? 0),
    itemNames: (items || []).map((i: any) => i.product_name).filter(Boolean),
    trackingNumber: order.tracking_number,
    carrier: order.carrier,
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
    throw new Error(`Resend failed: ${response.status} ${text}`);
  }
}
