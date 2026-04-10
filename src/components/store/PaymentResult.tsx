import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { CheckCircle2, XCircle, ArrowRight, ShoppingBag, Sparkles, Clock3, AlertCircle } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { cancelStoreCheckout, getStoreCheckoutStatus } from '../../services/paymentService';

type ResolutionState = 'pending' | 'paid' | 'payment_failed' | 'cancelled' | 'error';

export default function PaymentResult({ type }: { type: 'success' | 'cancel' }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { clearCart } = useCart();
  const [resolution, setResolution] = useState<ResolutionState>('pending');
  const [message, setMessage] = useState('Confirming your payment with Quirkify...');

  useEffect(() => {
    let cancelled = false;

    const processPayment = async () => {
      const orderId = searchParams.get('orderId');

      if (!orderId) {
        if (!cancelled) {
          setResolution(type === 'cancel' ? 'cancelled' : 'error');
          setMessage('We could not find the order linked to this payment return.');
        }
        return;
      }

      if (type === 'cancel') {
        try {
          const cancelledOrder = await cancelStoreCheckout(orderId, 'Customer returned from Yoco cancel flow');
          if (!cancelled) {
            setResolution(cancelledOrder?.status === 'paid' ? 'paid' : 'cancelled');
            setMessage(
              cancelledOrder?.status === 'paid'
                ? 'Payment was already confirmed before the cancel return completed.'
                : 'Your checkout was cancelled before payment was confirmed.'
            );
            if (cancelledOrder?.status === 'paid') {
              clearCart();
            }
          }
        } catch (error) {
          console.error('Failed to cancel reserved order after payment cancellation:', error);
          if (!cancelled) {
            setResolution('error');
            setMessage('We could not cancel this checkout cleanly. Please check your orders.');
          }
        }
        return;
      }

      const startedAt = Date.now();
      const timeoutMs = 90000;

      while (!cancelled && Date.now() - startedAt < timeoutMs) {
        try {
          const order = await getStoreCheckoutStatus(orderId);

          if (order.status === 'paid' || order.payment_status === 'completed') {
            clearCart();
            setResolution('paid');
            setMessage('Payment confirmed. Your order is secured.');
            return;
          }

          if (order.status === 'payment_failed' || order.status === 'cancelled') {
            setResolution(order.status === 'cancelled' ? 'cancelled' : 'payment_failed');
            setMessage(
              order.status === 'cancelled'
                ? 'This checkout was cancelled before payment was confirmed.'
                : 'Payment was not confirmed. Please try checkout again.'
            );
            return;
          }

          setMessage(
            order.checkout_session_id
              ? 'Waiting for Yoco to confirm payment with Quirkify...'
              : 'Checkout was created, but the payment session is still being reconciled.'
          );
        } catch (error) {
          console.error('Failed to poll store checkout status:', error);
        }

        await new Promise((resolve) => setTimeout(resolve, 2500));
      }

      if (!cancelled) {
        setResolution('error');
        setMessage('Payment return was received, but confirmation is taking too long. Please check your orders shortly.');
      }
    };

    void processPayment();
    return () => {
      cancelled = true;
    };
  }, [type, clearCart, searchParams]);

  if (resolution === 'pending') {
    return (
      <div className="max-w-lg mx-auto px-4 py-24 text-center">
        <div className="bg-white rounded-3xl border border-purple-100 p-12 shadow-xl">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="w-16 h-16 mx-auto mb-8 border-4 border-t-transparent rounded-full"
            style={{ borderColor: '#A855F7', borderTopColor: 'transparent' }}
          />
          <div className="flex items-center justify-center gap-2 mb-3 text-purple-700">
            <Clock3 className="w-5 h-5" />
            <span className="text-sm font-black uppercase tracking-wide">Pending confirmation</span>
          </div>
          <h2 className="text-4xl font-black mb-3 gradient-text">Finalising payment</h2>
          <p className="text-purple-500 font-semibold">{message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-24 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="bg-white rounded-3xl border border-purple-100 p-12 shadow-xl"
      >
        {resolution === 'paid' ? (
          <>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.2 }}
              className="w-24 h-24 rounded-full mx-auto mb-8 flex items-center justify-center shadow-xl"
              style={{ background: 'linear-gradient(135deg, #4ADE80, #60A5FA)' }}
            >
              <CheckCircle2 className="w-12 h-12 text-white" />
            </motion.div>
            <h2 className="text-4xl font-black mb-3 gradient-text">Payment Successful!</h2>
            <p className="text-purple-400 font-semibold mb-2">Your quirkiness is officially secured.</p>
            <div className="flex items-center justify-center gap-2 mb-10 p-3 rounded-2xl" style={{ background: 'linear-gradient(135deg, #ede9fe, #fce7f3)' }}>
              <Sparkles className="w-4 h-4 text-purple-500" />
              <p className="text-sm font-bold text-purple-600">{message}</p>
            </div>
            <div className="flex flex-col gap-3">
              <button onClick={() => navigate('/orders')} className="btn-primary w-full py-4 text-sm justify-center">
                View My Orders
                <ArrowRight className="w-4 h-4" />
              </button>
              <button onClick={() => navigate('/')} className="btn-secondary w-full py-3 text-sm justify-center">
                Continue Shopping
              </button>
            </div>
          </>
        ) : (
          resolution === 'error' ? (
          <>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.2 }}
              className="w-24 h-24 rounded-full mx-auto mb-8 flex items-center justify-center shadow-xl"
              style={{ background: 'linear-gradient(135deg, #F59E0B, #F43F5E)' }}
            >
              <AlertCircle className="w-12 h-12 text-white" />
            </motion.div>
            <h2 className="text-4xl font-black mb-3" style={{ color: '#2D1B69' }}>Still reconciling</h2>
            <p className="text-purple-400 font-semibold mb-10">{message}</p>
            <div className="flex flex-col gap-3">
              <button onClick={() => navigate('/orders')} className="btn-primary w-full py-4 text-sm justify-center">
                View My Orders
                <ArrowRight className="w-4 h-4" />
              </button>
              <button onClick={() => navigate('/')} className="btn-secondary w-full py-3 text-sm justify-center">
                Continue Shopping
              </button>
            </div>
          </>
        ) : (
          <>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.2 }}
              className="w-24 h-24 rounded-full mx-auto mb-8 flex items-center justify-center shadow-xl"
              style={{ background: 'linear-gradient(135deg, #FB923C, #F43F5E)' }}
            >
              <XCircle className="w-12 h-12 text-white" />
            </motion.div>
            <h2 className="text-4xl font-black mb-3" style={{ color: '#2D1B69' }}>
              {resolution === 'payment_failed' ? 'Payment Failed' : 'Payment Cancelled'}
            </h2>
            <p className="text-purple-400 font-semibold mb-10">{message}</p>
            <div className="flex flex-col gap-3">
              <button onClick={() => navigate('/checkout')} className="btn-primary w-full py-4 text-sm justify-center">
                <ShoppingBag className="w-4 h-4" />
                Back to Checkout
              </button>
              <button onClick={() => navigate('/')} className="btn-secondary w-full py-3 text-sm justify-center">
                Continue Shopping
              </button>
            </div>
          </>
        )
        )}
      </motion.div>
    </div>
  );
}
