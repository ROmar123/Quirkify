import { useState, useEffect } from 'react';
import { useCart } from '../../context/CartContext';
import { motion, AnimatePresence } from 'motion/react';
import { CreditCard, Truck, ArrowRight, ArrowLeft, ShoppingBag, Sparkles, LogIn, Shield, Zap, MapPin, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useNavigate } from 'react-router-dom';
import { auth, onAuthStateChanged, type AuthUser } from '../../firebase';
import { startStoreCheckout } from '../../services/paymentService';
import { fetchProduct } from '../../services/productService';
import { fetchShippingQuote, type ShippingQuote } from '../../services/shippingService';
import { searchAddressSuggestions, type AddressSuggestion } from '../../services/locationService';
type CheckoutStep = 'cart' | 'shipping' | 'payment';

const STEPS = [
  { id: 'cart', label: 'Cart', icon: ShoppingBag },
  { id: 'shipping', label: 'Delivery', icon: Truck },
  { id: 'payment', label: 'Pay', icon: CreditCard },
] as const;

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
    setFormData((prev) => (
      user?.email && prev.email !== user.email
        ? { ...prev, email: user.email }
        : prev
    ));
  }, [user]);

  // Validation helpers
  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const validatePhone = (phone: string) => {
    return /^[\d\s\-\+\(\)]+$/.test(phone) && phone.replace(/\D/g, '').length >= 10;
  };

  const validateField = (key: keyof typeof formData, value: string) => {
    const errors = { ...validationErrors };

    if (!value.trim()) {
      errors[key] = 'This field is required';
    } else if (key === 'email' && !validateEmail(value)) {
      errors[key] = 'Enter a valid email address';
    } else if (key === 'phone' && !validatePhone(value)) {
      errors[key] = 'Enter a valid phone number (10+ digits)';
    } else if (key === 'zip' && value.trim().length < 3) {
      errors[key] = 'Enter a valid postal code';
    } else {
      delete errors[key];
    }

    setValidationErrors(errors);
    return !errors[key];
  };

  // Validate stock availability for cart items
  useEffect(() => {
    const validateStock = async () => {
      const errors: string[] = [];
      for (const item of items) {
        try {
          const product = await fetchProduct(item.id);
          if (product) {
            const storeAllocation = product.allocations?.store ?? 0;
            if (item.quantity > storeAllocation) {
              errors.push(`${item.name}: Only ${storeAllocation} available in stock (you want ${item.quantity})`);
            }
          } else {
            errors.push(`${item.name}: Product no longer available`);
          }
        } catch {
          errors.push(`${item.name}: Could not verify stock availability. Please try again.`);
        }
      }
      setStockErrors(errors);
    };

    if (items.length > 0) {
      validateStock();
    } else {
      setStockErrors([]);
    }
  }, [items]);

  useEffect(() => {
    let cancelled = false;

    const loadQuote = async () => {
      if (!formData.city.trim() || !formData.zip.trim()) {
        setShippingQuote(null);
        setShippingError(null);
        return;
      }

      setShippingLoading(true);
      setShippingError(null);
      try {
        const quote = await fetchShippingQuote({
          city: formData.city,
          zip: formData.zip,
        });
        if (!cancelled) {
          setShippingQuote(quote);
        }
      } catch (error) {
        if (!cancelled) {
          setShippingError(error instanceof Error ? error.message : 'Failed to load shipping quote.');
        }
      } finally {
        if (!cancelled) {
          setShippingLoading(false);
        }
      }
    };

    const timeout = window.setTimeout(() => {
      void loadQuote();
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [formData.city, formData.zip]);

  useEffect(() => {
    let cancelled = false;

    const loadSuggestions = async () => {
      const query = formData.address.trim();
      if (query.length < 4) {
        setAddressSuggestions([]);
        setAddressError(null);
        return;
      }

      setAddressLoading(true);
      setAddressError(null);
      try {
        const suggestions = await searchAddressSuggestions(query);
        if (!cancelled) {
          setAddressSuggestions(suggestions);
          setShowAddressSuggestions(true);
        }
      } catch (error) {
        if (!cancelled) {
          setAddressError(error instanceof Error ? error.message : 'Failed to load address suggestions.');
        }
      } finally {
        if (!cancelled) {
          setAddressLoading(false);
        }
      }
    };

    const timeout = window.setTimeout(() => {
      void loadSuggestions();
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [formData.address]);

  const shippingFee = shippingQuote?.price ?? 120;
  const subtotal = total;
  const vat = Math.round(subtotal * VAT_RATE);
  const orderTotal = subtotal + shippingFee + vat;

  const field = (key: keyof typeof formData) => ({
    value: formData[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, [key]: e.target.value })),
  });

  const handleNext = async () => {
    if (step === 'cart') {
      if (stockErrors.length > 0) {
        return; // Error message already displayed, don't proceed
      }
      setValidationErrors({});
      setStep('shipping');
    }
    else if (step === 'shipping') {
      // Validate all shipping fields
      const fieldsToValidate = ['email', 'address', 'city', 'zip', 'phone'] as const;
      let isValid = true;

      for (const field of fieldsToValidate) {
        const value = formData[field];
        if (!validateField(field, value)) {
          isValid = false;
        }
      }

      if (!isValid) {
        return; // Don't proceed if validation failed
      }

      setStep('payment');
    }
    else if (step === 'payment') {
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
          items: items.map(item => ({
            productId: item.id,
            quantity: item.quantity,
          })),
          shippingCost: shippingFee,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Payment processing failed. Please try again.';
        setPaymentError(errorMessage);
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleBack = () => {
    if (step === 'shipping') setStep('cart');
    else if (step === 'payment') setStep('shipping');
  };

  const applyAddressSuggestion = (suggestion: AddressSuggestion) => {
    setFormData((prev) => ({
      ...prev,
      address: suggestion.addressLine,
      city: suggestion.city || prev.city,
      zip: suggestion.postcode || prev.zip,
    }));
    setShowAddressSuggestions(false);
    setAddressSuggestions([]);
    void validateField('address', suggestion.addressLine);
    if (suggestion.city) void validateField('city', suggestion.city);
    if (suggestion.postcode) void validateField('zip', suggestion.postcode);
  };

  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-4 py-32 text-center">
        <div className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}>
          <LogIn className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-3xl font-black mb-3 gradient-text">Sign in to checkout</h2>
        <p className="text-purple-400 text-sm font-semibold mb-8">Your quirkiness needs an owner.</p>
        <button onClick={() => navigate('/auth?next=%2Fcheckout')} className="btn-primary px-10 py-4 text-base">Sign In or Create Account</button>
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
    <div className="max-w-5xl mx-auto px-4 py-8 pb-36 md:py-12 md:pb-12">
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
                {stockErrors.length > 0 && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex gap-3 items-start">
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-bold text-red-700 mb-2">Stock availability issue</p>
                      {stockErrors.map((error, i) => (
                        <p key={i} className="text-xs text-red-600 mb-1">{error}</p>
                      ))}
                    </div>
                  </div>
                )}
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
                        <div className="relative">
                          <input
                            type={type}
                            placeholder={placeholder}
                            value={formData[key]}
                            onFocus={() => {
                              if (key === 'address' && addressSuggestions.length > 0) {
                                setShowAddressSuggestions(true);
                              }
                            }}
                            onBlur={() => {
                              if (key === 'address') {
                                window.setTimeout(() => setShowAddressSuggestions(false), 120);
                              }
                            }}
                            onChange={(e) => {
                              setFormData(prev => ({ ...prev, [key]: e.target.value }));
                              validateField(key, e.target.value);
                            }}
                            className={cn(
                              'w-full p-3 rounded-2xl text-sm font-semibold transition-colors focus:outline-none',
                              validationErrors[key]
                                ? 'bg-red-50 border-2 border-red-300 text-purple-800 focus:border-red-400'
                                : 'bg-purple-50 border-2 border-purple-100 text-purple-800 focus:border-purple-400'
                            )}
                          />
                          {key === 'address' && showAddressSuggestions && (addressSuggestions.length > 0 || addressLoading || addressError) && (
                            <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 rounded-3xl border border-purple-100 bg-white p-2 shadow-[0_20px_60px_rgba(168,85,247,0.16)]">
                              {addressLoading ? (
                                <div className="px-4 py-3 text-xs font-bold text-purple-400">Finding addresses...</div>
                              ) : addressError ? (
                                <div className="px-4 py-3 text-xs font-bold text-amber-600">{addressError}</div>
                              ) : (
                                addressSuggestions.map((suggestion) => (
                                  <button
                                    key={suggestion.id}
                                    type="button"
                                    onMouseDown={() => applyAddressSuggestion(suggestion)}
                                    className="w-full rounded-2xl px-4 py-3 text-left hover:bg-purple-50 transition-colors"
                                  >
                                    <p className="text-sm font-black text-purple-900">{suggestion.addressLine}</p>
                                    <p className="text-[11px] font-semibold text-purple-400">{[suggestion.city, suggestion.postcode, suggestion.province].filter(Boolean).join(' · ')}</p>
                                  </button>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                        {validationErrors[key] && (
                          <p className="text-xs text-red-600 font-bold mt-1">{validationErrors[key]}</p>
                        )}
                        {key === 'address' && !validationErrors.address && (
                          <p className="text-[11px] font-bold text-purple-300 mt-1">
                            Start typing for address suggestions.
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-3 p-4 bg-purple-50 rounded-2xl border border-purple-100 mt-6">
                    <Truck className="w-5 h-5 text-purple-500 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-purple-700">
                        {shippingQuote?.carrier || 'The Courier Guy'} — {shippingQuote?.service || 'Economy'}
                      </p>
                      <p className="text-[9px] font-bold text-purple-400">
                        {shippingLoading
                          ? 'Refreshing delivery quote...'
                          : `${shippingQuote?.estimated_delivery || '2-4 business days'} · R${shippingFee}`}
                      </p>
                      {shippingQuote && (
                        <p className="text-[9px] font-bold text-purple-300 mt-1 uppercase tracking-wide">
                          {shippingQuote.zone} delivery lane
                        </p>
                      )}
                    </div>
                  </div>
                  {shippingError && (
                    <p className="text-xs font-bold text-amber-600 mt-3">
                      {shippingError} Using the standard delivery estimate for now.
                    </p>
                  )}
                </div>
              </motion.div>
            )}

            {/* PAYMENT */}
            {step === 'payment' && (
              <motion.div key="payment" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                <h2 className="text-2xl font-black gradient-text mb-6">Secure Payment</h2>

                {paymentError && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex gap-3 items-start">
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-bold text-red-700">Payment Error</p>
                      <p className="text-xs text-red-600 mt-1">{paymentError}</p>
                      <button
                        onClick={() => setPaymentError(null)}
                        className="text-xs font-bold text-red-600 hover:text-red-700 mt-2 underline"
                      >
                        Try Again
                      </button>
                    </div>
                  </div>
                )}

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
                    <Shield className="w-4 h-4 text-green-500" />
                    <p className="text-[10px] font-bold text-purple-400">256-bit encrypted · SSL secured</p>
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
                <span>Shipping</span><span>R{shippingFee}</span>
              </div>
              <div className="flex justify-between text-xs font-semibold text-purple-500">
                <span>VAT (15%)</span><span>R{vat}</span>
              </div>
              <div className="flex justify-between text-base font-black pt-2 border-t border-purple-100">
                <span>Total</span>
                <span className="gradient-text">R{orderTotal}</span>
              </div>
            </div>

            <div className="mt-6 space-y-3 hidden lg:block">
              <button
                onClick={handleNext}
                disabled={isProcessing || (step === 'cart' && stockErrors.length > 0)}
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

      {/* Mobile sticky CTA — always visible above mobile nav */}
      <div className="fixed bottom-[4.5rem] left-0 right-0 z-40 px-4 pb-2 lg:hidden">
        <div className="rounded-3xl bg-white/95 backdrop-blur-md border border-purple-100 shadow-[0_-8px_40px_rgba(168,85,247,0.15)] px-4 py-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.22em] text-purple-300">Order total</p>
            <p className="text-lg font-black text-purple-900">R{orderTotal}</p>
          </div>
          {step !== 'cart' && (
            <button onClick={handleBack} className="flex items-center gap-1 px-3 py-2.5 rounded-2xl border-2 border-purple-200 text-purple-600 text-xs font-black">
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={handleNext}
            disabled={isProcessing || (step === 'cart' && stockErrors.length > 0)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-white text-sm font-black disabled:opacity-50 flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}
          >
            {isProcessing ? (
              <>
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                Processing...
              </>
            ) : step === 'payment' ? (
              <><CreditCard className="w-4 h-4" /> Pay with Yoco</>
            ) : (
              <>Next <ArrowRight className="w-4 h-4" /></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
