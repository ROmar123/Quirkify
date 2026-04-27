import { useState, useEffect } from 'react';
import { useCart } from '../../context/CartContext';
import { motion, AnimatePresence } from 'motion/react';
import {
  CreditCard, Truck, ArrowRight, ArrowLeft, ShoppingBag,
  LogIn, Shield, Zap, MapPin, AlertCircle, Check, Package,
  Sparkles, ChevronRight
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useNavigate } from 'react-router-dom';
import { auth, onAuthStateChanged, type AuthUser } from '../../firebase';
import { startStoreCheckout } from '../../services/paymentService';
import { fetchProduct } from '../../services/productService';
import { fetchShippingQuote, type ShippingQuote } from '../../services/shippingService';
import { searchAddressSuggestions, type AddressSuggestion } from '../../services/locationService';

type CheckoutStep = 'cart' | 'shipping' | 'payment';

const STEPS = [
  { id: 'cart' as const, label: 'Cart', icon: ShoppingBag },
  { id: 'shipping' as const, label: 'Delivery', icon: Truck },
  { id: 'payment' as const, label: 'Pay', icon: CreditCard },
];

const VAT_RATE = 0.15;

export default function Checkout() {
  const { items, total, removeFromCart, updateQuantity } = useCart();
  const [user, setUser] = useState<AuthUser | null>(auth.currentUser);
  const [step, setStep] = useState<CheckoutStep>('cart');
  const [isProcessing, setIsProcessing] = useState(false);
  const [stockErrors, setStockErrors] = useState<string[]>([]);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [shippingQuote, setShippingQuote] = useState<ShippingQuote | null>(null);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingError, setShippingError] = useState<string | null>(null);
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
  const [selectedAddressCoords, setSelectedAddressCoords] = useState<{
    lat: number; lng: number; suburb: string; entered_address: string
  } | null>(null);
  const [validationErrors, setValidationErrors] = useState<Partial<Record<keyof typeof formData, string>>>({});
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: auth.currentUser?.email || '',
    address: '',
    city: '',
    zip: '',
    phone: '',
  });

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    setFormData(prev =>
      user?.email && prev.email !== user.email ? { ...prev, email: user.email } : prev
    );
  }, [user]);

  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const validatePhone = (phone: string) =>
    /^[\d\s\-\+\(\)]+$/.test(phone) && phone.replace(/\D/g, '').length >= 10;

  const validateField = (key: keyof typeof formData, value: string) => {
    const errors = { ...validationErrors };
    if (!value.trim()) errors[key] = 'Required';
    else if (key === 'email' && !validateEmail(value)) errors[key] = 'Enter a valid email';
    else if (key === 'phone' && !validatePhone(value)) errors[key] = 'Enter a valid phone number';
    else if (key === 'zip' && value.trim().length < 3) errors[key] = 'Enter a valid postal code';
    else delete errors[key];
    setValidationErrors(errors);
    return !errors[key];
  };

  useEffect(() => {
    const validate = async () => {
      const errors: string[] = [];
      for (const item of items) {
        try {
          const product = await fetchProduct(item.id);
          if (product) {
            const avail = product.allocations?.store ?? 0;
            if (item.quantity > avail) {
              errors.push(`${item.name}: Only ${avail} available`);
            }
          } else {
            errors.push(`${item.name}: No longer available`);
          }
        } catch {
          errors.push(`${item.name}: Could not verify stock`);
        }
      }
      setStockErrors(errors);
    };
    if (items.length > 0) validate();
    else setStockErrors([]);
  }, [items]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!formData.city.trim() || !formData.zip.trim()) {
        setShippingQuote(null); setShippingError(null); return;
      }
      setShippingLoading(true); setShippingError(null);
      try {
        const quote = await fetchShippingQuote({
          city: formData.city, zip: formData.zip,
          lat: selectedAddressCoords?.lat ?? null,
          lng: selectedAddressCoords?.lng ?? null,
          street_address: formData.address || null,
          suburb: selectedAddressCoords?.suburb ?? null,
          entered_address: selectedAddressCoords?.entered_address ?? null,
        });
        if (!cancelled) setShippingQuote(quote);
      } catch (err) {
        if (!cancelled) setShippingError(err instanceof Error ? err.message : 'Could not load shipping quote.');
      } finally {
        if (!cancelled) setShippingLoading(false);
      }
    };
    const t = window.setTimeout(() => void load(), 250);
    return () => { cancelled = true; window.clearTimeout(t); };
  }, [formData.city, formData.zip, selectedAddressCoords]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const q = formData.address.trim();
      if (q.length < 4) { setAddressSuggestions([]); setAddressError(null); return; }
      setAddressLoading(true); setAddressError(null);
      try {
        const suggestions = await searchAddressSuggestions(q);
        if (!cancelled) { setAddressSuggestions(suggestions); setShowAddressSuggestions(true); }
      } catch (err) {
        if (!cancelled) setAddressError(err instanceof Error ? err.message : 'Could not load suggestions.');
      } finally {
        if (!cancelled) setAddressLoading(false);
      }
    };
    const t = window.setTimeout(() => void load(), 220);
    return () => { cancelled = true; window.clearTimeout(t); };
  }, [formData.address]);

  const shippingFee = shippingQuote?.price ?? 120;
  const subtotal = total;
  // SA retail prices are VAT-inclusive — extract the included VAT for display only
  const vatIncluded = Math.round(subtotal * VAT_RATE / (1 + VAT_RATE));
  const orderTotal = subtotal + shippingFee;

  const handleNext = async () => {
    if (step === 'cart') {
      if (stockErrors.length > 0) return;
      setValidationErrors({});
      setStep('shipping');
    } else if (step === 'shipping') {
      const fields = ['email', 'address', 'city', 'zip', 'phone'] as const;
      let valid = true;
      for (const f of fields) {
        if (!validateField(f, formData[f])) valid = false;
      }
      if (!valid) return;
      setStep('payment');
    } else if (step === 'payment') {
      if (!user) return;
      setIsProcessing(true);
      setPaymentError(null);
      try {
        await startStoreCheckout({
          firebaseUid: user.uid,
          email: formData.email,
          displayName: user.displayName || formData.email,
          phone: formData.phone,
          address: formData.address,
          city: formData.city,
          zip: formData.zip,
          items: items.map(i => ({ productId: i.id, quantity: i.quantity })),
          shippingCost: shippingFee,
        });
      } catch (err) {
        setPaymentError(err instanceof Error ? err.message : 'Payment failed. Please try again.');
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleBack = () => {
    if (step === 'shipping') setStep('cart');
    else if (step === 'payment') setStep('shipping');
  };

  const applyAddress = (s: AddressSuggestion) => {
    setFormData(prev => ({
      ...prev, address: s.addressLine,
      city: s.city || prev.city,
      zip: s.postcode || prev.zip,
    }));
    if (s.latitude && s.longitude) {
      setSelectedAddressCoords({ lat: s.latitude, lng: s.longitude, suburb: s.city || '', entered_address: s.label || s.addressLine });
    }
    setShowAddressSuggestions(false);
    setAddressSuggestions([]);
  };

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <div className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center" style={{ background: 'var(--gradient-primary)' }}>
          <LogIn className="w-7 h-7 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Sign in to checkout</h2>
        <p className="text-gray-500 text-sm mb-7">Your items are waiting — just one step away.</p>
        <button onClick={() => navigate('/auth?next=%2Fcheckout')} className="btn-primary px-8 py-3">
          Sign In to Continue
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <div className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center" style={{ background: 'var(--gradient-primary)' }}>
          <ShoppingBag className="w-7 h-7 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Your cart is empty</h2>
        <p className="text-gray-500 text-sm mb-7">Fill it with some quirkiness.</p>
        <button onClick={() => navigate('/')} className="btn-primary px-8 py-3">Browse the Store</button>
      </div>
    );
  }

  const currentStepIdx = STEPS.findIndex(s => s.id === step);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 pb-36 md:py-12 md:pb-12">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2 mb-10">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const done = i < currentStepIdx;
          const active = s.id === step;
          return (
            <div key={s.id} className="flex items-center gap-2">
              <div className={cn(
                'flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-semibold transition-all duration-300',
                active ? 'text-white shadow-md' : done ? 'text-green-600 bg-green-50' : 'text-gray-400 bg-gray-100'
              )} style={active ? { background: 'var(--gradient-primary)' } : {}}>
                {done ? <Check className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <ChevronRight className={cn('w-4 h-4', i < currentStepIdx ? 'text-green-400' : 'text-gray-200')} />
              )}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2">
          <AnimatePresence mode="wait">
            {/* CART */}
            {step === 'cart' && (
              <motion.div key="cart" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }} className="space-y-3">
                <h2 className="text-xl font-bold text-gray-900 mb-5">Your Cart</h2>

                {stockErrors.length > 0 && (
                  <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex gap-3 items-start">
                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-red-700 mb-1">Stock issue</p>
                      {stockErrors.map((e, i) => (
                        <p key={i} className="text-xs text-red-600">{e}</p>
                      ))}
                    </div>
                  </div>
                )}

                {items.map((item) => (
                  <div key={item.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-4 hover:border-gray-200 transition-colors group shadow-sm">
                    <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-gray-50 img-zoom">
                      <img src={item.imageUrl} className="w-full h-full object-cover" alt="" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm text-gray-900 truncate">{item.name}</h3>
                      <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mt-0.5">{item.category}</p>
                      <div className="flex items-center gap-3 mt-2.5">
                        <div className="flex items-center bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                          <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 text-gray-600 font-bold text-base transition-colors active:bg-gray-200">−</button>
                          <span className="w-8 text-center text-sm font-semibold text-gray-800">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 text-gray-600 font-bold text-base transition-colors active:bg-gray-200">+</button>
                        </div>
                        <button onClick={() => removeFromCart(item.id)} className="text-[10px] font-medium text-red-400 hover:text-red-600 transition-colors">Remove</button>
                      </div>
                    </div>
                    <p className="font-bold text-sm text-gray-900 flex-shrink-0">R{(item.priceRange?.min ?? item.retailPrice ?? 0) * item.quantity}</p>
                  </div>
                ))}

                {/* Upsell */}
                <div
                  className="rounded-2xl p-5 relative overflow-hidden"
                  style={{ background: 'linear-gradient(135deg,#1e1b4b,#6d28d9)' }}
                >
                  <Sparkles className="absolute top-4 right-4 w-8 h-8 text-white/10" />
                  <p className="text-[9px] font-bold uppercase tracking-widest text-purple-300 mb-1">Aura Suggestion</p>
                  <p className="text-sm font-semibold text-white">Complete the vibe with a Mystery Pack?</p>
                </div>
              </motion.div>
            )}

            {/* SHIPPING */}
            {step === 'shipping' && (
              <motion.div key="shipping" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }}>
                <h2 className="text-xl font-bold text-gray-900 mb-5">Delivery Details</h2>
                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    {([
                      { key: 'email' as const, label: 'Email Address', type: 'email', placeholder: 'you@example.com', span: 2 },
                      { key: 'address' as const, label: 'Street Address', type: 'text', placeholder: '12 Main Road, Suburb', span: 2 },
                      { key: 'city' as const, label: 'City', type: 'text', placeholder: 'Cape Town', span: 1 },
                      { key: 'zip' as const, label: 'Postal Code', type: 'text', placeholder: '8001', span: 1 },
                      { key: 'phone' as const, label: 'Phone Number', type: 'tel', placeholder: '082 000 0000', span: 2 },
                    ] as const).map(({ key, label, type, placeholder, span }) => (
                      <div key={key} className={span === 2 ? 'col-span-2' : ''}>
                        <label className="block text-xs font-medium text-gray-600 mb-1.5">{label}</label>
                        <div className="relative">
                          <input
                            type={type}
                            placeholder={placeholder}
                            value={formData[key]}
                            onFocus={() => { if (key === 'address' && addressSuggestions.length > 0) setShowAddressSuggestions(true); }}
                            onBlur={() => { if (key === 'address') window.setTimeout(() => setShowAddressSuggestions(false), 120); }}
                            onChange={(e) => {
                              setFormData(prev => ({ ...prev, [key]: e.target.value }));
                              validateField(key, e.target.value);
                              if (key === 'address') setSelectedAddressCoords(null);
                            }}
                            className={cn(
                              'input',
                              validationErrors[key] && 'input-error'
                            )}
                          />
                          {key === 'address' && showAddressSuggestions && (addressSuggestions.length > 0 || addressLoading || addressError) && (
                            <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 rounded-2xl border border-gray-100 bg-white shadow-xl overflow-hidden">
                              {addressLoading ? (
                                <div className="px-4 py-3 text-xs text-gray-400 font-medium">Finding addresses…</div>
                              ) : addressError ? (
                                <div className="px-4 py-3 text-xs text-amber-600">{addressError}</div>
                              ) : addressSuggestions.map((suggestion) => (
                                <button
                                  key={suggestion.id}
                                  type="button"
                                  onMouseDown={() => applyAddress(suggestion)}
                                  className="w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
                                >
                                  <p className="text-sm font-semibold text-gray-900">{suggestion.addressLine}</p>
                                  <p className="text-xs text-gray-400 mt-0.5">
                                    {[suggestion.city, suggestion.postcode, suggestion.province].filter(Boolean).join(' · ')}
                                  </p>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        {validationErrors[key] && (
                          <p className="text-xs text-red-500 font-medium mt-1">{validationErrors[key]}</p>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Shipping quote */}
                  <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <Truck className="w-5 h-5 text-gray-500 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-gray-800">
                        {shippingQuote?.carrier || 'The Courier Guy'} — {shippingQuote?.service || 'Economy'}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {shippingLoading
                          ? 'Calculating quote…'
                          : `${shippingQuote?.estimated_delivery || '2-4 business days'} · R${shippingFee}`
                        }
                      </p>
                    </div>
                    {shippingLoading && (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                        className="w-4 h-4 border-2 border-purple-200 border-t-purple-500 rounded-full ml-auto flex-shrink-0"
                      />
                    )}
                  </div>
                  {shippingError && (
                    <p className="text-xs text-amber-600 font-medium">{shippingError} Using standard estimate.</p>
                  )}
                </div>
              </motion.div>
            )}

            {/* PAYMENT */}
            {step === 'payment' && (
              <motion.div key="payment" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }}>
                <h2 className="text-xl font-bold text-gray-900 mb-5">Secure Payment</h2>

                {paymentError && (
                  <div className="mb-5 p-4 bg-red-50 border border-red-100 rounded-2xl flex gap-3">
                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-red-700">Payment Error</p>
                      <p className="text-xs text-red-600 mt-0.5">{paymentError}</p>
                      <button onClick={() => setPaymentError(null)} className="text-xs font-semibold text-red-600 hover:text-red-700 mt-1.5 underline">
                        Try Again
                      </button>
                    </div>
                  </div>
                )}

                <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm text-center">
                  <div
                    className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center"
                    style={{ background: 'var(--gradient-success)' }}
                  >
                    <Shield className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">Pay with Yoco</h3>
                  <p className="text-gray-500 text-sm mb-7 max-w-xs mx-auto">
                    You'll be redirected to Yoco's secure checkout. We never store your card details.
                  </p>

                  <div className="grid grid-cols-3 gap-3 mb-7">
                    {[
                      { icon: Shield, label: 'PCI Compliant', color: '#22c55e' },
                      { icon: Zap, label: 'Instant Processing', color: '#a855f7' },
                      { icon: MapPin, label: 'SA Rands (ZAR)', color: '#f472b6' },
                    ].map(({ icon: Icon, label, color }) => (
                      <div key={label} className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
                        <Icon className="w-4 h-4 mx-auto mb-1.5" style={{ color }} />
                        <p className="text-[9px] font-semibold text-gray-600 leading-tight">{label}</p>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-1.5 justify-center">
                    <Shield className="w-3.5 h-3.5 text-green-500" />
                    <p className="text-[10px] font-medium text-gray-400">256-bit encrypted · SSL secured</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Order summary sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-gray-100 p-5 sticky top-20 shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <Package className="w-4 h-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-800">Order Summary</h3>
            </div>

            <div className="space-y-2.5 mb-4">
              {items.map(item => (
                <div key={item.id} className="flex justify-between items-start gap-2 text-xs">
                  <div className="flex-1 min-w-0">
                    <span className="text-gray-700 font-medium truncate block">{item.name}</span>
                    <span className="text-gray-400">× {item.quantity}</span>
                  </div>
                  <span className="font-semibold text-gray-900 flex-shrink-0">R{(item.priceRange?.min ?? item.retailPrice ?? 0) * item.quantity}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-100 pt-4 space-y-2">
              <div className="flex justify-between text-xs text-gray-500">
                <span>Subtotal</span><span>R{subtotal}</span>
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                <span>Shipping</span>
                <span className={shippingLoading ? 'text-gray-300' : ''}>
                  {shippingLoading ? '—' : `R${shippingFee}`}
                </span>
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                <span>VAT incl. (15%)</span><span>R{vatIncluded}</span>
              </div>
              <div className="flex justify-between font-bold text-gray-900 pt-2 border-t border-gray-100">
                <span>Total</span>
                <span className="gradient-text text-base">R{orderTotal}</span>
              </div>
            </div>

            <div className="mt-5 space-y-2.5 hidden lg:block">
              <button
                onClick={handleNext}
                disabled={isProcessing || (step === 'cart' && stockErrors.length > 0)}
                className="btn-primary w-full py-3 text-sm justify-center"
              >
                {isProcessing ? (
                  <>
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} className="w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    Processing…
                  </>
                ) : step === 'payment' ? (
                  <><CreditCard className="w-4 h-4" /> Pay R{orderTotal} with Yoco</>
                ) : (
                  <>Continue <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
              {step !== 'cart' && (
                <button onClick={handleBack} className="btn-secondary w-full py-2.5 text-sm justify-center">
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile sticky footer */}
      <div className="fixed bottom-16 left-0 right-0 z-40 px-4 pb-2 lg:hidden">
        <div
          className="rounded-2xl bg-white/95 backdrop-blur-md border border-gray-100 shadow-lg px-4 py-3 flex items-center gap-3"
        >
          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400">Total</p>
            <p className="text-lg font-bold text-gray-900">R{orderTotal}</p>
          </div>
          {step !== 'cart' && (
            <button onClick={handleBack} className="btn-ghost px-3 py-2 rounded-xl border border-gray-200 text-gray-600 text-xs">
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={handleNext}
            disabled={isProcessing || (step === 'cart' && stockErrors.length > 0)}
            className="btn-primary px-5 py-2.5 text-sm flex-shrink-0 disabled:opacity-50"
          >
            {isProcessing ? (
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} className="w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
            ) : step === 'payment' ? (
              <><CreditCard className="w-4 h-4" /> Pay</>
            ) : (
              <>Next <ArrowRight className="w-4 h-4" /></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
