import { getAuth } from 'firebase-admin/auth';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '../_lib/firebaseAdmin.js';
import { ensureProfileByIdentity, getSupabaseAdmin } from '../_lib/supabaseAdmin.js';

function normalizeAmount(value: unknown, fallback = 0) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : fallback;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const auctionId = String(req.body?.auctionId || '').trim();
    if (!auctionId) {
      return res.status(400).json({ error: 'Missing auctionId' });
    }

    const adminDb = getAdminDb();
    const auctionRef = adminDb.collection('auctions').doc(auctionId);
    const auctionSnapshot = await auctionRef.get();
    if (!auctionSnapshot.exists) {
      return res.status(404).json({ error: 'Auction not found' });
    }

    const auction = { id: auctionSnapshot.id, ...auctionSnapshot.data() } as Record<string, any>;
    if (auction.status === 'closed') {
      return res.status(200).json({
        auctionId,
        orderId: auction.winnerOrderId || null,
        settled: Boolean(auction.winnerOrderId),
        status: 'closed',
      });
    }

    if (!auction.highestBidderId) {
      await auctionRef.update({
        status: 'closed',
        winnerOrderId: null,
        updatedAt: new Date().toISOString(),
      });
      return res.status(200).json({
        auctionId,
        orderId: null,
        settled: false,
        status: 'closed',
        reason: 'no_valid_bids',
      });
    }

    const supabase = getSupabaseAdmin();
    const { data: existingOrder, error: existingOrderError } = await supabase
      .from('orders')
      .select('id, status, payment_status')
      .eq('channel', 'auction')
      .eq('source_ref', auctionId)
      .maybeSingle();

    if (existingOrderError) {
      throw new Error(existingOrderError.message);
    }

    if (existingOrder?.id) {
      await auctionRef.update({
        status: 'closed',
        winnerOrderId: existingOrder.id,
        updatedAt: new Date().toISOString(),
      });
      return res.status(200).json({
        auctionId,
        orderId: existingOrder.id,
        settled: existingOrder.status === 'paid',
        status: 'closed',
      });
    }

    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, name, image_url, stock, alloc_auction, status')
      .eq('id', String(auction.productId || ''))
      .maybeSingle();

    if (productError) {
      throw new Error(productError.message);
    }

    if (!product) {
      return res.status(409).json({ error: 'Auction product is missing from catalog truth' });
    }

    if (product.status !== 'approved') {
      return res.status(409).json({ error: 'Auction product is not approved for settlement' });
    }

    if (Number(product.alloc_auction || 0) < 1 || Number(product.stock || 0) < 1) {
      return res.status(409).json({ error: 'Auction inventory is not available to settle this lot' });
    }

    const bidderUser = await getAuth().getUser(String(auction.highestBidderId));
    if (!bidderUser.email) {
      return res.status(409).json({ error: 'Winning bidder does not have a usable identity record' });
    }

    const profile = await ensureProfileByIdentity({
      firebaseUid: bidderUser.uid,
      email: bidderUser.email,
      displayName: bidderUser.displayName || bidderUser.email,
    });

    const settlementAmount = normalizeAmount(auction.currentBid, normalizeAmount(auction.startPrice, 0));
    if (settlementAmount <= 0) {
      return res.status(409).json({ error: 'Auction total is invalid' });
    }

    const walletBalance = normalizeAmount(profile.balance, 0);
    const walletCovered = walletBalance >= settlementAmount;

    const { data: insertedOrder, error: insertOrderError } = await supabase
      .from('orders')
      .insert({
        profile_id: profile.id,
        customer_email: bidderUser.email,
        customer_name: bidderUser.displayName || bidderUser.email,
        customer_phone: bidderUser.phoneNumber || null,
        channel: 'auction',
        source_ref: auctionId,
        subtotal: settlementAmount,
        discount: 0,
        shipping_cost: 0,
        payment_method: null,
        payment_status: walletCovered ? 'paid' : 'pending',
        paid_at: walletCovered ? new Date().toISOString() : null,
        status: walletCovered ? 'paid' : 'pending',
        admin_notes: walletCovered
          ? 'Auction settled against available wallet balance'
          : 'Auction closed without sufficient wallet balance; awaiting follow-up',
      })
      .select('*')
      .single();

    if (insertOrderError) {
      throw new Error(insertOrderError.message);
    }

    const { error: insertItemError } = await supabase
      .from('order_items')
      .insert({
        order_id: insertedOrder.id,
        product_id: product.id,
        product_name: auction.title || product.name,
        product_image_url: auction.heroImage || product.image_url,
        unit_price: settlementAmount,
        quantity: 1,
      });

    if (insertItemError) {
      throw new Error(insertItemError.message);
    }

    if (walletCovered) {
      const { data: updatedProduct, error: stockError } = await supabase
        .from('products')
        .update({
          stock: Number(product.stock || 0) - 1,
          alloc_auction: Number(product.alloc_auction || 0) - 1,
        })
      .eq('id', product.id)
      .eq('stock', product.stock)
      .eq('alloc_auction', product.alloc_auction)
      .select('id')
      .maybeSingle();

      if (stockError) {
        throw new Error(stockError.message);
      }
      if (!updatedProduct) {
        throw new Error('Auction inventory changed during settlement');
      }

      const { error: balanceError } = await supabase
        .from('profiles')
        .update({
          balance: walletBalance - settlementAmount,
          auctions_won: Number(profile.auctions_won || 0) + 1,
        })
        .eq('id', profile.id);

      if (balanceError) {
        throw new Error(balanceError.message);
      }

      const walletAccountId = await supabase.rpc('ensure_wallet_account', { p_profile_id: profile.id });
      if (walletAccountId.error) {
        throw new Error(walletAccountId.error.message);
      }

      if (walletAccountId.data) {
        const { error: walletAccountError } = await supabase
          .from('wallet_accounts')
          .update({
            available_balance: Math.max(walletBalance - settlementAmount, 0),
            updated_at: new Date().toISOString(),
          })
          .eq('id', walletAccountId.data);

        if (walletAccountError) {
          throw new Error(walletAccountError.message);
        }

        const { error: walletLedgerError } = await supabase.rpc('wallet_record_entry', {
          p_wallet_account_id: walletAccountId.data,
          p_direction: 'debit',
          p_entry_type: 'order_payment',
          p_amount: settlementAmount,
          p_reference_type: 'auction',
          p_reference_id: insertedOrder.id,
          p_metadata: {
            auctionId,
            productId: product.id,
            orderId: insertedOrder.id,
          },
        });

        if (walletLedgerError) {
          throw new Error(walletLedgerError.message);
        }
      }
    }

    // Award XP + send notification to winner (fire-and-forget — don't block settlement)
    const xpAmount = 100;
    const xpBonus = Math.min(Math.floor(settlementAmount / 100) * 10, 200);
    const totalXP = xpAmount + xpBonus;
    void Promise.allSettled([
      supabase.rpc('increment_profile_xp', {
        p_firebase_uid: bidderUser.uid,
        p_amount: totalXP,
      }).then(({ error }) => {
        // Fallback: direct update if RPC not present
        if (error) {
          return supabase
            .from('profiles')
            .select('xp')
            .eq('firebase_uid', bidderUser.uid)
            .single()
            .then(({ data }) => {
              const newXP = (Number(data?.xp) || 0) + totalXP;
              return supabase
                .from('profiles')
                .update({ xp: newXP, level: Math.floor(Math.sqrt(newXP / 100)) + 1, last_active_at: new Date().toISOString() })
                .eq('firebase_uid', bidderUser.uid);
            });
        }
      }),
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
    ]);

    // Add to collection when payment is confirmed via wallet
    if (walletCovered) {
      void supabase.from('collection_items').insert({
        profile_id: profile.id,
        product_id: product.id,
        purchase_price: settlementAmount,
        order_id: insertedOrder.id,
        acquired_at: new Date().toISOString(),
      });
    }

    const orderEventPayload = {
      auctionId,
      productId: product.id,
      highestBidderId: bidderUser.uid,
      settlementAmount,
      walletCovered,
    };

    const { error: orderEventError } = await supabase.rpc('log_order_event', {
      p_order_id: insertedOrder.id,
      p_event_type: walletCovered ? 'auction_settled' : 'auction_payment_required',
      p_from_status: null,
      p_to_status: insertedOrder.status,
      p_note: walletCovered
        ? 'Auction closed and captured against wallet balance'
        : 'Auction closed; winner requires wallet top-up or manual payment follow-up',
      p_metadata: orderEventPayload,
    });

    if (orderEventError) {
      throw new Error(orderEventError.message);
    }

    await auctionRef.update({
      status: 'closed',
      winnerOrderId: insertedOrder.id,
      updatedAt: new Date().toISOString(),
      settledAt: new Date().toISOString(),
      settlementStatus: walletCovered ? 'captured' : 'awaiting_payment',
      settlementAmount,
      settlementOrderId: insertedOrder.id,
      metrics: {
        closedAt: FieldValue.serverTimestamp(),
      },
    });

    return res.status(200).json({
      auctionId,
      orderId: insertedOrder.id,
      settled: walletCovered,
      status: 'closed',
      paymentStatus: insertedOrder.payment_status,
    });
  } catch (error: any) {
    const message = error?.message || 'Failed to close auction';
    console.error('Auction close error:', message);
    return res.status(500).json({ error: message });
  }
}
