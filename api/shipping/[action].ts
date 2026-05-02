import { getShippingQuote, getTrackingDetails, bookShipment } from '../_lib/shipping.js';
import { requireVerifiedUser, sendAuthError } from '../_lib/auth.js';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js';

export default async function handler(req: any, res: any) {
  const action = String(req.query?.action || '').trim();

  if (action === 'quote') {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'Method not allowed' });
    }
    try {
      const quote = await getShippingQuote({
        city: req.body?.city ?? null,
        zip: req.body?.zip ?? null,
        lat: req.body?.lat ?? null,
        lng: req.body?.lng ?? null,
        street_address: req.body?.street_address ?? null,
        suburb: req.body?.suburb ?? null,
        entered_address: req.body?.entered_address ?? null,
      });
      return res.json(quote);
    } catch {
      return res.status(500).json({ error: 'Failed to get shipping quote' });
    }
  }

  if (action === 'track') {
    try {
      const details = await getTrackingDetails({
        trackingNumber: String(req.query?.trackingNumber || ''),
      });
      return res.json(details);
    } catch {
      return res.status(500).json({ error: 'Failed to load tracking details' });
    }
  }

  // Admin-only: book a shipment with Courier Guy
  if (action === 'book') {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'Method not allowed' });
    }
    try {
      const verifiedUser = await requireVerifiedUser(req);
      if (!verifiedUser.isAdmin) return res.status(403).json({ error: 'Admin access required' });

      const { orderId } = req.body ?? {};
      if (!orderId) return res.status(400).json({ error: 'Missing orderId' });

      const supabase = getSupabaseAdmin();
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('id, order_number, customer_name, customer_phone, shipping_address, shipping_city, shipping_zip, status')
        .eq('id', String(orderId))
        .single();

      if (orderError || !order) return res.status(404).json({ error: 'Order not found' });
      if (!['paid', 'confirmed', 'processing', 'packed'].includes(order.status)) {
        return res.status(400).json({ error: `Cannot book courier for order in status: ${order.status}` });
      }

      const result = await bookShipment({
        orderId: order.id,
        orderNumber: order.order_number,
        deliveryAddress: {
          street_address: order.shipping_address || '',
          city: order.shipping_city || '',
          code: order.shipping_zip || '',
        },
        customerName: order.customer_name || '',
        customerPhone: order.customer_phone || undefined,
      });

      if (result.success) {
        // Record in courier_shipments table
        await supabase.from('courier_shipments').insert({
          order_id: order.id,
          provider: 'tcg',
          booking_status: 'booked',
          tracking_number: result.trackingNumber || null,
          waybill_number: result.waybillNumber || null,
          raw_response: result.rawResponse || {},
          booked_at: new Date().toISOString(),
        });

        // Update order status to courier_booked + add tracking number
        await supabase.from('orders').update({
          status: 'courier_booked',
          tracking_number: result.trackingNumber || result.waybillNumber || null,
          carrier: 'The Courier Guy',
          updated_at: new Date().toISOString(),
        }).eq('id', order.id);

        await supabase.rpc('log_order_event', {
          p_order_id: order.id,
          p_event_type: 'courier_booked',
          p_from_status: order.status,
          p_to_status: 'courier_booked',
          p_note: `Courier Guy booked. Waybill: ${result.waybillNumber || result.trackingNumber || 'pending'}`,
          p_metadata: { waybill: result.waybillNumber, tracking: result.trackingNumber, ref: result.bookingReference },
        });
      } else {
        // Log failed booking attempt
        await supabase.from('courier_shipments').insert({
          order_id: order.id,
          provider: 'tcg',
          booking_status: 'failed',
          error_message: result.error || 'Unknown error',
          raw_response: result.rawResponse || {},
        });
      }

      return res.status(result.success ? 200 : 502).json(result);
    } catch (err: any) {
      if (err?.statusCode === 401) return sendAuthError(res, err);
      return res.status(500).json({ error: err.message || 'Failed to book shipment' });
    }
  }

  return res.status(404).json({ error: 'Unknown shipping action' });
}
