import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { CheckCircle2, XCircle, ArrowRight, ShoppingBag } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { doc, updateDoc, getDoc, increment } from 'firebase/firestore';
import { db, auth } from '../../firebase';

export default function PaymentResult({ type }: { type: 'success' | 'cancel' }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { clearCart } = useCart();
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    const processPayment = async () => {
      if (type === 'success') {
        const orderId = searchParams.get('orderId');
        const amount = Number(searchParams.get('amount'));
        
        if (orderId) {
          try {
            // 1. Update order status to 'paid'
            const orderRef = doc(db, 'orders', orderId);
            const orderSnap = await getDoc(orderRef);
            
            if (orderSnap.exists()) {
              const orderData = orderSnap.data();
              await updateDoc(orderRef, { status: 'paid' });
              
              // 2. If it's a top-up, update user balance
              if (orderData.orderType === 'topup' && auth.currentUser) {
                const userProgressRef = doc(db, 'users', auth.currentUser.uid, 'progress', 'stats');
                await updateDoc(userProgressRef, {
                  balance: increment(amount)
                });
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
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-2 border-quirky border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-32 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md mx-auto"
      >
        {type === 'success' ? (
          <>
            <div className="w-20 h-20 bg-green-500 text-white rounded-full flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-green-200">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h2 className="text-5xl font-bold tracking-tighter uppercase mb-4">Payment Successful</h2>
            <p className="text-zinc-400 text-xs uppercase tracking-widest mb-12">Your quirkiness is officially secured.</p>
            <div className="flex flex-col gap-4">
              <button 
                onClick={() => navigate('/orders')}
                className="w-full py-4 bg-black text-white text-[10px] font-bold uppercase tracking-widest hover:bg-quirky transition-all flex items-center justify-center gap-2"
              >
                View My Orders
                <ArrowRight className="w-4 h-4" />
              </button>
              <button 
                onClick={() => navigate('/')}
                className="w-full py-4 bg-white text-zinc-400 text-[10px] font-bold uppercase tracking-widest hover:text-black transition-all"
              >
                Continue Shopping
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="w-20 h-20 bg-hot text-white rounded-full flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-hot/20">
              <XCircle className="w-10 h-10" />
            </div>
            <h2 className="text-5xl font-bold tracking-tighter uppercase mb-4">Payment Cancelled</h2>
            <p className="text-zinc-400 text-xs uppercase tracking-widest mb-12">No worries, your cart is still waiting for you.</p>
            <button 
              onClick={() => navigate('/checkout')}
              className="w-full py-4 bg-black text-white text-[10px] font-bold uppercase tracking-widest hover:bg-quirky transition-all flex items-center justify-center gap-2"
            >
              Back to Checkout
              <ShoppingBag className="w-4 h-4" />
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
}
