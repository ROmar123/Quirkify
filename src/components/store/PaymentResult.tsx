import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { CheckCircle2, XCircle, ArrowRight, ShoppingBag, Sparkles } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { doc, updateDoc, getDoc, increment } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { addXP } from '../../services/gamificationService';
import PageHeader from '../layout/PageHeader';

export default function PaymentResult({ type }: { type: 'success' | 'cancel' }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { clearCart } = useCart();
  const [isProcessing, setIsProcessing] = useState(true);
  const [xpEarned, setXpEarned] = useState(0);

  useEffect(() => {
    const processPayment = async () => {
      if (type === 'success') {
        const orderId = searchParams.get('orderId');
        const amount = Number(searchParams.get('amount'));

        if (orderId) {
          try {
            const orderRef = doc(db, 'orders', orderId);
            const orderSnap = await getDoc(orderRef);
            if (orderSnap.exists()) {
              const orderData = orderSnap.data();
              await updateDoc(orderRef, { status: 'paid' });
              if (auth.currentUser) {
                // Award XP: 1 XP per R10 spent, minimum 10 XP
                const xp = Math.max(10, Math.floor(amount / 10));
                await addXP(auth.currentUser.uid, xp);
                setXpEarned(xp);
              }
              if (orderData.orderType === 'topup' && auth.currentUser) {
                const userProgressRef = doc(db, 'users', auth.currentUser.uid, 'progress', 'stats');
                await updateDoc(userProgressRef, { balance: increment(amount) });
              }
            }
          } catch (error) {
            console.error('Failed to update order status:', error);
          }
        }
        clearCart();
      }
      setIsProcessing(false);
    };

    processPayment();
  }, [type, clearCart, searchParams]);

  if (isProcessing) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#FDF4FF' }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-10 h-10 border-4 border-t-transparent rounded-full"
          style={{ borderColor: '#A855F7', borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader />
    <div className="max-w-lg mx-auto px-4 py-24 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="bg-white rounded-3xl border border-purple-100 p-12 shadow-xl"
      >
        {type === 'success' ? (
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
              <p className="text-sm font-bold text-purple-600">You earned {xpEarned} XP! 🎉</p>
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
            <h2 className="text-4xl font-black mb-3" style={{ color: '#2D1B69' }}>Payment Cancelled</h2>
            <p className="text-purple-400 font-semibold mb-10">No worries — your cart is still waiting for you.</p>
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
        )}
      </motion.div>
    </div>
    </div>
  );
}
