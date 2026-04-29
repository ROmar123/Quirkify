import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Package, Truck, CreditCard, ArrowRight, Loader2, AlertCircle, Sparkles, Shield } from 'lucide-react';
import { cn } from '../../lib/utils';
import { auth, onAuthStateChanged, type AuthUser } from '../../firebase';
import { startPackCheckout } from '../../services/paymentService';
import type { Pack } from '../../types';

interface Props {
  pack: Pack;
  onClose: () => void;
}

type Step = 'details' | 'shipping' | 'paying';

const RARITY_COLORS: Record<string, string> = {
  Common: 'text-zinc-500',
  Limited: 'text-blue-600',
  Rare: 'text-purple-600',
  'Super Rare': 'text-pink-600',
  Unique: 'text-amber-600',
};

function RarityBar({ label, prob, color }: { label: string; prob: number; color: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={cn('w-20 font-semibold text-right flex-shrink-0', color)}>{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
        <div
          className="h-1.5 rounded-full bg-current transition-all"
          style={{ width: `${prob}%`, color: 'currentColor' }}
        />
      </div>
      <span className="w-8 text-gray-400 font-mono">{prob}%</span>
    </div>
  );
}

export default function PackBuyModal({ pack, onClose }: Props) {
  const [user, setUser] = useState<AuthUser | null>(auth.currentUser);
  const [step, setStep] = useState<Step>('details');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ phone: '', address: '', city: '', zip: '' });
  const [formErrors, setFormErrors] = useState<Partial<typeof form>>({});

  const name = pack.title || pack.name || 'Mystery Pack';
  const img = pack.heroImage || pack.imageUrl;
  const remaining = typeof pack.packsRemaining === 'number'
    ? pack.packsRemaining
    : (pack.totalPacks ?? 0) - (pack.packsSold ?? 0);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  // Trap keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const validate = () => {
    const errs: Partial<typeof form> = {};
    if (!form.phone.trim()) errs.phone = 'Required';
    if (!form.address.trim()) errs.address = 'Required';
    if (!form.city.trim()) errs.city = 'Required';
    if (!form.zip.trim()) errs.zip = 'Required';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleShippingNext = () => {
    if (validate()) setStep('paying');
  };

  const handlePay = async () => {
    if (!user) { setError('Please sign in first.'); return; }
    setProcessing(true);
    setError(null);
    try {
      await startPackCheckout({
        firebaseUid: user.uid,
        email: user.email || '',
        displayName: user.displayName,
        phone: form.phone,
        address: form.address,
        city: form.city,
        zip: form.zip,
        packId: pack.id,
        quantity: 1,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed. Please try again.');
      setProcessing(false);
    }
  };

  const rarities = [
    { label: 'Common', prob: pack.probCommon ?? pack.prob_common ?? 50, color: RARITY_COLORS['Common'] },
    { label: 'Limited', prob: pack.probLimited ?? pack.prob_limited ?? 25, color: RARITY_COLORS['Limited'] },
    { label: 'Rare', prob: pack.probRare ?? pack.prob_rare ?? 15, color: RARITY_COLORS['Rare'] },
    { label: 'Super Rare', prob: pack.probSuperRare ?? pack.prob_super_rare ?? 8, color: RARITY_COLORS['Super Rare'] },
    { label: 'Unique', prob: pack.probUnique ?? pack.prob_unique ?? 2, color: RARITY_COLORS['Unique'] },
  ];

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 8 }}
          className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="relative p-6 pb-0">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4 text-gray-600" />
            </button>
          </div>

          <div className="px-6 pb-6 space-y-5 max-h-[85vh] overflow-y-auto">
            {/* Pack preview */}
            <div className="flex gap-4 items-start">
              <div className="w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0 bg-gradient-to-br from-teal-50 to-cyan-50 flex items-center justify-center">
                {img ? (
                  <img src={img} alt={name} className="w-full h-full object-cover" />
                ) : (
                  <Package className="w-8 h-8 text-teal-300" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-3.5 h-3.5 text-teal-500" />
                  <span className="text-[10px] font-bold text-teal-600 uppercase tracking-wide">Mystery Pack</span>
                </div>
                <h2 className="text-lg font-bold text-gray-900 leading-tight">{name}</h2>
                <p className="text-2xl font-black text-teal-600 mt-0.5">R{pack.price}</p>
                {remaining !== null && remaining > 0 && (
                  <p className="text-xs text-gray-400 mt-0.5">{remaining} pack{remaining !== 1 ? 's' : ''} left</p>
                )}
              </div>
            </div>

            {/* Step: details */}
            {step === 'details' && (
              <div className="space-y-4">
                {pack.description && (
                  <p className="text-sm text-gray-600 leading-relaxed">{pack.description}</p>
                )}

                <div className="bg-gray-50 rounded-2xl p-4 space-y-2.5">
                  <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">Pull Rates</p>
                  {rarities.map((r) => (
                    <RarityBar key={r.label} label={r.label} prob={r.prob} color={r.color} />
                  ))}
                </div>

                <div className="flex items-start gap-2.5 p-3 bg-teal-50 rounded-xl border border-teal-100">
                  <Shield className="w-4 h-4 text-teal-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-teal-700 leading-relaxed">
                    Pack contents are revealed immediately after payment. Each pack contains{' '}
                    <strong>{pack.itemCount ?? pack.item_count ?? 1}</strong>{' '}
                    item{(pack.itemCount ?? pack.item_count ?? 1) !== 1 ? 's' : ''} drawn
                    using the rarity weights above.
                  </p>
                </div>

                {!user && (
                  <div className="flex items-center gap-2.5 p-3 bg-amber-50 rounded-xl border border-amber-100">
                    <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <p className="text-xs text-amber-700">Please sign in to purchase this pack.</p>
                  </div>
                )}

                <button
                  onClick={() => setStep('shipping')}
                  disabled={!user}
                  className="w-full btn-primary py-3 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>Buy Pack · R{pack.price}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Step: shipping */}
            {step === 'shipping' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <Truck className="w-4 h-4 text-teal-500" />
                  Delivery Details
                </div>

                <div className="space-y-3">
                  {([
                    { key: 'phone', label: 'Phone Number', placeholder: '0XX XXX XXXX', type: 'tel' },
                    { key: 'address', label: 'Street Address', placeholder: '12 Example Street', type: 'text' },
                    { key: 'city', label: 'City', placeholder: 'Cape Town', type: 'text' },
                    { key: 'zip', label: 'Postal Code', placeholder: '8001', type: 'text' },
                  ] as const).map(({ key, label, placeholder, type }) => (
                    <div key={key}>
                      <label className="text-xs font-semibold text-gray-600 block mb-1">{label}</label>
                      <input
                        type={type}
                        value={form[key]}
                        onChange={(e) => {
                          setForm((f) => ({ ...f, [key]: e.target.value }));
                          if (formErrors[key]) setFormErrors((fe) => ({ ...fe, [key]: undefined }));
                        }}
                        placeholder={placeholder}
                        className={cn(
                          'w-full input text-sm',
                          formErrors[key] && 'border-red-300 focus:ring-red-200'
                        )}
                      />
                      {formErrors[key] && (
                        <p className="text-xs text-red-500 mt-0.5">{formErrors[key]}</p>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep('details')}
                    className="flex-1 py-2.5 rounded-full border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleShippingNext}
                    className="flex-1 btn-primary py-2.5 flex items-center justify-center gap-2"
                  >
                    Continue <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Step: paying */}
            {step === 'paying' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <CreditCard className="w-4 h-4 text-teal-500" />
                  Confirm & Pay
                </div>

                <div className="bg-gray-50 rounded-2xl p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Pack</span>
                    <span className="font-semibold">R{pack.price}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Delivery</span>
                    <span className="font-semibold text-gray-400">Calculated at payment</span>
                  </div>
                  <div className="border-t border-gray-200 pt-2 flex justify-between font-bold">
                    <span>Total</span>
                    <span className="text-teal-600">R{pack.price}+</span>
                  </div>
                </div>

                {error && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 rounded-xl border border-red-100 text-sm text-red-700">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    {error}
                  </div>
                )}

                <div className="flex items-center gap-2.5 p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <Shield className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <p className="text-xs text-gray-500">
                    You will be redirected to Yoco's secure payment page. Pack contents are revealed
                    automatically after payment confirmation.
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep('shipping')}
                    disabled={processing}
                    className="flex-1 py-2.5 rounded-full border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => void handlePay()}
                    disabled={processing}
                    className="flex-1 btn-primary py-2.5 flex items-center justify-center gap-2 disabled:opacity-70"
                  >
                    {processing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Redirecting…</span>
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-4 h-4" />
                        <span>Pay with Yoco</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
