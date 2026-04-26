import { auth } from '../firebase';
import { fetchOrders } from './orderService';
import type { Order, OrderLineItem, OrderStatus, PaymentStatus, ShippingStatus } from '../types';

type RawOrderItem = {
  id?: string;
  product_id?: string | null;
  productId?: string | null;
  product_name?: string;
  productName?: string;
  product_image_url?: string | null;
  productImageUrl?: string | null;
  quantity?: number;
  unit_price?: number | string;
  unitPrice?: number | string;
  line_total?: number | string;
  lineTotal?: number | string;
};

type RawOrder = {
  id: string;
  order_number: string;
  orderNumber?: string;
  profile_id: string | null;
  profileId?: string | null;
  customer_email: string;
  customerEmail?: string;
  customer_name: string;
  customerName?: string;
  customer_phone: string | null;
  customerPhone?: string | null;
  channel: string;
  status: string;
  payment_status: string | null;
  paymentStatus?: string | null;
  shipping_cost?: number | string | null;
  shippingCost?: number | string | null;
  subtotal?: number | string | null;
  total: number | string;
  customer_notes?: string | null;
  customerNotes?: string | null;
  admin_notes?: string | null;
  adminNotes?: string | null;
  shipping_address?: string | null;
  shippingAddress?: string | null;
  shipping_city?: string | null;
  shippingCity?: string | null;
  shipping_zip?: string | null;
  shippingZip?: string | null;
  created_at: string;
  createdAt?: string;
  updated_at: string;
  updatedAt?: string;
  checkout_session_id?: string | null;
  checkoutSessionId?: string | null;
  source_ref?: string | null;
  sourceRef?: string | null;
  items?: RawOrderItem[];
};

function mapOrderStatus(status: string, paymentStatus: string | null): OrderStatus {
  if (status === 'pending') return 'pending_payment';
  if (status === 'paid') return 'confirmed';
  if (status === 'processing') return 'processing';
  if (status === 'shipped') return 'shipped';
  if (status === 'delivered') return 'delivered';
  if (status === 'refunded') return 'refunded';
  if (status === 'cancelled' || status === 'payment_failed') return 'cancelled';
  if (paymentStatus === 'completed') return 'confirmed';
  return 'pending_payment';
}

function toDbOrderStatus(status: string): string {
  if (status === 'pending_payment') return 'pending';
  if (status === 'confirmed' || status === 'ready_to_ship') return 'paid';
  return status;
}

function mapPaymentStatus(value: string | null): PaymentStatus {
  if (value === 'completed') return 'paid';
  if (value === 'redirected') return 'pending';
  if (value === 'failed') return 'failed';
  if (value === 'cancelled') return 'cancelled';
  if (value === 'refunded') return 'refunded';
  if (value === 'manual_review') return 'manual_review';
  if (value === 'paid') return 'paid';
  if (value === 'pending') return 'pending';
  return 'unpaid';
}

function mapShippingStatus(status: string): ShippingStatus {
  if (status === 'processing' || status === 'paid') return 'packing';
  if (status === 'shipped') return 'shipped';
  if (status === 'delivered') return 'delivered';
  if (status === 'refunded') return 'returned';
  return 'not_started';
}

function mapItems(items: RawOrderItem[] = []): OrderLineItem[] {
  return items.map((item) => ({
    type: 'product',
    refId: item.product_id || item.productId || item.id || '',
    title: item.product_name || item.productName || 'Product',
    image: item.product_image_url || item.productImageUrl || undefined,
    quantity: Number(item.quantity || 0),
    unitPrice: Number(item.unit_price || item.unitPrice || 0),
    lineTotal: Number(item.line_total || item.lineTotal || Number(item.unit_price || item.unitPrice || 0) * Number(item.quantity || 0)),
    inventoryReservations: { store: 0, auction: 0, packs: 0 },
  }));
}

function mapOrder(row: RawOrder, items: RawOrderItem[] = []): Order {
  return {
    id: row.id,
    orderNumber: row.order_number || row.orderNumber || '',
    customerId: row.profile_id || row.profileId || '',
    customerEmail: row.customer_email || row.customerEmail || '',
    customerName: row.customer_name || row.customerName || '',
    customerPhone: row.customer_phone || row.customerPhone || undefined,
    items: mapItems(items.length ? items : row.items || []),
    orderType: (row.channel as Order['orderType']) || 'store',
    status: mapOrderStatus(row.status, row.payment_status || row.paymentStatus || null),
    paymentStatus: mapPaymentStatus(row.payment_status || row.paymentStatus || null),
    shippingStatus: mapShippingStatus(row.status),
    subtotal: Number(row.subtotal || 0),
    shippingCost: Number(row.shipping_cost || row.shippingCost || 0),
    total: Number(row.total || 0),
    notes: row.customer_notes || row.customerNotes || undefined,
    adminNotes: row.admin_notes || row.adminNotes || undefined,
    checkoutUrl: row.checkout_session_id || row.checkoutSessionId || undefined,
    shippingAddress: (row.shipping_address || row.shippingAddress) ? {
      line1: row.shipping_address || row.shippingAddress || '',
      city: row.shipping_city || row.shippingCity || '',
      postalCode: row.shipping_zip || row.shippingZip || '',
    } : undefined,
    eventHistory: [],
    createdAt: row.created_at || row.createdAt || '',
    updatedAt: row.updated_at || row.updatedAt || '',
  };
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
  if (!firebaseUid) {
    throw new Error('You need to sign in before checking out.');
  }

  const response = await fetch('/api/commerce/store-checkout', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({
      firebaseUid,
      email: payload.customerEmail,
      displayName: payload.customerName,
      phone: payload.customerPhone,
      address: payload.line1,
      city: payload.city,
      zip: payload.postalCode,
      items: payload.items.map((item) => ({
        productId: item.productId || item.refId,
        quantity: item.quantity,
      })),
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Checkout failed');
  }

  return {
    checkoutUrl: data.redirectUrl as string | undefined,
    redirectUrl: data.redirectUrl as string | undefined,
    order: {
      id: data.orderId as string,
      orderNumber: data.orderNumber as string,
    },
  };
}

export async function cancelOrder(orderId: string) {
  const response = await fetch('/api/commerce/cancel-order', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ orderId }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to cancel order');
  }
  return data;
}

export async function updateOrder(orderId: string, updates: Record<string, unknown>) {
  const payload: Record<string, unknown> = { orderId };

  if (typeof updates.status === 'string') {
    payload.status = toDbOrderStatus(updates.status);
  }
  if (typeof updates.paymentStatus === 'string') {
    payload.paymentStatus = updates.paymentStatus;
  }
  if (typeof updates.shippingStatus === 'string') {
    payload.shippingStatus = updates.shippingStatus;
  }
  if (typeof updates.trackingNumber === 'string') {
    payload.trackingNumber = updates.trackingNumber;
  }
  if (typeof updates.carrier === 'string') {
    payload.carrier = updates.carrier;
  }
  if (typeof updates.adminNotes === 'string') {
    payload.adminNotes = updates.adminNotes;
  }

  const response = await fetch('/api/commerce/order-status', {
    method: 'PATCH',
    headers: await authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to update order');
  }
  return {
    order: mapOrder(data.order, data.items || []),
    events: data.events || [],
  };
}

export async function fetchOrdersForCustomer(profileId: string) {
  const orders = await fetchOrders({ profileId, excludeSourceRef: 'wallet_topup' });
  return orders.map((order) => mapOrder(order as unknown as RawOrder));
}

export async function fetchOrdersForAdmin() {
  const orders = await fetchOrders({ excludeSourceRef: 'wallet_topup' });
  return orders.map((order) => mapOrder(order as unknown as RawOrder));
}

export async function getOrder(orderId: string) {
  const response = await fetch(`/api/commerce/order-status?orderId=${encodeURIComponent(orderId)}&includeEvents=1`, {
    headers: await authHeaders(),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to load order');
  }
  return mapOrder(data.order as RawOrder, (data.items || []) as RawOrderItem[]);
}

export async function getLiveOrderCount() {
  const orders = await fetchOrders({ limit: 100 });
  return orders.length;
}
