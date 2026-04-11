import { expireStalePendingOrders, getSupabaseAdmin } from '../_lib/supabaseAdmin';

export default async function handler(req: any, res: any) {
  if (req.method === 'GET') {
    try {
      const orderId = String(req.query?.orderId || '').trim();
      const includeEvents = req.query?.includeEvents === '1';
      if (!orderId) {
        return res.status(400).json({ error: 'Missing orderId' });
      }

      await expireStalePendingOrders();
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from('orders')
        .select(includeEvents ? '*' : 'id, order_number, status, payment_status, total, checkout_session_id, reservation_expires_at, created_at, updated_at, source_ref, channel')
        .eq('id', orderId)
        .maybeSingle();

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      if (!data) {
        return res.status(404).json({ error: 'Order not found' });
      }

      if (!includeEvents) {
        return res.status(200).json({ order: data });
      }

      const [{ data: items }, { data: events }] = await Promise.all([
        supabase.from('order_items').select('*').eq('order_id', orderId).order('created_at', { ascending: true }),
        supabase.from('order_events').select('*').eq('order_id', orderId).order('created_at', { ascending: false }),
      ]);

      return res.status(200).json({ order: data, items: items || [], events: events || [] });
    } catch (error: any) {
      const message = error?.message || 'Failed to load order status';
      console.error('Order status error:', message);
      return res.status(500).json({ error: message });
    }
  }

  if (req.method === 'PATCH') {
    try {
      const orderId = String(req.body?.orderId || '').trim();
      const nextStatus = String(req.body?.status || '').trim();
      const trackingNumber = typeof req.body?.trackingNumber === 'string' ? req.body.trackingNumber.trim() : '';
      const carrier = typeof req.body?.carrier === 'string' ? req.body.carrier.trim() : '';
      const adminNotes = typeof req.body?.adminNotes === 'string' ? req.body.adminNotes.trim() : '';

      if (!orderId) {
        return res.status(400).json({ error: 'Missing orderId' });
      }

      await expireStalePendingOrders();
      const supabase = getSupabaseAdmin();
      const { data: currentOrder, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (orderError || !currentOrder) {
        return res.status(404).json({ error: 'Order not found' });
      }

      const updates: Record<string, unknown> = {};
      const previousStatus = currentOrder.status;
      const allowedTransitions: Record<string, string[]> = {
        pending: ['processing', 'cancelled', 'payment_failed'],
        paid: ['processing', 'shipped', 'cancelled', 'refunded'],
        processing: ['shipped', 'cancelled', 'refunded'],
        shipped: ['delivered', 'refunded'],
        delivered: ['refunded'],
        cancelled: [],
        refunded: [],
        payment_failed: [],
      };

      if (trackingNumber) updates.tracking_number = trackingNumber;
      if (carrier) updates.carrier = carrier;
      if (adminNotes) updates.admin_notes = adminNotes;

      if (nextStatus && nextStatus !== previousStatus) {
        const allowed = allowedTransitions[previousStatus] || [];
        if (!allowed.includes(nextStatus)) {
          return res.status(400).json({ error: `Cannot move order from ${previousStatus} to ${nextStatus}` });
        }

        updates.status = nextStatus;
        if (nextStatus === 'processing' && !currentOrder.paid_at) {
          updates.paid_at = new Date().toISOString();
        }
        if (nextStatus === 'shipped') {
          updates.shipped_at = new Date().toISOString();
        }
        if (nextStatus === 'delivered') {
          updates.delivered_at = new Date().toISOString();
        }
        if (nextStatus === 'cancelled') {
          updates.cancelled_at = new Date().toISOString();
        }
      }

      if (Object.keys(updates).length === 0) {
        return res.status(200).json({ order: currentOrder });
      }

      const { data: updatedOrder, error: updateError } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', orderId)
        .select('*')
        .single();

      if (updateError) {
        return res.status(400).json({ error: updateError.message });
      }

      if (nextStatus && nextStatus !== previousStatus) {
        await supabase.rpc('log_order_event', {
          p_order_id: orderId,
          p_event_type: 'admin_status_updated',
          p_from_status: previousStatus,
          p_to_status: nextStatus,
          p_note: adminNotes || `Admin moved order to ${nextStatus}`,
          p_metadata: {
            tracking_number: trackingNumber || null,
            carrier: carrier || null,
          },
        });
      } else if (trackingNumber || carrier || adminNotes) {
        await supabase.rpc('log_order_event', {
          p_order_id: orderId,
          p_event_type: 'admin_fulfilment_updated',
          p_from_status: previousStatus,
          p_to_status: previousStatus,
          p_note: adminNotes || 'Fulfilment details updated',
          p_metadata: {
            tracking_number: trackingNumber || null,
            carrier: carrier || null,
          },
        });
      }

      const [{ data: items }, { data: events }] = await Promise.all([
        supabase.from('order_items').select('*').eq('order_id', orderId).order('created_at', { ascending: true }),
        supabase.from('order_events').select('*').eq('order_id', orderId).order('created_at', { ascending: false }),
      ]);

      return res.status(200).json({ order: updatedOrder, items: items || [], events: events || [] });
    } catch (error: any) {
      const message = error?.message || 'Failed to update order';
      console.error('Order update error:', message);
      return res.status(500).json({ error: message });
    }
  }

  res.setHeader('Allow', 'GET, PATCH');
  return res.status(405).json({ error: 'Method not allowed' });
}
