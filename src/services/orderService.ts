import { supabase } from '../supabase';

export type OrderStatus = 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded' | 'payment_failed';
export type OrderChannel = 'store' | 'auction' | 'pack' | 'whatsapp' | 'tiktok' | 'manual';
export type PaymentMethod = 'yoco' | 'eft' | 'cash' | 'whatsapp_pay' | 'free';

export interface OrderItem {
  id: string;
  productId: string | null;
  productName: string;
  productImageUrl: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  packContents?: any;
}

export interface Order {
  id: string;
  orderNumber: string;
  profileId: string | null;
  customerEmail: string;
  customerName: string;
  customerPhone: string | null;
  channel: OrderChannel;
  sourceRef: string | null;
  subtotal: number;
  discount: number;
  shippingCost: number;
  total: number;
  paymentMethod: PaymentMethod | null;
  paymentId: string | null;
  paymentStatus: string | null;
  paidAt: string | null;
  status: OrderStatus;
  shippingAddress: string | null;
  shippingCity: string | null;
  shippingZip: string | null;
  trackingNumber: string | null;
  carrier: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  customerNotes: string | null;
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
}

function rowToOrder(row: any, items: any[] = []): Order {
  return {
    id: row.id,
    orderNumber: row.order_number,
    profileId: row.profile_id,
    customerEmail: row.customer_email,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    channel: row.channel,
    sourceRef: row.source_ref,
    subtotal: Number(row.subtotal),
    discount: Number(row.discount),
    shippingCost: Number(row.shipping_cost),
    total: Number(row.total),
    paymentMethod: row.payment_method,
    paymentId: row.payment_id,
    paymentStatus: row.payment_status,
    paidAt: row.paid_at,
    status: row.status,
    shippingAddress: row.shipping_address,
    shippingCity: row.shipping_city,
    shippingZip: row.shipping_zip,
    trackingNumber: row.tracking_number,
    carrier: row.carrier,
    shippedAt: row.shipped_at,
    deliveredAt: row.delivered_at,
    customerNotes: row.customer_notes,
    adminNotes: row.admin_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: items.map(i => ({
      id: i.id,
      productId: i.product_id,
      productName: i.product_name,
      productImageUrl: i.product_image_url,
      unitPrice: Number(i.unit_price),
      quantity: i.quantity,
      lineTotal: Number(i.line_total),
      packContents: i.pack_contents,
    })),
  };
}

/** Create a new order with line items */
export async function createOrder(params: {
  profileId?: string;
  customerEmail: string;
  customerName: string;
  customerPhone?: string;
  channel: OrderChannel;
  sourceRef?: string;
  items: { productId: string; productName: string; productImageUrl?: string; unitPrice: number; quantity: number }[];
  discount?: number;
  shippingCost?: number;
  shippingAddress?: string;
  shippingCity?: string;
  shippingZip?: string;
  customerNotes?: string;
  paymentMethod?: PaymentMethod;
}): Promise<Order> {
  const subtotal = params.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .insert({
      profile_id: params.profileId || null,
      customer_email: params.customerEmail,
      customer_name: params.customerName,
      customer_phone: params.customerPhone || null,
      channel: params.channel,
      source_ref: params.sourceRef || null,
      subtotal,
      discount: params.discount || 0,
      shipping_cost: params.shippingCost || 0,
      shipping_address: params.shippingAddress || null,
      shipping_city: params.shippingCity || null,
      shipping_zip: params.shippingZip || null,
      customer_notes: params.customerNotes || null,
      payment_method: params.paymentMethod || null,
    })
    .select()
    .single();

  if (orderErr) throw new Error(orderErr.message);

  // Insert line items
  const itemRows = params.items.map(i => ({
    order_id: order.id,
    product_id: i.productId,
    product_name: i.productName,
    product_image_url: i.productImageUrl || null,
    unit_price: i.unitPrice,
    quantity: i.quantity,
  }));

  const { data: items, error: itemsErr } = await supabase
    .from('order_items')
    .insert(itemRows)
    .select();

  if (itemsErr) throw new Error(itemsErr.message);

  return rowToOrder(order, items);
}

/** Fetch order by ID with items */
export async function fetchOrder(id: string): Promise<Order | null> {
  const { data: order, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(error.message);
  }

  const { data: items } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', id);

  return rowToOrder(order, items || []);
}

/** Fetch orders with filters */
export async function fetchOrders(filters?: {
  profileId?: string;
  status?: OrderStatus;
  channel?: OrderChannel;
  limit?: number;
}): Promise<Order[]> {
  let query = supabase.from('orders').select('*');

  if (filters?.profileId) query = query.eq('profile_id', filters.profileId);
  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.channel) query = query.eq('channel', filters.channel);

  query = query.order('created_at', { ascending: false });
  if (filters?.limit) query = query.limit(filters.limit);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  // Batch-fetch items for all orders
  const orderIds = (data || []).map(o => o.id);
  const { data: allItems } = await supabase
    .from('order_items')
    .select('*')
    .in('order_id', orderIds);

  const itemsByOrder = (allItems || []).reduce((acc: Record<string, any[]>, item) => {
    (acc[item.order_id] = acc[item.order_id] || []).push(item);
    return acc;
  }, {});

  return (data || []).map(o => rowToOrder(o, itemsByOrder[o.id] || []));
}

/** Update order status */
export async function updateOrderStatus(id: string, status: OrderStatus, extras?: {
  paymentId?: string;
  paymentStatus?: string;
  trackingNumber?: string;
  carrier?: string;
  adminNotes?: string;
}): Promise<Order> {
  const updates: Record<string, any> = { status };

  if (status === 'paid') updates.paid_at = new Date().toISOString();
  if (status === 'shipped') updates.shipped_at = new Date().toISOString();
  if (status === 'delivered') updates.delivered_at = new Date().toISOString();
  if (status === 'cancelled') updates.cancelled_at = new Date().toISOString();

  if (extras?.paymentId) updates.payment_id = extras.paymentId;
  if (extras?.paymentStatus) updates.payment_status = extras.paymentStatus;
  if (extras?.trackingNumber) updates.tracking_number = extras.trackingNumber;
  if (extras?.carrier) updates.carrier = extras.carrier;
  if (extras?.adminNotes) updates.admin_notes = extras.adminNotes;

  const { data, error } = await supabase
    .from('orders')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);

  const { data: items } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', id);

  return rowToOrder(data, items || []);
}
