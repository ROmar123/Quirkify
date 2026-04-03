import { useState } from 'react';
import { useCart } from '../../context/CartContext';
import { motion, AnimatePresence } from 'motion/react';
import { CreditCard, Truck, CheckCircle2, ArrowRight, ArrowLeft, ShoppingBag, Sparkles, LogIn } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db, auth, handleFirestoreError, OperationType, signIn } from '../../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { initiateYocoCheckout } from '../../services/paymentService';

type CheckoutStep = 'cart' | 'shipping' | 'payment' | 'success';

const STEPS = ['cart', 'shipping', 'payment'];
const STEP_LABELS = ['Cart', 'Shipping', 'Payment'];

export default function Checkout() {
  const { items, total, removeFromCart, updateQuantity, clearCart } = useCart();
  const [step, setStep] = useState<CheckoutStep>('cart');
  const [isProcessing, setIsProcessing] = useState(false);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: '', address: '', city: '', zip: '',
    cardName: '', cardNumber: '', expiry: '', cvv: ''
  });

  const handleNext = async () => {
    if (step === 'cart') setStep('shipping');
    else if (step === 'shipping') setStep('payment');
    else if (step === 'payment') {
      if (!auth.currentUser) return;
      setIsProcessing(true);
      try {
        const orderData = {
          userId: auth.currentUser.uid,
          userEmail: auth.currentUser.email,
          items: items.map(item => ({
            id: item.id, name: item.name,
            price: item.priceRange.min, quantity: item.quantity, imageUrl: item.imageUrl
          })),
          total, status: 'pending_payment',
          shippingInfo: { email: formData.email, address: formData.address, city: formData.city, zip: formData.zip },
          createdAt: serverTimestamp(), orderType: 'store'
        };
        const orderRef = await addDoc(collection(db, 'orders'), orderData);
        const itemName = items.length === 1 ? items[0].name : `Order #${orderRef.id.slice(0, 8)}`;
        try {
          await initiateYocoCheckout(total, itemName, orderRef.id);
        } catch (paymentError: any) {
          throw new Error(`Payment initiation failed: ${paymentError.message}`);
        }
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

  const inputClass = "w-full p-4 bg-purple-50 border-2 border-purple-100 rounded-2xl focus:outline-none focus:border-purple-400 text-sm font-semibold text-purple-800 placeholder:text-purple-300 transition-colors";
  const labelClass = "text-xs font-bold text-purple-400 block mb-2";

  if (!auth.currentUser && step !== 'success') {
    return (
      <div className="max-w-lg mx-auto px-4 py-32 text-center">
        <div className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}>
          <LogIn className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-3xl font-black mb-3 gradient-text">Sign in to checkout</h2>
        <p className="text-purple-400 text-sm font-semibold mb-8">Your quirkiness needs an owner.</p>
        <button onClick={signIn} className="btn-primary px-10 py-4 text-base">Sign In with Google</button>
      </div>
    );
  }

  if (items.length === 0 && step !== 'success') {
    return (
      <div className="max-w-lg mx-auto px-4 py-32 text-center">
        <div className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #A855F7, #60A5FA)' }}>
          <ShoppingBag className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-3xl font-black mb-3 gradient-text">Your cart is empty</h2>
        <p className="text-purple-400 text-sm font-semibold mb-8">Fill it with some quirkiness.</p>
        <button onClick={() => navigate('/')} className="btn-primary px-10 py-4 text-base">Back to Store</button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      {/* Header + Step indicator */}
      <div className="flex items-center justify-between mb-10">
        <h1 className="text-3xl font-black gradient-text">Checkout</h1>
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all"
                style={step === s
                  ? { background: 'linear-gradient(135deg, #F472B6, #A855F7)', color: 'white', boxShadow: '0 4px 15px rgba(168,85,247,0.4)' }
                  : { background: '#F3F0FF', color: '#C4B5FD' }
                }
              >
                {i + 1}
              </div>
              <span className="hidden sm:inline text-xs font-semibold text-purple-400">{STEP_LABELS[i]}</span>
              {i < 2 && <div className="w-8 h-0.5 bg-purple-100 mx-1" />}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <AnimatePresence mode="wait">
            {step === 'cart' && (
              <motion.div key="cart" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4">
                {items.map((item) => (
                  <div key={item.id} className="p-5 bg-white rounded-3xl border border-purple-100 shadow-sm flex items-center gap-5 group">
                    <div className="w-20 h-20 bg-purple-50 rounded-2xl overflow-hidden flex-shrink-0">
                      <img src={item.imageUrl} className="w-full h-full object-cover" alt="" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-sm text-purple-900">{item.name}</h3>
                      <p className="text-xs text-purple-400 font-semibold">{item.category}</p>
                      <div className="flex items-center gap-3 mt-3">
                        <div className="flex items-center bg-purple-50 rounded-xl border border-purple-100 overflow-hidden">
                          <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="px-3 py-1 text-purple-500 hover:bg-purple-100 font-bold">-</button>
                          <span className="px-3 py-1 text-xs font-bold text-purple-700">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="px-3 py-1 text-purple-500 hover:bg-purple-100 font-bold">+</button>
                        </div>
                        <button onClick={() => removeFromCart(item.id)} className="text-xs font-bold text-pink-400 hover:text-pink-600">Remove</button>
                      </div>
                    </div>
                    <p className="font-black text-purple-900">R{item.priceRange.min * item.quantity}</p>
                  </div>
                ))}

                {/* AI Add-on */}
                <div className="p-6 rounded-3xl text-white relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #A855F7, #6366F1)' }}>
                  <Sparkles className="absolute top-4 right-4 w-8 h-8 opacity-30" />
                  <p className="text-xs font-bold text-pink-200 mb-1">✨ Aura Suggestion</p>
                  <p className="text-sm font-bold mb-4">Complete the look with a Quirkify Mystery Pack?</p>
                  <button className="px-5 py-2 bg-white text-purple-700 rounded-full text-xs font-bold hover:bg-pink-50 transition-colors">Add for R99</button>
                </div>
              </motion.div>
            )}

            {step === 'shipping' && (
              <motion.div key="shipping" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="bg-white rounded-3xl border border-purple-100 shadow-sm p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #4ADE80, #60A5FA)' }}>
                    <Truck className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="font-black text-purple-900">Shipping Details</h3>
                </div>
                <div className="grid grid-cols-2 gap-5">
                  <div className="col-span-2">
                    <label className={labelClass}>Email Address</label>
                    <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className={inputClass} placeholder="you@example.com" />
                  </div>
                  <div className="col-span-2">
                    <label className={labelClass}>Shipping Address</label>
                    <input type="text" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className={inputClass} placeholder="123 Main Street" />
                  </div>
                  <div>
                    <label className={labelClass}>City</label>
                    <input type="text" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} className={inputClass} placeholder="Cape Town" />
                  </div>
                  <div>
                    <label className={labelClass}>ZIP Code</label>
                    <input type="text" value={formData.zip} onChange={(e) => setFormData({ ...formData, zip: e.target.value })} className={inputClass} placeholder="8001" />
                  </div>
                </div>
              </motion.div>
            )}

            {step === 'payment' && (
              <motion.div key="payment" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4">
                <div className="bg-white rounded-3xl border border-purple-100 shadow-sm p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}>
                      <CreditCard className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-black text-purple-900">Secure Payment</h3>
                      <p className="text-xs text-purple-400 font-semibold">Powered by Yoco</p>
                    </div>
                  </div>
                  <div className="space-y-5">
                    <div>
                      <label className={labelClass}>Cardholder Name</label>
                      <input type="text" value={formData.cardName} onChange={(e) => setFormData({ ...formData, cardName: e.target.value })} className={inputClass} placeholder="Jane Doe" />
                    </div>
                    <div>
                      <label className={labelClass}>Card Number</label>
                      <input type="text" placeholder="0000 0000 0000 0000" value={formData.cardNumber} onChange={(e) => setFormData({ ...formData, cardNumber: e.target.value })} className={inputClass} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>Expiry Date</label>
                        <input type="text" placeholder="MM/YY" value={formData.expiry} onChange={(e) => setFormData({ ...formData, expiry: e.target.value })} className={inputClass} />
                      </div>
                      <div>
                        <label className={labelClass}>CVV</label>
                        <input type="text" placeholder="000" value={formData.cvv} onChange={(e) => setFormData({ ...formData, cvv: e.target.value })} className={inputClass} />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 rounded-2xl" style={{ background: 'linear-gradient(135deg, #ede9fe, #fce7f3)' }}>
                  <Sparkles className="w-4 h-4 text-purple-500" />
                  <p className="text-sm font-bold text-purple-600">You'll earn 250 XP for this purchase! 🎉</p>
                </div>
              </motion.div>
            )}

            {step === 'success' && (
              <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-20">
                <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8 shadow-xl" style={{ background: 'linear-gradient(135deg, #4ADE80, #60A5FA)' }}>
                  <CheckCircle2 className="w-12 h-12 text-white" />
                </div>
                <h2 className="text-4xl font-black mb-3 gradient-text">Order Confirmed! 🎉</h2>
                <p className="text-purple-400 text-sm font-semibold mb-10">Your quirkiness is on its way.</p>
                <button onClick={() => navigate('/')} className="btn-primary px-10 py-4 text-base">Continue Shopping</button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {step !== 'success' && (
          <div className="lg:col-span-1">
            <div className="bg-white rounded-3xl border border-purple-100 shadow-sm p-6 sticky top-24">
              <h3 className="text-sm font-black text-purple-400 uppercase tracking-wide mb-6">Order Summary</h3>
              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm font-semibold">
                  <span className="text-purple-400">Subtotal</span>
                  <span className="text-purple-900 font-bold">R{total}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold">
                  <span className="text-purple-400">Shipping</span>
                  <span className="text-green-500 font-bold">Free</span>
                </div>
                <div className="h-px bg-purple-100 my-2" />
                <div className="flex justify-between font-black text-lg">
                  <span className="text-purple-900">Total</span>
                  <span className="gradient-text">R{total}</span>
                </div>
              </div>
              <div className="space-y-3">
                <button
                  onClick={handleNext}
                  disabled={isProcessing}
                  className="btn-primary w-full py-4 text-sm justify-center"
                >
                  {isProcessing ? 'Processing...' : step === 'payment' ? 'Place Order' : 'Next Step'}
                  {!isProcessing && <ArrowRight className="w-4 h-4" />}
                </button>
                {step !== 'cart' && (
                  <button onClick={handleBack} className="btn-secondary w-full py-3 text-sm justify-center">
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
