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

const STEPS: { id: Step; label: string; number: number }[] = [
  { id: 'entry', label: 'Select Method', number: 1 },
  { id: 'intake', label: 'Add Product', number: 2 },
  { id: 'manual', label: 'Add Product', number: 2 },
  { id: 'review', label: 'Review Details', number: 3 },
  { id: 'confirmation', label: 'Complete', number: 4 },
];

export default function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [currentStep, setCurrentStep] = useState<Step>('entry');
  const [productData, setProductData] = useState<Partial<Product> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Track which intake method was used so Back works correctly
  const [intakeMethod, setIntakeMethod] = useState<'intake' | 'manual'>('intake');

  // For progress display, treat intake and manual as same step
  const displayStep = currentStep === 'manual' ? 'intake' : currentStep;
  const displayStepIndex = STEPS.findIndex(s => s.id === displayStep);

  const handleIntakeComplete = (data: AIIntakeResult, method: 'intake' | 'manual') => {
    setIntakeMethod(method);
    setProductData({
      ...data,
      allocations: {
        store: data.stock,
        auction: 0,
        packs: 0,
      },
      status: 'pending',
      listingType: 'store',
    });
    setCurrentStep('review');
  };

  const handleSaveProduct = async (finalData: Partial<Product> | null) => {
    if (!finalData) {
      setError('Product data is missing');
      return;
    }

    if (!auth.currentUser) {
      setError('Not logged in');
      return;
    }

    setError(null);

    // Validate required fields
    const errors: string[] = [];
    if (!finalData.name?.trim()) errors.push('Product name is required');
    if (!finalData.description?.trim()) errors.push('Description is required');
    if (!finalData.category?.trim()) errors.push('Category is required');
    if (!finalData.condition) errors.push('Condition is required');
    if (!finalData.retailPrice || finalData.retailPrice <= 0) errors.push('Retail price must be greater than 0');
    if (!finalData.markdownPercentage && finalData.markdownPercentage !== 0) errors.push('Markdown percentage is required');
    if (!finalData.stock || finalData.stock <= 0) errors.push('Stock must be greater than 0');
    if (!finalData.imageUrl) errors.push('Product image is required');

    if (errors.length > 0) {
      setError(errors.join(' · '));
      return;
    }

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
        authorUid: auth.currentUser.uid,
        listingType: 'store',
      });

      setCurrentStep('confirmation');
    } catch (err: any) {
      const message = err.message || err.toString();
      setError(message.length > 200 ? `${message.substring(0, 200)}...` : message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 flex flex-col">
      {/* Sticky Header with Progress */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-purple-100 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <h1 className="text-2xl sm:text-3xl font-black gradient-text mb-6">Add New Product</h1>

          {/* Progress Steps */}
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            {STEPS.filter((s, i) => i === 0 || (i > 0 && STEPS[i - 1].label !== STEPS[i].label)).map((step, idx) => {
              const stepDone = (step.id === 'entry' && displayStepIndex > 0) ||
                              (step.id === 'intake' && displayStepIndex > 1) ||
                              (step.id === 'review' && displayStepIndex > 2) ||
                              (step.id === 'confirmation' && displayStepIndex > 3);
              const active = step.id === displayStep;
              return (
                <div key={step.id} className="flex-1 flex items-center">
                  <motion.div
                    animate={{ scale: active ? 1.1 : 1 }}
                    className={cn(
                      'w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center font-bold text-sm sm:text-base transition-all flex-shrink-0 shadow-sm',
                      stepDone ? 'bg-gradient-to-br from-green-400 to-green-600 text-white' :
                      active ? 'bg-gradient-to-br from-pink-500 to-purple-600 text-white ring-4 ring-purple-200' :
                      'bg-white text-purple-400 border-2 border-purple-100'
                    )}
                  >
                    {stepDone ? <Check className="w-5 h-5 sm:w-6 sm:h-6" /> : step.number}
                  </motion.div>

                  {idx < 3 && (
                    <div className="hidden sm:block flex-1 h-1 mx-3" style={{
                      background: stepDone ? 'linear-gradient(to right, #22C55E, #16A34A)' : 'rgb(229, 231, 235)'
                    }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 max-w-4xl w-full mx-auto px-4 py-12">
        <AnimatePresence mode="wait">
          {/* Entry Point */}
          {currentStep === 'entry' && (
            <motion.div key="entry" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
              <div className="space-y-8">
                <div className="text-center">
                  <p className="text-purple-600 text-sm font-bold uppercase tracking-widest mb-2">Quick Start</p>
                  <h2 className="text-3xl sm:text-4xl font-black text-purple-900 mb-3">Choose how to add products</h2>
                  <p className="text-purple-400 text-base max-w-2xl mx-auto">Get your inventory online in seconds with AI-powered analysis</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* AI Option */}
                  <motion.button
                    whileHover={{ y: -8, boxShadow: '0 20px 40px rgba(168, 85, 247, 0.2)' }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setCurrentStep('intake')}
                    className="group bg-white rounded-3xl border-2 border-purple-100 overflow-hidden hover:border-purple-300 transition-all shadow-sm"
                  >
                    <div className="h-2 bg-gradient-to-r from-pink-500 to-purple-600" />
                    <div className="p-8 sm:p-10">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-100 to-purple-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <Upload className="w-7 h-7 text-purple-600" />
                      </div>
                      <h3 className="text-xl sm:text-2xl font-black text-purple-900 mb-2">AI Intake</h3>
                      <p className="text-purple-600 text-sm font-semibold mb-6">Upload photos and let AI analyze the product details instantly</p>
                      <div className="inline-block px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white text-sm font-bold rounded-full">
                        Get Started
                      </div>
                    </div>
                  </motion.button>

                  {/* Manual Option */}
                  <motion.button
                    whileHover={{ y: -8, boxShadow: '0 20px 40px rgba(168, 85, 247, 0.2)' }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setCurrentStep('manual')}
                    className="group bg-white rounded-3xl border-2 border-purple-100 overflow-hidden hover:border-purple-300 transition-all shadow-sm"
                  >
                    <div className="h-2 bg-gradient-to-r from-amber-500 to-orange-600" />
                    <div className="p-8 sm:p-10">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <span className="text-2xl">✍️</span>
                      </div>
                      <h3 className="text-xl sm:text-2xl font-black text-purple-900 mb-2">Manual Entry</h3>
                      <p className="text-purple-600 text-sm font-semibold mb-6">Enter product details manually without AI analysis</p>
                      <div className="inline-block px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white text-sm font-bold rounded-full">
                        Get Started
                      </div>
                    </div>
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}

          {/* AI Intake */}
          {currentStep === 'intake' && (
            <motion.div key="intake" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
              <AIIntake
                onComplete={(data) => handleIntakeComplete(data, 'intake')}
                onCancel={() => setCurrentStep('entry')}
              />
            </motion.div>
          )}

          {/* Manual Entry */}
          {currentStep === 'manual' && (
            <motion.div key="manual" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
              <ManualEntry
                onComplete={(data) => handleIntakeComplete(data, 'manual')}
                onCancel={() => setCurrentStep('entry')}
              />
            </motion.div>
          )}

          {/* Review */}
          {currentStep === 'review' && productData && (
            <motion.div key="review" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
              <div className="space-y-8 max-w-2xl mx-auto">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setCurrentStep(intakeMethod)}
                    className="p-2 hover:bg-purple-100 rounded-xl transition-colors"
                  >
                    <ArrowLeft className="w-5 h-5 text-purple-600" />
                  </button>
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-black text-purple-900">Review & Edit</h2>
                    <p className="text-purple-400 text-sm font-semibold mt-1">Fix any details before saving</p>
                  </div>
                </div>

                <div className="bg-white rounded-3xl border-2 border-purple-100 overflow-hidden shadow-sm">
                  <div className="h-2 bg-gradient-to-r from-pink-500 to-purple-600" />
                  <div className="p-6 sm:p-8 space-y-6">
                    {/* Name */}
                    <div>
                      <label className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-2 block">PRODUCT NAME *</label>
                      <input
                        type="text"
                        value={productData.name || ''}
                        onChange={(e) => setProductData({ ...productData, name: e.target.value })}
                        className="w-full px-4 py-2.5 bg-purple-50 border-2 border-purple-100 rounded-2xl text-sm font-semibold text-purple-900 focus:outline-none focus:border-purple-400"
                      />
                    </div>

                    {/* Description */}
                    <div>
                      <label className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-2 block">DESCRIPTION *</label>
                      <textarea
                        value={productData.description || ''}
                        onChange={(e) => setProductData({ ...productData, description: e.target.value })}
                        rows={3}
                        className="w-full px-4 py-2.5 bg-purple-50 border-2 border-purple-100 rounded-2xl text-sm font-semibold text-purple-900 focus:outline-none focus:border-purple-400"
                      />
                    </div>

                    {/* Category & Condition */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-2 block">CATEGORY *</label>
                        <select
                          value={productData.category || ''}
                          onChange={(e) => setProductData({ ...productData, category: e.target.value })}
                          className="w-full px-4 py-2.5 bg-purple-50 border-2 border-purple-100 rounded-2xl text-sm font-semibold text-purple-900 focus:outline-none focus:border-purple-400"
                        >
                          <option value="">Select...</option>
                          {CATEGORIES.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-2 block">CONDITION *</label>
                        <select
                          value={productData.condition || 'New'}
                          onChange={(e) => setProductData({ ...productData, condition: e.target.value as ProductCondition })}
                          className="w-full px-4 py-2.5 bg-purple-50 border-2 border-purple-100 rounded-2xl text-sm font-semibold text-purple-900 focus:outline-none focus:border-purple-400"
                        >
                          <option>New</option>
                          <option>Like New</option>
                          <option>Pre-owned</option>
                          <option>Refurbished</option>
                        </select>
                      </div>
                    </div>

                    {/* Pricing */}
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-2 block">RETAIL PRICE *</label>
                        <input
                          type="number"
                          value={productData.retailPrice || ''}
                          onChange={(e) => {
                            const retail = parseFloat(e.target.value) || 0;
                            const markdown = productData.markdownPercentage ?? 40;
                            setProductData({
                              ...productData,
                              retailPrice: retail,
                              discountPrice: Math.round(retail * (1 - markdown / 100)),
                            });
                          }}
                          className="w-full px-4 py-2.5 bg-purple-50 border-2 border-purple-100 rounded-2xl text-sm font-semibold text-purple-900 focus:outline-none focus:border-purple-400"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-2 block">MARKDOWN %</label>
                        <input
                          type="number"
                          value={productData.markdownPercentage ?? 40}
                          onChange={(e) => {
                            const markdown = parseFloat(e.target.value) || 0;
                            const retail = productData.retailPrice || 0;
                            setProductData({
                              ...productData,
                              markdownPercentage: markdown,
                              discountPrice: Math.round(retail * (1 - markdown / 100)),
                            });
                          }}
                          className="w-full px-4 py-2.5 bg-purple-50 border-2 border-purple-100 rounded-2xl text-sm font-semibold text-purple-900 focus:outline-none focus:border-purple-400"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-2 block">SALE PRICE</label>
                        <div className="w-full px-4 py-2.5 bg-green-50 border-2 border-green-200 rounded-2xl text-sm font-black text-green-700">
                          R{productData.discountPrice || 0}
                        </div>
                      </div>
                    </div>

                    {/* Stock */}
                    <div>
                      <label className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-2 block">TOTAL STOCK *</label>
                      <input
                        type="number"
                        min="1"
                        value={productData.stock || ''}
                        onChange={(e) => {
                          const stock = parseInt(e.target.value) || 1;
                          setProductData({
                            ...productData,
                            stock,
                            allocations: { store: stock, auction: 0, packs: 0 },
                          });
                        }}
                        className="w-full px-4 py-2.5 bg-purple-50 border-2 border-purple-100 rounded-2xl text-sm font-semibold text-purple-900 focus:outline-none focus:border-purple-400"
                      />
                    </div>

                    {error && (
                      <div className="p-4 bg-red-50 border-2 border-red-200 rounded-2xl flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <div className="text-red-700 text-sm font-bold">{error}</div>
                      </div>
                    )}

                    <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4">
                      <button
                        onClick={() => setCurrentStep(intakeMethod)}
                        className="py-3 px-6 rounded-2xl text-sm font-bold text-purple-700 bg-white border-2 border-purple-100 hover:border-purple-300 transition-all"
                      >
                        Back
                      </button>
                      <button
                        onClick={() => handleSaveProduct(productData)}
                        disabled={saving}
                        className="py-3 px-6 rounded-2xl text-sm font-bold text-white disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                        style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}
                      >
                        {saving ? 'Saving...' : 'Save Product'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Confirmation */}
          {currentStep === 'confirmation' && (
            <motion.div key="confirmation" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.3 }}>
              <div className="max-w-md mx-auto text-center space-y-8">
                {/* Success Icon */}
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.2 }}
                  className="w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center mx-auto shadow-lg"
                >
                  <Check className="w-10 h-10 text-white" />
                </motion.div>

                {/* Message */}
                <div className="space-y-3">
                  <h2 className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent">Success!</h2>
                  <p className="text-purple-600 text-base font-semibold">
                    <strong className="text-purple-900">{productData?.name}</strong> has been added to your inventory and sent to the review queue. An admin will approve it shortly.
                  </p>
                </div>

                {/* Product Preview Card */}
                <div className="bg-white rounded-3xl border-2 border-purple-100 overflow-hidden shadow-sm">
                  <div className="h-2 bg-gradient-to-r from-green-400 to-green-600" />
                  <div className="p-6">
                    <img src={productData?.imageUrl} className="w-full h-40 rounded-2xl object-cover mb-4" alt="" />
                    <p className="text-sm font-bold text-purple-900 mb-1">{productData?.name}</p>
                    <p className="text-xs text-purple-400">Status: Pending Review</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col-reverse sm:flex-row gap-3">
                  <button
                    onClick={() => onComplete?.()}
                    className="py-3 px-6 rounded-2xl text-sm font-bold text-purple-700 bg-white border-2 border-purple-100 hover:border-purple-300 transition-all"
                  >
                    Done
                  </button>
                  <button
                    onClick={() => {
                      setCurrentStep('entry');
                      setProductData(null);
                      setError(null);
                    }}
                    className="py-3 px-6 rounded-2xl text-sm font-bold text-white"
                    style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}
                  >
                    Add Another
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
