import { useState } from 'react';
import { useCart } from '../../context/CartContext';
import { motion, AnimatePresence } from 'motion/react';
import { CreditCard, Truck, ArrowRight, ArrowLeft, ShoppingBag, Sparkles, LogIn, Shield, Zap, MapPin } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useNavigate } from 'react-router-dom';
import { db, auth, handleFirestoreError, OperationType, signIn } from '../../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { initiateYocoCheckout } from '../../services/paymentService';
type CheckoutStep = 'cart' | 'shipping' | 'payment';

const STEPS = [
  { id: 'cart', label: 'Cart', icon: ShoppingBag },
  { id: 'shipping', label: 'Delivery', icon: Truck },
  { id: 'payment', label: 'Pay', icon: CreditCard },
] as const;

const VAT_RATE = 0.15;
const SHIPPING_FEE = 120;

export default function Checkout() {
  const { items, total, removeFromCart, updateQuantity } = useCart();
  const [step, setStep] = useState<CheckoutStep>('cart');
  const [isProcessing, setIsProcessing] = useState(false);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: auth.currentUser?.email || '',
    address: '',
    city: '',
    zip: '',
    phone: '',
  });

  const subtotal = total;
  const vat = Math.round(subtotal * VAT_RATE);
  const orderTotal = subtotal + SHIPPING_FEE + vat;

  const field = (key: keyof typeof formData) => ({
    value: formData[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, [key]: e.target.value })),
  });

  const handleNext = async () => {
    if (step === 'cart') setStep('shipping');
    else if (step === 'shipping') {
      // Validate shipping form
      if (!formData.email || !formData.address || !formData.city || !formData.zip || !formData.phone) {
        alert('Please fill in all delivery details');
        return;
      }
      setStep('payment');
    }
    else if (step === 'payment') {
      if (!auth.currentUser) return;
      setIsProcessing(true);
      try {
        const orderData = {
          userId: auth.currentUser.uid,
          userEmail: auth.currentUser.email,
          items: items.map(item => ({
            id: item.id,
            name: item.name,
            price: item.priceRange.min,
            quantity: item.quantity,
            imageUrl: item.imageUrl,
          })),
          total: orderTotal,
          status: 'pending',
          shippingInfo: {
            email: formData.email,
            address: formData.address,
            city: formData.city,
            zip: formData.zip,
            phone: formData.phone,
          },
          createdAt: serverTimestamp(),
          orderType: 'store',
        };
        const orderRef = await addDoc(collection(db, 'orders'), orderData);
        const itemName = items.length === 1 ? items[0].name : `Quirkify Order #${orderRef.id.slice(0, 8)}`;
        await initiateYocoCheckout(orderTotal, itemName, orderRef.id);
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

  if (!auth.currentUser) {
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

  if (items.length === 0) {
    return (
      <div className="max-w-lg mx-auto px-4 py-32 text-center">
        <div className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #A855F7, #6366F1)' }}>
          <ShoppingBag className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-3xl font-black mb-3 gradient-text">Your cart is empty</h2>
        <p className="text-purple-400 text-sm font-semibold mb-8">Fill it with some quirkiness.</p>
        <button onClick={() => navigate('/')} className="btn-primary px-10 py-4 text-base">Browse the Store</button>
      </div>
    );
  }

  const currentStepIdx = STEPS.findIndex(s => s.id === step);

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-4 mb-12">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const done = i < currentStepIdx;
          const active = s.id === step;
          return (
            <div key={s.id} className="flex items-center gap-3">
              <div className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300',
                active ? 'border-transparent text-white shadow-lg' : done ? 'border-transparent text-white' : 'border-purple-200 bg-white text-purple-300'
              )} style={(active || done) ? { background: 'linear-gradient(135deg, #F472B6, #A855F7)' } : {}}>
                <Icon className="w-4 h-4" />
              </div>
              <span className={cn('text-xs font-bold hidden sm:inline', active ? 'text-purple-700' : 'text-purple-300')}>
                {s.label}
              </span>
              {i < STEPS.length - 1 && <div className={cn('w-8 h-0.5 rounded-full', i < currentStepIdx ? 'bg-purple-400' : 'bg-purple-100')} />}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2">
          <AnimatePresence mode="wait">
            {/* CART */}
            {step === 'cart' && (
              <motion.div key="cart" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4">
                <h2 className="text-2xl font-black gradient-text mb-6">Your Cart</h2>
                {items.map((item) => (
                  <div key={item.id} className="bg-white rounded-3xl border border-purple-100 p-4 flex items-center gap-4 group shadow-sm hover:shadow-md transition-all">
                    <div className="w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0 bg-purple-50">
                      <img src={item.imageUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-sm truncate">{item.name}</h3>
                      <p className="text-[9px] text-purple-400 font-bold uppercase tracking-widest">{item.category}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <div className="flex items-center bg-purple-50 rounded-full border border-purple-100 overflow-hidden">
                          <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="px-3 py-1 hover:bg-purple-100 text-purple-600 font-bold transition-colors">-</button>
                          <span className="px-3 py-1 text-xs font-bold text-purple-700">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="px-3 py-1 hover:bg-purple-100 text-purple-600 font-bold transition-colors">+</button>
                        </div>
                        <button onClick={() => removeFromCart(item.id)} className="text-[9px] font-bold text-red-400 hover:text-red-600 transition-colors">Remove</button>
                      </div>
                    </div>
                    <p className="font-black text-sm flex-shrink-0">R{item.priceRange.min * item.quantity}</p>
                  </div>
                ))}

                {/* AI Suggestion */}
                <div className="rounded-3xl p-6 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #2D1B69, #A855F7)' }}>
                  <Sparkles className="absolute top-4 right-4 w-8 h-8 text-white/20" />
                  <p className="text-[9px] font-bold uppercase tracking-widest text-pink-300 mb-1">Aura Suggestion</p>
                  <p className="text-sm font-bold text-white">Complete the vibe with a Mystery Pack?</p>
                </div>
              </motion.div>
            )}

            {/* SHIPPING */}
            {step === 'shipping' && (
              <motion.div key="shipping" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                <h2 className="text-2xl font-black gradient-text mb-6">Delivery Details</h2>
                <div className="bg-white rounded-3xl border border-purple-100 p-6 shadow-sm">
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { key: 'email' as const, label: 'Email Address', type: 'email', placeholder: 'you@example.com', span: 2 },
                      { key: 'address' as const, label: 'Street Address', type: 'text', placeholder: '12 Main Road', span: 2 },
                      { key: 'city' as const, label: 'City', type: 'text', placeholder: 'Cape Town', span: 1 },
                      { key: 'zip' as const, label: 'ZIP / Postal Code', type: 'text', placeholder: '8001', span: 1 },
                      { key: 'phone' as const, label: 'Phone (for delivery)', type: 'tel', placeholder: '082 000 0000', span: 2 },
                    ].map(({ key, label, type, placeholder, span }) => (
                      <div key={key} className={span === 2 ? 'col-span-2' : ''}>
                        <label className="text-[9px] font-bold text-purple-400 uppercase tracking-widest block mb-1.5">{label}</label>
                        <input
                          type={type}
                          placeholder={placeholder}
                          {...field(key)}
                          className="w-full p-3 bg-purple-50 border-2 border-purple-100 rounded-2xl text-sm font-semibold text-purple-800 focus:outline-none focus:border-purple-400 transition-colors"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-3 p-4 bg-purple-50 rounded-2xl border border-purple-100 mt-6">
                    <Truck className="w-5 h-5 text-purple-500 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-purple-700">The Courier Guy — Economy</p>
                      <p className="text-[9px] font-bold text-purple-400">3–5 business days · R{SHIPPING_FEE}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* PAYMENT */}
            {step === 'payment' && (
              <motion.div key="payment" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                <h2 className="text-2xl font-black gradient-text mb-6">Secure Payment</h2>
                <div className="bg-white rounded-3xl border border-purple-100 p-8 shadow-sm text-center">
                  <div className="w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #4ADE80, #60A5FA)' }}>
                    <Shield className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-black mb-2" style={{ color: '#2D1B69' }}>Pay with Yoco</h3>
                  <p className="text-purple-400 text-sm font-semibold mb-8 max-w-xs mx-auto">
                    You'll be redirected to Yoco's secure checkout page to complete payment. Your card details are handled safely by Yoco — we never see them.
                  </p>

                  <div className="grid grid-cols-3 gap-3 mb-8">
                    {[
                      { icon: Shield, label: 'PCI Compliant', color: '#4ADE80' },
                      { icon: Zap, label: 'Instant Processing', color: '#A855F7' },
                      { icon: MapPin, label: 'South African Rands', color: '#F472B6' },
                    ].map(({ icon: Icon, label, color }) => (
                      <div key={label} className="bg-purple-50 rounded-2xl p-3 text-center border border-purple-100">
                        <Icon className="w-5 h-5 mx-auto mb-1" style={{ color }} />
                        <p className="text-[8px] font-bold text-purple-600 leading-tight">{label}</p>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 justify-center mb-2">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <p className="text-[10px] font-bold text-purple-400">You'll earn XP for this purchase!</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Order Summary Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-3xl border border-purple-100 p-6 sticky top-24 shadow-sm">
            <h3 className="text-[9px] font-bold uppercase tracking-widest text-purple-400 mb-5">Order Summary</h3>
            <div className="space-y-3 mb-5">
              {items.map(item => (
                <div key={item.id} className="flex justify-between items-center text-xs">
                  <span className="text-purple-700 font-semibold truncate max-w-[120px]">{item.name} × {item.quantity}</span>
                  <span className="font-bold">R{item.priceRange.min * item.quantity}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-purple-50 pt-4 space-y-2">
              <div className="flex justify-between text-xs font-semibold text-purple-500">
                <span>Subtotal</span><span>R{subtotal}</span>
              </div>
              <div className="flex justify-between text-xs font-semibold text-purple-500">
                <span>Shipping</span><span>R{SHIPPING_FEE}</span>
              </div>
              <div className="flex justify-between text-xs font-semibold text-purple-500">
                <span>VAT (15%)</span><span>R{vat}</span>
              </div>
              <div className="flex justify-between text-base font-black pt-2 border-t border-purple-100">
                <span>Total</span>
                <span className="gradient-text">R{orderTotal}</span>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <button
                onClick={handleNext}
                disabled={isProcessing}
                className="btn-primary w-full py-4 text-sm justify-center disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    Processing...
                  </>
                ) : step === 'payment' ? (
                  <><CreditCard className="w-4 h-4" /> Pay R{orderTotal} with Yoco</>
                ) : (
                  <>Next <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
              {step !== 'cart' && (
                <button onClick={handleBack} className="btn-secondary w-full py-3 text-sm justify-center">
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
