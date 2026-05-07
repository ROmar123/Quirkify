// Merged commerce handler — routes all /api/commerce/* requests via req.query.action
// Replaces: store-checkout, wallet-checkout, wallet-topup, cancel-order, order-status, auction-close
import axios from 'axios';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '../_lib/firebaseAdmin.js';
import { requireVerifiedUser, sendAuthError } from '../_lib/auth.js';
import { normalizeEnvValue } from '../_lib/env.js';
import {
  ensureProfileByIdentity,
  expireStalePendingOrders,
  getSupabaseAdmin,
} from '../_lib/supabaseAdmin.js';
import { getShippingQuote } from '../_lib/shipping.js';

// ─── store-checkout ────────────────────────────────────────────────────────
async function handleStoreCheckout(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let createdOrderId: string | null = null;
  try {
    const verifiedUser = await requireVerifiedUser(req);
    const { phone, address, city, zip, items } = req.body ?? {};

    if (!verifiedUser.email || !Array.isArray(items) || items.length === 0)
      return res.status(400).json({ error: 'Missing required checkout fields' });

    const normalizedItems = items.map((item: any) => ({
      productId: String(item?.productId || ''),
      quantity: Number(item?.quantity || 0),
    }));
    if (normalizedItems.some((i: any) => !i.productId || i.quantity <= 0))
      return res.status(400).json({ error: 'Invalid checkout items' });

    await expireStalePendingOrders();
    const profile = await ensureProfileByIdentity({
      firebaseUid: verifiedUser.uid,
      email: verifiedUser.email,
      displayName: verifiedUser.name,
    });

    const shippingQuote = await getShippingQuote({
      city: city ? String(city) : null,
      zip: zip ? String(zip) : null,
    });

    const supabase = getSupabaseAdmin();
    const { data: checkoutData, error: checkoutError } = await supabase.rpc('create_store_checkout_order', {
      p_profile_id: profile.id,
      p_customer_email: verifiedUser.email,
      p_customer_name: profile.display_name || verifiedUser.name || verifiedUser.email,
      p_customer_phone: phone ? String(phone) : null,
      p_shipping_address: address ? String(address) : null,
      p_shipping_city: city ? String(city) : null,
      p_shipping_zip: zip ? String(zip) : null,
      p_shipping_cost: shippingQuote.price,
      p_items: normalizedItems,
    });
    if (checkoutError) return res.status(400).json({ error: checkoutError.message });

    const checkoutRow = Array.isArray(checkoutData) ? checkoutData[0] : checkoutData;
    if (!checkoutRow?.order_id || !checkoutRow?.total)
      return res.status(500).json({ error: 'Checkout order was not created correctly' });
    createdOrderId = checkoutRow.order_id;

    const yocoSecretKey = normalizeEnvValue(process.env.YOCO_SECRET_KEY);
    if (!yocoSecretKey) return res.status(500).json({ error: 'Payment system not configured' });

    const origin = req.headers.origin || `https://${req.headers.host}`;
    const amountCents = Math.round(Number(checkoutRow.total) * 100);

    const yocoResponse = await axios.post('https://payments.yoco.com/api/checkouts', {
      amount: amountCents,
      currency: 'ZAR',
      successUrl: `${origin}/payment/success?orderId=${checkoutRow.order_id}`,
      cancelUrl: `${origin}/payment/cancel?orderId=${checkoutRow.order_id}`,
      metadata: { orderId: checkoutRow.order_id, orderNumber: checkoutRow.order_number, itemName: checkoutRow.item_name },
    }, {
      headers: { Authorization: `Bearer ${yocoSecretKey}`, 'Content-Type': 'application/json' },
      timeout: 10000,
    });

    const checkoutSessionId = yocoResponse.data?.id || null;
    if (!checkoutSessionId || !yocoResponse.data?.redirectUrl) {
      await supabase.rpc('cancel_pending_order', { p_order_id: checkoutRow.order_id, p_note: 'checkout_session_creation_failed' });
      return res.status(502).json({ error: 'Payment provider did not return a valid checkout session' });
    }

    const { error: updateError } = await supabase
      .from('orders')
      .update({ checkout_session_id: checkoutSessionId, payment_status: 'redirected' })
      .eq('id', checkoutRow.order_id);
    if (updateError) {
      await supabase.rpc('cancel_pending_order', { p_order_id: checkoutRow.order_id, p_note: 'checkout_order_update_failed' });
      return res.status(500).json({ error: updateError.message });
    }

    return res.status(200).json({
      orderId: checkoutRow.order_id,
      orderNumber: checkoutRow.order_number,
      total: checkoutRow.total,
      shippingQuote,
      redirectUrl: yocoResponse.data?.redirectUrl,
      reservationExpiresAt: checkoutRow.reservation_expires_at,
    });
  } catch (error: any) {
    if (error?.statusCode === 401) return sendAuthError(res, error);
    const message = error?.response?.data?.message || error?.response?.data?.error || error?.message || 'Failed to start checkout';
    if (createdOrderId) {
      try {
        const supabase = getSupabaseAdmin();
        await supabase.rpc('cancel_pending_order', { p_order_id: String(createdOrderId), p_note: 'checkout_redirect_failed' });
      } catch (_) {}
    }
    return res.status(500).json({ error: message });
  }
}

// ─── wallet-checkout ───────────────────────────────────────────────────────
async function handleWalletCheckout(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const verifiedUser = await requireVerifiedUser(req);

    const { address, city, zip, items } = req.body ?? {};
    if (!Array.isArray(items) || items.length === 0)
      return res.status(400).json({ error: 'No items provided' });

    const normalizedItems = items.map((item: any) => ({
      listingId: item.listingId ? String(item.listingId) : undefined,
      productId: String(item.productId || ''),
      quantity: Number(item.quantity || 0),
    }));
    if (normalizedItems.some((i: any) => !i.productId || i.quantity <= 0))
      return res.status(400).json({ error: 'Invalid items' });

    const profile = await ensureProfileByIdentity({
      firebaseUid: verifiedUser.uid,
      email: verifiedUser.email!,
      displayName: verifiedUser.name,
    });

    const shippingQuote = await getShippingQuote({
      city: city ? String(city) : null,
      zip: zip ? String(zip) : null,
    });

    const supabase = getSupabaseAdmin();
    const itemsPayload = normalizedItems.map((i: any) => ({
      listingId: i.listingId || null,
      productId: i.productId,
      quantity: i.quantity,
    }));

    const { data, error } = await supabase.rpc('wallet_purchase', {
      p_profile_id: profile.id,
      p_customer_email: verifiedUser.email,
      p_customer_name: profile.display_name || verifiedUser.name || verifiedUser.email,
      p_shipping_address: address ? String(address) : null,
      p_shipping_city: city ? String(city) : null,
      p_shipping_zip: zip ? String(zip) : null,
      p_shipping_cost: shippingQuote.price,
      p_items: itemsPayload,
    });

    if (error) {
      const msg = error.message || '';
      if (msg.includes('Insufficient wallet balance')) return res.status(402).json({ error: msg, code: 'INSUFFICIENT_BALANCE' });
      if (msg.includes('not available') || msg.includes('Insufficient stock')) return res.status(409).json({ error: msg, code: 'STOCK_UNAVAILABLE' });
      return res.status(400).json({ error: msg });
    }

    const result = Array.isArray(data) ? data[0] : data;
    return res.status(200).json({ orderId: result.order_id, orderNumber: result.order_number, total: result.total });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Wallet checkout failed' });
  }
}

// ─── wallet-topup ──────────────────────────────────────────────────────────
async function handleWalletTopup(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const verifiedUser = await requireVerifiedUser(req);

    const { amount } = req.body ?? {};
    const topupAmount = Number(amount);
    if (!topupAmount || topupAmount < 10 || topupAmount > 50000)
      return res.status(400).json({ error: 'Amount must be between R10 and R50,000' });

    const yocoSecretKey = normalizeEnvValue(process.env.YOCO_SECRET_KEY);
    if (!yocoSecretKey) return res.status(503).json({ error: 'Payment system not configured' });

    const profile = await ensureProfileByIdentity({
      firebaseUid: verifiedUser.uid,
      email: verifiedUser.email!,
      displayName: verifiedUser.name,
    });

    const supabase = getSupabaseAdmin();
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        profile_id: profile.id,
        customer_email: verifiedUser.email,
        customer_name: profile.display_name || verifiedUser.email,
        channel: 'store',
        source_ref: 'wallet_topup',
        subtotal: topupAmount,
        discount: 0,
        shipping_cost: 0,
        payment_method: 'yoco',
        payment_status: 'initiated',
        status: 'pending',
        reservation_expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      })
      .select('id')
      .single();
    if (orderError) throw new Error(orderError.message);

    const origin = req.headers.origin || `https://${req.headers.host}`;
    const amountCents = Math.round(topupAmount * 100);

    const yocoResponse = await axios.post('https://payments.yoco.com/api/checkouts', {
      amount: amountCents,
      currency: 'ZAR',
      successUrl: `${origin}/payment-result?orderId=${order.id}`,
      cancelUrl: `${origin}/payment-result?orderId=${order.id}&cancelled=true`,
      metadata: { orderId: order.id, type: 'wallet_topup' },
    }, {
      headers: { Authorization: `Bearer ${yocoSecretKey}`, 'Content-Type': 'application/json' },
    });

    return res.status(200).json({ redirectUrl: yocoResponse.data.redirectUrl, orderId: order.id });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to initiate top-up' });
  }
}

// ─── cancel-order ──────────────────────────────────────────────────────────
async function handleCancelOrder(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const verifiedUser = await requireVerifiedUser(req);
    const { orderId, reason, action } = req.body ?? {};
    if (!orderId) return res.status(400).json({ error: 'Missing orderId' });

    await expireStalePendingOrders();
    const supabase = getSupabaseAdmin();

    if (action === 'resume') {
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('id, order_number, status, total, source_ref, channel, profile_id')
        .eq('id', String(orderId))
        .single();
      if (orderError || !order) return res.status(404).json({ error: 'Order not found' });
      if (order.channel !== 'store' || order.source_ref === 'wallet_topup')
        return res.status(400).json({ error: 'Only active store checkouts can be resumed' });
      if (!verifiedUser.isAdmin && order.profile_id !== verifiedUser.profileId)
        return res.status(403).json({ error: 'Order access denied' });
      if (order.status !== 'pending') return res.status(400).json({ error: 'Only pending orders can be resumed' });

      const { data: orderItems } = await supabase
        .from('order_items').select('product_name').eq('order_id', String(orderId)).limit(1);

      const yocoSecretKey = normalizeEnvValue(process.env.YOCO_SECRET_KEY);
      if (!yocoSecretKey) return res.status(500).json({ error: 'Payment system not configured' });

      const origin = req.headers.origin || `https://${req.headers.host}`;
      const amountCents = Math.round(Number(order.total) * 100);
      const itemName = orderItems?.[0]?.product_name || `Quirkify Order ${order.order_number}`;

      const yocoResponse = await axios.post('https://payments.yoco.com/api/checkouts', {
        amount: amountCents, currency: 'ZAR',
        successUrl: `${origin}/payment/success?orderId=${order.id}`,
        cancelUrl: `${origin}/payment/cancel?orderId=${order.id}`,
        metadata: { orderId: order.id, orderNumber: order.order_number, itemName },
      }, {
        headers: { Authorization: `Bearer ${yocoSecretKey}`, 'Content-Type': 'application/json' },
        timeout: 10000,
      });

      const checkoutSessionId = yocoResponse.data?.id || null;
      if (!checkoutSessionId || !yocoResponse.data?.redirectUrl)
        return res.status(502).json({ error: 'Payment provider did not return a valid checkout session' });

      await supabase.from('orders').update({ checkout_session_id: checkoutSessionId, payment_status: 'redirected' }).eq('id', order.id);
      await supabase.rpc('log_order_event', {
        p_order_id: order.id, p_event_type: 'checkout_resumed',
        p_from_status: order.status, p_to_status: order.status,
        p_note: 'customer_resumed_checkout', p_metadata: { checkout_session_id: checkoutSessionId },
      });
      return res.status(200).json({ orderId: order.id, redirectUrl: yocoResponse.data.redirectUrl });
    }

    const { data: currentOrder, error: currentOrderError } = await supabase
      .from('orders').select('id, profile_id').eq('id', String(orderId)).single();
    if (currentOrderError || !currentOrder) return res.status(404).json({ error: 'Order not found' });
    if (!verifiedUser.isAdmin && currentOrder.profile_id !== verifiedUser.profileId)
      return res.status(403).json({ error: 'Order access denied' });

    const { data, error } = await supabase.rpc('cancel_pending_order', {
      p_order_id: String(orderId),
      p_note: reason ? String(reason) : 'customer_cancelled_from_orders',
    });
    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json({ order: Array.isArray(data) ? data[0] : data });
  } catch (error: any) {
    if (error?.statusCode === 401) return sendAuthError(res, error);
    return res.status(500).json({ error: error?.message || 'Failed to cancel order' });
  }
}

// ─── order-status ──────────────────────────────────────────────────────────
async function handleOrderStatus(req: any, res: any) {
  if (req.method === 'GET') {
    try {
      const verifiedUser = await requireVerifiedUser(req);
      const orderId = String(req.query?.orderId || '').trim();
      const includeEvents = req.query?.includeEvents === '1';

      await expireStalePendingOrders();
      const supabase = getSupabaseAdmin();

      if (!orderId) {
        const profileId = typeof req.query?.profileId === 'string' ? req.query.profileId.trim() : '';
        const status = typeof req.query?.status === 'string' ? req.query.status.trim() : '';
        const channel = typeof req.query?.channel === 'string' ? req.query.channel.trim() : '';
        const excludeSourceRef = typeof req.query?.excludeSourceRef === 'string' ? req.query.excludeSourceRef.trim() : '';
        const limitRaw = typeof req.query?.limit === 'string' ? Number(req.query.limit) : null;
        const limit = Number.isFinite(limitRaw) && limitRaw && limitRaw! > 0 ? Math.min(limitRaw!, 200) : null;

        let query = supabase.from('orders').select('*').order('created_at', { ascending: false });
        if (verifiedUser.isAdmin) {
          if (profileId) query = query.eq('profile_id', profileId);
        } else if (verifiedUser.profileId) {
          query = query.eq('profile_id', verifiedUser.profileId);
        } else {
          return res.status(200).json({ orders: [], itemsByOrder: {} });
        }
        if (status) query = query.eq('status', status);
        if (channel) query = query.eq('channel', channel);
        if (excludeSourceRef) query = query.or(`source_ref.is.null,source_ref.neq.${excludeSourceRef}`);
        if (limit) query = query.limit(limit);

        const { data: orders, error: ordersError } = await query;
        if (ordersError) return res.status(400).json({ error: ordersError.message });

        const orderIds = (orders || []).map((o: any) => o.id);
        if (orderIds.length === 0) return res.status(200).json({ orders: [], itemsByOrder: {} });

        const { data: allItems } = await supabase.from('order_items').select('*').in('order_id', orderIds);
        const itemsByOrder = (allItems || []).reduce((acc: Record<string, any[]>, item: any) => {
          (acc[item.order_id] = acc[item.order_id] || []).push(item);
          return acc;
        }, {});
        return res.status(200).json({ orders: orders || [], itemsByOrder });
      }

      const { data, error } = await supabase.from('orders').select('*').eq('id', orderId).maybeSingle();
      if (error) return res.status(400).json({ error: error.message });
      if (!data) return res.status(404).json({ error: 'Order not found' });
      if (!verifiedUser.isAdmin && data.profile_id !== verifiedUser.profileId)
        return res.status(403).json({ error: 'Order access denied' });

      if (!includeEvents) return res.status(200).json({ order: data });

      const [{ data: items }, { data: events }] = await Promise.all([
        supabase.from('order_items').select('*').eq('order_id', orderId).order('created_at', { ascending: true }),
        supabase.from('order_events').select('*').eq('order_id', orderId).order('created_at', { ascending: false }),
      ]);
      return res.status(200).json({ order: data, items: items || [], events: events || [] });
    } catch (error: any) {
      if (error?.statusCode === 401) return sendAuthError(res, error);
      return res.status(500).json({ error: error?.message || 'Failed to load order status' });
    }
  }

  if (req.method === 'PATCH') {
    try {
      const verifiedUser = await requireVerifiedUser(req);
      if (!verifiedUser.isAdmin) return res.status(403).json({ error: 'Admin access required' });

      const orderId = String(req.body?.orderId || '').trim();
      const nextStatus = String(req.body?.status || '').trim();
      const nextPaymentStatus = typeof req.body?.paymentStatus === 'string' ? req.body.paymentStatus.trim() : '';
      const nextShippingStatus = typeof req.body?.shippingStatus === 'string' ? req.body.shippingStatus.trim() : '';
      const trackingNumber = typeof req.body?.trackingNumber === 'string' ? req.body.trackingNumber.trim() : '';
      const carrier = typeof req.body?.carrier === 'string' ? req.body.carrier.trim() : '';
      const adminNotes = typeof req.body?.adminNotes === 'string' ? req.body.adminNotes.trim() : '';
      if (!orderId) return res.status(400).json({ error: 'Missing orderId' });

      await expireStalePendingOrders();
      const supabase = getSupabaseAdmin();
      const { data: currentOrder, error: orderError } = await supabase.from('orders').select('*').eq('id', orderId).single();
      if (orderError || !currentOrder) return res.status(404).json({ error: 'Order not found' });

      const updates: Record<string, unknown> = {};
      const previousStatus = currentOrder.status;

      if (trackingNumber) updates.tracking_number = trackingNumber;
      if (carrier) updates.carrier = carrier;
      if (adminNotes) updates.admin_notes = adminNotes;
      if (nextPaymentStatus) updates.payment_status = nextPaymentStatus;
      if (nextShippingStatus) {
        updates.shipping_status = nextShippingStatus;
        if (nextShippingStatus === 'shipped' && !currentOrder.shipped_at) updates.shipped_at = new Date().toISOString();
        if (nextShippingStatus === 'delivered' && !currentOrder.delivered_at) updates.delivered_at = new Date().toISOString();
      }

      if (nextStatus && nextStatus !== previousStatus) {
        updates.status = nextStatus;
        if (nextStatus === 'shipped') updates.shipped_at = new Date().toISOString();
        if (nextStatus === 'delivered' || nextStatus === 'completed') updates.delivered_at = new Date().toISOString();
        if (nextStatus === 'cancelled') updates.cancelled_at = new Date().toISOString();
      }

      if (Object.keys(updates).length === 0) return res.status(200).json({ order: currentOrder });

      const { data: updatedOrder, error: updateError } = await supabase
        .from('orders').update(updates).eq('id', orderId).select('*').single();
      if (updateError) return res.status(400).json({ error: updateError.message });

      if (nextStatus && nextStatus !== previousStatus) {
        await supabase.rpc('log_order_event', {
          p_order_id: orderId, p_event_type: 'admin_status_updated',
          p_from_status: previousStatus, p_to_status: nextStatus,
          p_note: adminNotes || `Admin moved order to ${nextStatus}`,
          p_metadata: { tracking_number: trackingNumber || null, carrier: carrier || null },
        });
        if (nextStatus === 'shipped' || nextStatus === 'delivered') {
          void import('../_lib/orderNotifications.js')
            .then(({ sendOrderStatusEmail }) => sendOrderStatusEmail(orderId, nextStatus as 'shipped' | 'delivered'))
            .catch(() => {});
        }
      }

      const [{ data: items }, { data: events }] = await Promise.all([
        supabase.from('order_items').select('*').eq('order_id', orderId).order('created_at', { ascending: true }),
        supabase.from('order_events').select('*').eq('order_id', orderId).order('created_at', { ascending: false }),
      ]);
      return res.status(200).json({ order: updatedOrder, items: items || [], events: events || [] });
    } catch (error: any) {
      if (error?.statusCode === 401) return sendAuthError(res, error);
      return res.status(500).json({ error: error?.message || 'Failed to update order' });
    }
  }

  res.setHeader('Allow', 'GET, PATCH');
  return res.status(405).json({ error: 'Method not allowed' });
}

// ─── auction-close ─────────────────────────────────────────────────────────
async function handleAuctionClose(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const auctionId = String(req.body?.auctionId || '').trim();
    if (!auctionId) return res.status(400).json({ error: 'Missing auctionId' });

    const adminDb = getAdminDb();
    const auctionRef = adminDb.collection('auctions').doc(auctionId);
    const auctionSnapshot = await auctionRef.get();
    if (!auctionSnapshot.exists) return res.status(404).json({ error: 'Auction not found' });

    const auction = { id: auctionSnapshot.id, ...auctionSnapshot.data() } as Record<string, any>;
    if (auction.status === 'closed') {
      return res.status(200).json({ auctionId, orderId: auction.winnerOrderId || null, settled: Boolean(auction.winnerOrderId), status: 'closed' });
    }

    if (!auction.highestBidderId) {
      await auctionRef.update({ status: 'closed', winnerOrderId: null, updatedAt: new Date().toISOString() });
      return res.status(200).json({ auctionId, orderId: null, settled: false, status: 'closed', reason: 'no_valid_bids' });
    }

    const supabase = getSupabaseAdmin();
    const { data: existingOrder } = await supabase
      .from('orders').select('id, status, payment_status')
      .eq('channel', 'auction').eq('source_ref', auctionId).maybeSingle();

    if (existingOrder?.id) {
      await auctionRef.update({ status: 'closed', winnerOrderId: existingOrder.id, updatedAt: new Date().toISOString() });
      return res.status(200).json({ auctionId, orderId: existingOrder.id, settled: existingOrder.status === 'paid', status: 'closed' });
    }

    const { data: product, error: productError } = await supabase
      .from('products').select('id, name, image_url, stock, alloc_auction, status')
      .eq('id', String(auction.productId || '')).maybeSingle();
    if (productError) throw new Error(productError.message);
    if (!product) return res.status(409).json({ error: 'Auction product is missing from catalog truth' });
    if (product.status !== 'approved') return res.status(409).json({ error: 'Auction product is not approved for settlement' });
    if (Number(product.alloc_auction || 0) < 1 || Number(product.stock || 0) < 1)
      return res.status(409).json({ error: 'Auction inventory is not available to settle this lot' });

    const bidderUser = await getAuth().getUser(String(auction.highestBidderId));
    if (!bidderUser.email) return res.status(409).json({ error: 'Winning bidder does not have a usable identity record' });

    const profile = await ensureProfileByIdentity({
      firebaseUid: bidderUser.uid,
      email: bidderUser.email,
      displayName: bidderUser.displayName || bidderUser.email,
    });

    const normalizeAmount = (v: unknown, fb = 0) => { const n = Number(v); return Number.isFinite(n) ? n : fb; };
    const settlementAmount = normalizeAmount(auction.currentBid, normalizeAmount(auction.startPrice, 0));
    if (settlementAmount <= 0) return res.status(409).json({ error: 'Auction total is invalid' });

    const walletBalance = normalizeAmount(profile.balance, 0);
    const walletCovered = walletBalance >= settlementAmount;

    const { data: insertedOrder, error: insertOrderError } = await supabase
      .from('orders').insert({
        profile_id: profile.id,
        customer_email: bidderUser.email,
        customer_name: bidderUser.displayName || bidderUser.email,
        channel: 'auction',
        source_ref: auctionId,
        subtotal: settlementAmount,
        discount: 0,
        shipping_cost: 0,
        payment_method: null,
        payment_status: walletCovered ? 'paid' : 'pending',
        paid_at: walletCovered ? new Date().toISOString() : null,
        status: walletCovered ? 'paid' : 'pending',
        admin_notes: walletCovered ? 'Auction settled against wallet balance' : 'Auction closed without sufficient wallet balance',
      }).select('*').single();
    if (insertOrderError) throw new Error(insertOrderError.message);

    const { error: insertItemError } = await supabase.from('order_items').insert({
      order_id: insertedOrder.id,
      product_id: product.id,
      product_name: auction.title || product.name,
      product_image_url: auction.heroImage || product.image_url,
      unit_price: settlementAmount,
      quantity: 1,
    });
    if (insertItemError) throw new Error(insertItemError.message);

    if (walletCovered) {
      const { data: updatedProduct, error: stockError } = await supabase
        .from('products')
        .update({ stock: Number(product.stock || 0) - 1, alloc_auction: Number(product.alloc_auction || 0) - 1 })
        .eq('id', product.id).eq('stock', product.stock).eq('alloc_auction', product.alloc_auction)
        .select('id').maybeSingle();
      if (stockError) throw new Error(stockError.message);
      if (!updatedProduct) throw new Error('Auction inventory changed during settlement');

      await supabase.from('profiles').update({
        balance: walletBalance - settlementAmount,
        auctions_won: Number(profile.auctions_won || 0) + 1,
      }).eq('id', profile.id);

      const { error: walletError } = await supabase.rpc('wallet_debit', {
        p_profile_id: profile.id,
        p_amount: settlementAmount,
        p_entry_type: 'order_payment',
        p_reference_type: 'auction',
        p_reference_id: insertedOrder.id,
        p_metadata: { auctionId, productId: product.id, orderId: insertedOrder.id },
      });
      if (walletError) console.warn('Wallet debit failed for auction settlement:', walletError.message);
    }

    void Promise.allSettled([
      supabase.from('notifications').insert({
        firebase_uid: bidderUser.uid,
        type: 'auction_won',
        title: '🏆 You won the auction!',
        message: walletCovered
          ? `You won "${auction.title || product.name}" for R${settlementAmount}. Check your collection!`
          : `You won "${auction.title || product.name}" for R${settlementAmount}. Top up your wallet to complete payment.`,
        link: '/orders',
        read: false,
      }),
      walletCovered && supabase.from('collection_items').insert({
        profile_id: profile.id,
        product_id: product.id,
        purchase_price: settlementAmount,
        order_id: insertedOrder.id,
        acquired_at: new Date().toISOString(),
      }),
    ]);

    await supabase.rpc('log_order_event', {
      p_order_id: insertedOrder.id,
      p_event_type: walletCovered ? 'auction_settled' : 'auction_payment_required',
      p_from_status: null,
      p_to_status: insertedOrder.status,
      p_note: walletCovered ? 'Auction closed and captured against wallet balance' : 'Auction closed; winner requires wallet top-up',
      p_metadata: { auctionId, productId: product.id, highestBidderId: bidderUser.uid, settlementAmount, walletCovered },
    });

    await auctionRef.update({
      status: 'closed',
      winnerOrderId: insertedOrder.id,
      updatedAt: new Date().toISOString(),
      settledAt: new Date().toISOString(),
      settlementStatus: walletCovered ? 'captured' : 'awaiting_payment',
      settlementAmount,
      metrics: { closedAt: FieldValue.serverTimestamp() },
    });

    return res.status(200).json({
      auctionId, orderId: insertedOrder.id, settled: walletCovered,
      status: 'closed', paymentStatus: insertedOrder.payment_status,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Failed to close auction' });
  }
}

// ─── Router ────────────────────────────────────────────────────────────────
export default async function handler(req: any, res: any) {
  const action = String(req.query.action || '');

  switch (action) {
    case 'store-checkout':  return handleStoreCheckout(req, res);
    case 'wallet-checkout': return handleWalletCheckout(req, res);
    case 'wallet-topup':    return handleWalletTopup(req, res);
    case 'cancel-order':    return handleCancelOrder(req, res);
    case 'order-status':    return handleOrderStatus(req, res);
    case 'auction-close':   return handleAuctionClose(req, res);
    default:
      return res.status(404).json({ error: `Unknown commerce action: ${action}` });
  }
}
