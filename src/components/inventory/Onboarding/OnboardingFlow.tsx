import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, ArrowLeft, Upload, AlertCircle } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { auth } from '../../../firebase';
import { Product, ProductCondition } from '../../../types';
import { createProduct } from '../../../services/productService';
import AIIntake, { AIIntakeResult } from './AIIntake';
import ManualEntry from './ManualEntry';

type Step = 'entry' | 'intake' | 'manual' | 'review' | 'confirmation';

interface OnboardingFlowProps {
  onComplete?: () => void;
}

const CATEGORIES = ['Sneakers', 'Clothing', 'Accessories', 'Electronics', 'Collectibles', 'Other'];

const UNIQUE_STEPS = ['entry', 'intake', 'review', 'confirmation'] as const;
const STEP_LABELS: Record<string, string> = {
  entry: 'Method',
  intake: 'Add Product',
  review: 'Review',
  confirmation: 'Done',
};

export default function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [currentStep, setCurrentStep] = useState<Step>('entry');
  const [productData, setProductData] = useState<Partial<Product> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [intakeMethod, setIntakeMethod] = useState<'intake' | 'manual'>('intake');

  const displayStep = currentStep === 'manual' ? 'intake' : currentStep;
  const displayStepIndex = UNIQUE_STEPS.indexOf(displayStep as typeof UNIQUE_STEPS[number]);

  const handleIntakeComplete = (data: AIIntakeResult, method: 'intake' | 'manual') => {
    setIntakeMethod(method);
    setProductData({
      ...data,
      allocations: { store: data.stock, auction: 0, packs: 0 },
      status: 'pending',
      listingType: 'store',
    });
    setCurrentStep('review');
  };

  const handleSaveProduct = async (finalData: Partial<Product> | null) => {
    if (!finalData) { setError('Product data is missing'); return; }
    if (!auth.currentUser) { setError('Not logged in'); return; }
    setError(null);

    const errors: string[] = [];
    if (!finalData.name?.trim()) errors.push('Product name is required');
    if (!finalData.description?.trim()) errors.push('Description is required');
    if (!finalData.category?.trim()) errors.push('Category is required');
    if (!finalData.condition) errors.push('Condition is required');
    if (!finalData.retailPrice || finalData.retailPrice <= 0) errors.push('Retail price must be greater than 0');
    if (finalData.markdownPercentage === undefined && finalData.markdownPercentage !== 0) errors.push('Markdown % is required');
    if (!finalData.stock || finalData.stock <= 0) errors.push('Stock must be greater than 0');
    if (!finalData.imageUrl) errors.push('Product image is required');

    if (errors.length > 0) { setError(errors.join(' · ')); return; }

    setSaving(true);
    try {
      await createProduct({
        name: finalData.name!.trim(),
        description: finalData.description!.trim(),
        category: finalData.category!.trim(),
        condition: finalData.condition!,
        retailPrice: finalData.retailPrice!,
        markdownPercentage: Math.max(0, Math.min(100, finalData.markdownPercentage!)),
        stock: finalData.stock!,
        allocations: {
          store: Math.min(finalData.stock!, finalData.allocations?.store ?? finalData.stock!),
          auction: finalData.allocations?.auction ?? 0,
          packs: finalData.allocations?.packs ?? 0,
        },
        imageUrl: finalData.imageUrl!,
        imageUrls: finalData.imageUrls || [finalData.imageUrl!],
        confidenceScore: finalData.confidenceScore ?? 0,
        rarity: finalData.rarity,
        stats: finalData.stats,
        priceRange: finalData.priceRange,
        authorUid: auth.currentUser!.uid,
        listingType: 'store',
      });
      setCurrentStep('confirmation');
    } catch (err: any) {
      const message = err.message || err.toString();
      setError(message.length > 200 ? `${message.substring(0, 200)}…` : message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Progress indicator */}
      {currentStep !== 'confirmation' && (
        <div className="flex items-center gap-2">
          {UNIQUE_STEPS.map((step, idx) => {
            const done = idx < displayStepIndex;
            const active = step === displayStep;
            return (
              <div key={step} className="flex items-center gap-2 flex-1">
                <div className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all',
                  done ? 'bg-green-500 text-white' :
                  active ? 'bg-gradient-to-br from-pink-500 to-purple-600 text-white ring-2 ring-purple-200 ring-offset-1' :
                  'bg-gray-100 text-gray-400'
                )}>
                  {done ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                </div>
                <span className={cn(
                  'text-xs font-medium hidden sm:block',
                  active ? 'text-gray-800' : done ? 'text-green-600' : 'text-gray-400'
                )}>
                  {STEP_LABELS[step]}
                </span>
                {idx < UNIQUE_STEPS.length - 1 && (
                  <div className={cn('flex-1 h-px', done ? 'bg-green-300' : 'bg-gray-100')} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Step content */}
      <AnimatePresence mode="wait">
        {/* Entry */}
        {currentStep === 'entry' && (
          <motion.div key="entry" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.25 }}>
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Add a product</h2>
                <p className="text-gray-500 text-sm mt-1">Choose how to create your listing</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* AI Option */}
                <motion.button
                  whileHover={{ y: -3, boxShadow: '0 8px 24px rgba(168,85,247,0.12)' }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setCurrentStep('intake')}
                  className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:border-gray-200 transition-all text-left shadow-sm group"
                >
                  <div className="h-1 bg-gradient-to-r from-pink-500 to-purple-600" />
                  <div className="p-6">
                    <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                      <Upload className="w-6 h-6 text-purple-500" />
                    </div>
                    <h3 className="text-base font-bold text-gray-900 mb-1">AI Intake</h3>
                    <p className="text-gray-500 text-sm leading-relaxed">Upload photos and let AI analyse product details instantly</p>
                    <div className="mt-4 inline-flex items-center text-sm font-semibold text-quirky">
                      Get started →
                    </div>
                  </div>
                </motion.button>

                {/* Manual Option */}
                <motion.button
                  whileHover={{ y: -3, boxShadow: '0 8px 24px rgba(0,0,0,0.06)' }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setCurrentStep('manual')}
                  className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:border-gray-200 transition-all text-left shadow-sm group"
                >
                  <div className="h-1 bg-gradient-to-r from-amber-400 to-orange-500" />
                  <div className="p-6">
                    <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform border border-gray-100">
                      <Upload className="w-5 h-5 text-amber-500" />
                    </div>
                    <h3 className="text-base font-bold text-gray-900 mb-1">Manual Entry</h3>
                    <p className="text-gray-500 text-sm leading-relaxed">Enter product details, pricing and photos yourself</p>
                    <div className="mt-4 inline-flex items-center text-sm font-semibold text-amber-600">
                      Get started →
                    </div>
                  </div>
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}

        {/* AI Intake */}
        {currentStep === 'intake' && (
          <motion.div key="intake" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.25 }}>
            <AIIntake onComplete={(data) => handleIntakeComplete(data, 'intake')} onCancel={() => setCurrentStep('entry')} />
          </motion.div>
        )}

        {/* Manual Entry */}
        {currentStep === 'manual' && (
          <motion.div key="manual" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.25 }}>
            <ManualEntry onComplete={(data) => handleIntakeComplete(data, 'manual')} onCancel={() => setCurrentStep('entry')} />
          </motion.div>
        )}

        {/* Review */}
        {currentStep === 'review' && productData && (
          <motion.div key="review" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.25 }}>
            <div className="space-y-5 max-w-2xl">
              <div className="flex items-center gap-3">
                <button onClick={() => setCurrentStep(intakeMethod)} className="btn-secondary p-2">
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Review &amp; confirm</h2>
                  <p className="text-gray-400 text-sm">Make any last edits before saving</p>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-pink-500 to-purple-600" />
                <div className="p-6 space-y-5">
                  <div>
                    <label className="section-label block mb-1.5">PRODUCT NAME *</label>
                    <input type="text" value={productData.name || ''} onChange={e => setProductData({ ...productData, name: e.target.value })} className="input" />
                  </div>

                  <div>
                    <label className="section-label block mb-1.5">DESCRIPTION *</label>
                    <textarea value={productData.description || ''} onChange={e => setProductData({ ...productData, description: e.target.value })} rows={3} className="input resize-none" />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="section-label block mb-1.5">CATEGORY *</label>
                      <select value={productData.category || ''} onChange={e => setProductData({ ...productData, category: e.target.value })} className="input">
                        <option value="">Select…</option>
                        {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="section-label block mb-1.5">CONDITION *</label>
                      <select value={productData.condition || 'New'} onChange={e => setProductData({ ...productData, condition: e.target.value as ProductCondition })} className="input">
                        {['New', 'Like New', 'Pre-owned', 'Refurbished'].map(c => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="section-label block mb-1.5">RETAIL PRICE *</label>
                      <input type="number" value={productData.retailPrice || ''} onChange={e => {
                        const retail = parseFloat(e.target.value) || 0;
                        const markdown = productData.markdownPercentage ?? 0;
                        setProductData({ ...productData, retailPrice: retail, discountPrice: Math.round(retail * (1 - markdown / 100)) });
                      }} className="input" placeholder="0" min="0" />
                    </div>
                    <div>
                      <label className="section-label block mb-1.5">MARKDOWN %</label>
                      <input type="number" value={productData.markdownPercentage ?? 0} onChange={e => {
                        const markdown = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0));
                        const retail = productData.retailPrice || 0;
                        setProductData({ ...productData, markdownPercentage: markdown, discountPrice: Math.round(retail * (1 - markdown / 100)) });
                      }} className="input" placeholder="0" min="0" max="100" />
                    </div>
                    <div>
                      <label className="section-label block mb-1.5">SALE PRICE</label>
                      <div className={`input font-bold flex items-center ${(productData.discountPrice || 0) > 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'text-gray-400'}`}>
                        R{productData.discountPrice || 0}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="section-label block mb-1.5">TOTAL STOCK *</label>
                    <input type="number" min="1" value={productData.stock || ''} onChange={e => {
                      const stock = parseInt(e.target.value) || 1;
                      setProductData({ ...productData, stock, allocations: { store: stock, auction: 0, packs: 0 } });
                    }} className="input" />
                  </div>

                  {error && (
                    <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3">
                      <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                      <p className="text-red-700 text-sm">{error}</p>
                    </div>
                  )}

                  <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
                    <button onClick={() => setCurrentStep(intakeMethod)} className="btn-secondary flex-1">Back</button>
                    <button onClick={() => handleSaveProduct(productData)} disabled={saving} className="btn-primary flex-1 disabled:opacity-60">
                      {saving ? 'Saving…' : 'Save Product'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Confirmation */}
        {currentStep === 'confirmation' && (
          <motion.div key="confirmation" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            <div className="max-w-sm mx-auto text-center space-y-6 py-8">
              <motion.div
                initial={{ scale: 0, rotate: -90 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.1 }}
                className="w-16 h-16 rounded-2xl bg-green-500 flex items-center justify-center mx-auto shadow-lg"
              >
                <Check className="w-8 h-8 text-white" />
              </motion.div>

              <div>
                <h2 className="text-2xl font-bold text-gray-900">Product saved!</h2>
                <p className="text-gray-500 text-sm mt-2 leading-relaxed">
                  <strong className="text-gray-800">{productData?.name}</strong> has been added to your inventory and queued for approval.
                </p>
              </div>

              {productData?.imageUrl && (
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                  <img src={productData.imageUrl} className="w-full h-36 object-cover" alt="" />
                  <div className="p-4 text-left">
                    <p className="text-sm font-semibold text-gray-900">{productData.name}</p>
                    <p className="text-xs text-amber-600 font-medium mt-0.5">Pending review</p>
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                <button onClick={() => onComplete?.()} className="btn-secondary flex-1">Done</button>
                <button onClick={() => { setCurrentStep('entry'); setProductData(null); setError(null); }} className="btn-primary flex-1">
                  Add another
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
