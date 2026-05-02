import { requireVerifiedUser, sendAuthError } from '../_lib/auth.js';
import { ensureProfileByIdentity, getSupabaseAdmin } from '../_lib/supabaseAdmin.js';
import { getShippingQuote } from '../_lib/shipping.js';

interface CheckoutItem {
  listingId?: string;
  productId: string;
  quantity: number;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const verifiedUser = await requireVerifiedUser(req);
    if (!verifiedUser) return sendAuthError(res);

    const { address, city, zip, items } = req.body ?? {};

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No items provided' });
    }

    const normalizedItems: CheckoutItem[] = items.map((item: any) => ({
      listingId: item.listingId ? String(item.listingId) : undefined,
      productId: String(item.productId || ''),
      quantity: Number(item.quantity || 0),
    }));

    if (normalizedItems.some(i => !i.productId || i.quantity <= 0)) {
      return res.status(400).json({ error: 'Invalid items' });
    }

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

    const itemsPayload = normalizedItems.map(i => ({
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
      if (msg.includes('Insufficient wallet balance')) {
        return res.status(402).json({ error: msg, code: 'INSUFFICIENT_BALANCE' });
      }
      if (msg.includes('not available') || msg.includes('Insufficient stock')) {
        return res.status(409).json({ error: msg, code: 'STOCK_UNAVAILABLE' });
      }
      return res.status(400).json({ error: msg });
    }

    const result = Array.isArray(data) ? data[0] : data;
    return res.status(200).json({
      orderId: result.order_id,
      orderNumber: result.order_number,
      total: result.total,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Wallet checkout failed' });
  }
}
