import { useState } from 'react';
import { useCart } from '../../context/CartContext';
import { motion, AnimatePresence } from 'motion/react';
import { CreditCard, Truck, CheckCircle2, ArrowRight, ArrowLeft, ShoppingBag, Sparkles, LogIn } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useNavigate } from 'react-router-dom';
import { db, auth, handleFirestoreError, OperationType, signIn } from '../../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { initiateYocoCheckout } from '../../services/paymentService';

type CheckoutStep = 'cart' | 'shipping' | 'payment' | 'success';

export default function Checkout() {
  const { items, total, removeFromCart, updateQuantity, clearCart } = useCart();
  const [step, setStep] = useState<CheckoutStep>('cart');
  const [isProcessing, setIsProcessing] = useState(false);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: '',
    address: '',
    city: '',
    zip: '',
    cardName: '',
    cardNumber: '',
    expiry: '',
    cvv: ''
  });

  const handleNext = async () => {
    if (step === 'cart') setStep('shipping');
    else if (step === 'shipping') setStep('payment');
    else if (step === 'payment') {
      if (!auth.currentUser) {
        // Instead of alert, we could navigate or show a message
        return;
      }
      
      setIsProcessing(true);
      try {
        // 1. Create the order in Firestore with 'pending_payment' status
        const orderData = {
          userId: auth.currentUser.uid,
          userEmail: auth.currentUser.email,
          items: items.map(item => ({
            id: item.id,
            name: item.name,
            price: item.priceRange.min,
            quantity: item.quantity,
            imageUrl: item.imageUrl
          })),
          total,
          status: 'pending_payment',
          shippingInfo: {
            email: formData.email,
            address: formData.address,
            city: formData.city,
            zip: formData.zip
          },
          createdAt: serverTimestamp(),
          orderType: 'store'
        };

        const orderRef = await addDoc(collection(db, 'orders'), orderData);
        
        // 2. Initiate Yoco Checkout
        const itemName = items.length === 1 ? items[0].name : `Order #${orderRef.id.slice(0, 8)}`;
        try {
          await initiateYocoCheckout(total, itemName, orderRef.id);
        } catch (paymentError: any) {
          console.error('Yoco Payment initiation error:', paymentError);
          // If payment initiation fails, we should probably update the order status or at least show a clearer error
          throw new Error(`Payment initiation failed: ${paymentError.message}`);
        }
        
        // Note: The user will be redirected to Yoco, so the code below won't run immediately
        // but we'll handle the return via /payment/success
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'orders');
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleBack = () => {
    if (step === 'shipping') setStep('cart');
    else if (step === 'payment') setStep('shipping');
  };

  if (!auth.currentUser && step !== 'success') {
    return (
      <div className="max-w-7xl mx-auto px-4 py-32 text-center">
        <LogIn className="w-16 h-16 mx-auto text-zinc-100 mb-8" />
        <h2 className="text-4xl font-bold tracking-tighter uppercase mb-4">Sign in to checkout</h2>
        <p className="text-zinc-400 text-xs uppercase tracking-widest mb-12">Your quirkiness needs an owner.</p>
        <button 
          onClick={signIn}
          className="px-12 py-4 bg-black text-white text-[10px] font-bold uppercase tracking-widest hover:bg-quirky transition-all"
        >
          Sign In with Google
        </button>
      </div>
    );
  }

  if (items.length === 0 && step !== 'success') {
    return (
      <div className="max-w-7xl mx-auto px-4 py-32 text-center">
        <ShoppingBag className="w-16 h-16 mx-auto text-zinc-100 mb-8" />
        <h2 className="text-4xl font-bold tracking-tighter uppercase mb-4">Your cart is empty</h2>
        <p className="text-zinc-400 text-xs uppercase tracking-widest mb-12">Fill it with some quirkiness.</p>
        <button 
          onClick={() => navigate('/')}
          className="px-12 py-4 bg-black text-white text-[10px] font-bold uppercase tracking-widest hover:bg-quirky transition-all"
        >
          Back to Store
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="flex items-center justify-between mb-12">
        <h1 className="text-4xl font-bold tracking-tight uppercase font-display">Checkout</h1>
        <div className="flex items-center gap-4">
          {['cart', 'shipping', 'payment'].map((s, i) => (
            <div key={s} className="flex items-center gap-4">
              <div className={cn(
                "w-8 h-8 rounded-none border flex items-center justify-center text-[10px] font-bold transition-all",
                step === s ? "bg-black text-white border-black" : "bg-white text-zinc-300 border-zinc-100"
              )}>
                {i + 1}
              </div>
              {i < 2 && <div className="w-12 h-px bg-zinc-100" />}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2">
          <AnimatePresence mode="wait">
            {step === 'cart' && (
              <motion.div
                key="cart"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6"
              >
                {items.map((item) => (
                  <div key={item.id} className="p-6 bg-white border border-zinc-100 flex items-center gap-6 group">
                    <div className="w-24 h-24 bg-zinc-50 overflow-hidden border border-zinc-100">
                      <img src={item.imageUrl} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all" alt="" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-sm uppercase tracking-tight">{item.name}</h3>
                      <p className="text-[10px] text-zinc-400 uppercase tracking-widest">{item.category}</p>
                      <div className="flex items-center gap-4 mt-4">
                        <div className="flex items-center border border-zinc-100">
                          <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="px-3 py-1 hover:bg-zinc-50">-</button>
                          <span className="px-3 py-1 text-xs font-bold">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="px-3 py-1 hover:bg-zinc-50">+</button>
                        </div>
                        <button onClick={() => removeFromCart(item.id)} className="text-[10px] font-bold text-hot uppercase tracking-widest">Remove</button>
                      </div>
                    </div>
                    <p className="font-bold text-sm">R{item.priceRange.min * item.quantity}</p>
                  </div>
                ))}
                
                {/* AI Add-on Suggestion */}
                <div className="p-8 bg-zinc-900 text-white relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-12 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Sparkles className="w-32 h-32" />
                  </div>
                  <div className="relative z-10">
                    <h4 className="text-[8px] font-bold uppercase tracking-[0.4em] text-quirky mb-2">Aura Dynamic Suggestion</h4>
                    <p className="text-xs font-bold mb-6">Complete the look with a Quirkify Mystery Pack?</p>
                    <button className="px-6 py-2 bg-white text-black text-[8px] font-bold uppercase tracking-widest hover:bg-cyber transition-all">Add for R99</button>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 'shipping' && (
              <motion.div
                key="shipping"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6"
              >
                <div className="grid grid-cols-2 gap-6">
                  <div className="col-span-2">
                    <label className="text-[8px] font-bold uppercase tracking-widest text-zinc-400 block mb-2">Email Address</label>
                    <input 
                      type="email" 
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full p-4 bg-zinc-50 border border-zinc-100 focus:outline-none focus:border-black text-xs font-bold" 
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[8px] font-bold uppercase tracking-widest text-zinc-400 block mb-2">Shipping Address</label>
                    <input 
                      type="text" 
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full p-4 bg-zinc-50 border border-zinc-100 focus:outline-none focus:border-black text-xs font-bold" 
                    />
                  </div>
                  <div>
                    <label className="text-[8px] font-bold uppercase tracking-widest text-zinc-400 block mb-2">City</label>
                    <input 
                      type="text" 
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="w-full p-4 bg-zinc-50 border border-zinc-100 focus:outline-none focus:border-black text-xs font-bold" 
                    />
                  </div>
                  <div>
                    <label className="text-[8px] font-bold uppercase tracking-widest text-zinc-400 block mb-2">ZIP Code</label>
                    <input 
                      type="text" 
                      value={formData.zip}
                      onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
                      className="w-full p-4 bg-zinc-50 border border-zinc-100 focus:outline-none focus:border-black text-xs font-bold" 
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {step === 'payment' && (
              <motion.div
                key="payment"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6"
              >
                <div className="p-8 bg-zinc-50 border border-zinc-100 mb-8">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="p-3 bg-black text-white">
                      <CreditCard className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-tight">Secure Payment</h3>
                      <p className="text-[8px] text-zinc-400 font-bold uppercase tracking-widest">Encrypted via Aura Pay</p>
                    </div>
                  </div>
                  
                  <div className="space-y-6">
                    <div>
                      <label className="text-[8px] font-bold uppercase tracking-widest text-zinc-400 block mb-2">Cardholder Name</label>
                      <input 
                        type="text" 
                        value={formData.cardName}
                        onChange={(e) => setFormData({ ...formData, cardName: e.target.value })}
                        className="w-full p-4 bg-white border border-zinc-100 focus:outline-none focus:border-black text-xs font-bold" 
                      />
                    </div>
                    <div>
                      <label className="text-[8px] font-bold uppercase tracking-widest text-zinc-400 block mb-2">Card Number</label>
                      <input 
                        type="text" 
                        placeholder="0000 0000 0000 0000" 
                        value={formData.cardNumber}
                        onChange={(e) => setFormData({ ...formData, cardNumber: e.target.value })}
                        className="w-full p-4 bg-white border border-zinc-100 focus:outline-none focus:border-black text-xs font-bold" 
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="text-[8px] font-bold uppercase tracking-widest text-zinc-400 block mb-2">Expiry Date</label>
                        <input 
                          type="text" 
                          placeholder="MM/YY" 
                          value={formData.expiry}
                          onChange={(e) => setFormData({ ...formData, expiry: e.target.value })}
                          className="w-full p-4 bg-white border border-zinc-100 focus:outline-none focus:border-black text-xs font-bold" 
                        />
                      </div>
                      <div>
                        <label className="text-[8px] font-bold uppercase tracking-widest text-zinc-400 block mb-2">CVV</label>
                        <input 
                          type="text" 
                          placeholder="000" 
                          value={formData.cvv}
                          onChange={(e) => setFormData({ ...formData, cvv: e.target.value })}
                          className="w-full p-4 bg-white border border-zinc-100 focus:outline-none focus:border-black text-xs font-bold" 
                        />
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 p-4 bg-cyber/10 border border-cyber/20">
                  <Sparkles className="w-4 h-4 text-cyber" />
                  <p className="text-[8px] font-bold uppercase tracking-widest text-cyber">You'll earn 250 XP for this purchase!</p>
                </div>
              </motion.div>
            )}

            {step === 'success' && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-20"
              >
                <div className="w-20 h-20 bg-green-500 text-white rounded-full flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-green-200">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h2 className="text-5xl font-bold tracking-tighter uppercase mb-4">Order Confirmed</h2>
                <p className="text-zinc-400 text-xs uppercase tracking-widest mb-12">Your quirkiness is on its way.</p>
                <button 
                  onClick={() => navigate('/')}
                  className="px-12 py-4 bg-black text-white text-[10px] font-bold uppercase tracking-widest hover:bg-quirky transition-all"
                >
                  Continue Shopping
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {step !== 'success' && (
          <div className="lg:col-span-1">
            <div className="p-8 bg-white border border-zinc-100 sticky top-24">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] mb-8 text-zinc-400">Order Summary</h3>
              <div className="space-y-4 mb-8">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-zinc-400 uppercase tracking-widest">Subtotal</span>
                  <span>R{total}</span>
                </div>
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-zinc-400 uppercase tracking-widest">Shipping</span>
                  <span className="text-green-600 uppercase tracking-widest">Free</span>
                </div>
                <div className="h-px bg-zinc-100 my-4" />
                <div className="flex justify-between text-lg font-bold">
                  <span className="uppercase tracking-tighter">Total</span>
                  <span>R{total}</span>
                </div>
              </div>

              <div className="space-y-3">
                <button 
                  onClick={handleNext}
                  className="w-full py-4 bg-black text-white text-[10px] font-bold uppercase tracking-widest hover:bg-quirky transition-all flex items-center justify-center gap-2"
                >
                  {step === 'payment' ? 'Place Order' : 'Next Step'}
                  <ArrowRight className="w-4 h-4" />
                </button>
                {step !== 'cart' && (
                  <button 
                    onClick={handleBack}
                    className="w-full py-4 bg-white text-zinc-400 text-[10px] font-bold uppercase tracking-widest hover:text-black transition-all flex items-center justify-center gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
