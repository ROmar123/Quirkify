import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  CheckCircle2, XCircle, ArrowRight, ShoppingBag,
  Sparkles, Clock3, AlertCircle, Package
} from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { cancelStoreCheckout, getStoreCheckoutStatus } from '../../services/paymentService';

type ResolutionState = 'pending' | 'paid' | 'payment_failed' | 'cancelled' | 'error';

export default function PaymentResult({ type }: { type: 'success' | 'cancel' }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { clearCart } = useCart();
  const [resolution, setResolution] = useState<ResolutionState>('pending');
  const [message, setMessage] = useState('Confirming your payment…');
  const [isWalletTopUp, setIsWalletTopUp] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const process = async () => {
      const orderId = searchParams.get('orderId');

      if (!orderId) {
        if (!cancelled) {
          setResolution(type === 'cancel' ? 'cancelled' : 'error');
          setMessage('We could not find the order linked to this payment.');
        }
        return;
      }

      if (type === 'cancel') {
        try {
          const cancelledOrder = await cancelStoreCheckout(orderId, 'customer_cancelled_on_checkout');
          if (!cancelled) {
            const wallet = cancelledOrder?.source_ref === 'wallet_topup';
            setIsWalletTopUp(wallet);
            setResolution(cancelledOrder?.status === 'paid' ? 'paid' : 'cancelled');
            setMessage(
              cancelledOrder?.status === 'paid'
                ? wallet
                  ? 'Wallet top-up was already confirmed before cancel.'
                  : 'Payment was already confirmed before cancel.'
                : wallet
                  ? 'Wallet top-up was cancelled.'
                  : 'Your checkout was cancelled.'
            );
            if (cancelledOrder?.status === 'paid' && !wallet) clearCart();
          }
        } catch {
          if (!cancelled) {
            setResolution('error');
            setMessage('Could not cancel this checkout. Please check your orders.');
          }
        }
        return;
      }

      const startedAt = Date.now();
      while (!cancelled && Date.now() - startedAt < 90000) {
        try {
          const order = await getStoreCheckoutStatus(orderId);
          const wallet = order.source_ref === 'wallet_topup';
          if (!cancelled) setIsWalletTopUp(wallet);

          if (order.status === 'paid' || order.payment_status === 'completed') {
            if (!wallet && !cancelled) clearCart();
            if (!cancelled) {
              setResolution('paid');
              setMessage(wallet ? 'Your wallet has been topped up.' : 'Your order is confirmed.');
            }
            return;
          }

          if (order.status === 'payment_failed' || order.status === 'cancelled') {
            if (!cancelled) {
              setResolution(order.status === 'cancelled' ? 'cancelled' : 'payment_failed');
              setMessage(order.status === 'cancelled' ? 'Order was cancelled.' : 'Payment was not confirmed.');
            }
            return;
          }

          if (!cancelled) setMessage('Waiting for Yoco to confirm payment…');
        } catch {
          // keep polling
        }

        await new Promise(r => setTimeout(r, 2500));
      }

      if (!cancelled) {
        setResolution('error');
        setMessage('Confirmation is taking longer than expected. Check your orders shortly.');
      }
    };

    void process();
    return () => { cancelled = true; };
  }, [type, clearCart, searchParams]);

  // ── Pending ──
  if (resolution === 'pending') {
    return (
      <div className="max-w-md mx-auto px-4 py-16 pb-28 text-center md:py-24 md:pb-16">
        <div className="bg-white rounded-3xl border border-gray-100 p-12 shadow-sm">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
            className="w-12 h-12 mx-auto mb-6 rounded-full"
            style={{ border: '2.5px solid #e9d5ff', borderTopColor: '#a855f7' }}
          />
          <div className="flex items-center justify-center gap-2 mb-2 text-gray-700">
            <Clock3 className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">Confirming payment</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Finalising…</h2>
          <p className="text-gray-500 text-sm">{message}</p>
        </div>
      </div>
    );
  }

  // ── Resolved ──
  const config = {
    paid: {
      icon: CheckCircle2,
      gradient: 'linear-gradient(135deg,#4ade80,#22d3ee)',
      title: 'Payment Successful!',
      sub: isWalletTopUp ? 'Your wallet is ready to use.' : 'Your order is secured.',
      primaryLabel: isWalletTopUp ? 'Open Your Profile' : 'View My Orders',
      primaryTo: isWalletTopUp ? '/profile' : '/orders',
    },
    error: {
      icon: AlertCircle,
      gradient: 'linear-gradient(135deg,#f59e0b,#ef4444)',
      title: 'Still Reconciling',
      sub: null,
      primaryLabel: isWalletTopUp ? 'Open Your Profile' : 'View My Orders',
      primaryTo: isWalletTopUp ? '/profile' : '/orders',
    },
    payment_failed: {
      icon: XCircle,
      gradient: 'linear-gradient(135deg,#fb923c,#ef4444)',
      title: 'Payment Failed',
      sub: null,
      primaryLabel: isWalletTopUp ? 'Open Your Profile' : 'Back to Checkout',
      primaryTo: isWalletTopUp ? '/profile' : '/checkout',
    },
    cancelled: {
      icon: XCircle,
      gradient: 'linear-gradient(135deg,#94a3b8,#64748b)',
      title: 'Payment Cancelled',
      sub: null,
      primaryLabel: isWalletTopUp ? 'Open Your Profile' : 'Back to Checkout',
      primaryTo: isWalletTopUp ? '/profile' : '/checkout',
    },
  };

  const c = config[resolution] || config.error;
  const Icon = c.icon;

  return (
    <div className="max-w-md mx-auto px-4 py-16 pb-28 text-center md:py-24 md:pb-16">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="bg-white rounded-3xl border border-gray-100 p-10 shadow-sm"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 18, delay: 0.15 }}
          className="w-20 h-20 rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-md"
          style={{ background: c.gradient }}
        >
          <Icon className="w-10 h-10 text-white" />
        </motion.div>

        <h2 className="text-2xl font-bold text-gray-900 mb-2">{c.title}</h2>
        {c.sub && <p className="text-gray-500 text-sm mb-2">{c.sub}</p>}
        <p className="text-gray-400 text-sm mb-8">{message}</p>

        {resolution === 'paid' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex items-center justify-center gap-2 mb-7 p-3 rounded-xl"
            style={{ background: 'linear-gradient(135deg,#f5f3ff,#fce7f3)' }}
          >
            <Sparkles className="w-4 h-4 text-purple-500" />
            <p className="text-sm font-medium text-purple-700">Your quirkiness is officially secured!</p>
          </motion.div>
        )}

        <div className="flex flex-col gap-3">
          <button
            onClick={() => navigate(c.primaryTo)}
            className="btn-primary w-full py-3 justify-center"
          >
            {c.primaryLabel} <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => navigate('/')}
            className="btn-secondary w-full py-2.5 justify-center"
          >
            <ShoppingBag className="w-4 h-4" /> Continue Shopping
          </button>
        </div>
      </motion.div>
    </div>
  );
}
