import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, ArrowLeft, Upload, AlertCircle } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { db, auth } from '../../../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Product } from '../../../types';
import AIIntake, { AIIntakeResult } from './AIIntake';
import ManualEntry from './ManualEntry';
import { retryFirestoreOperation } from '../../../services/retry';

type Step = 'entry' | 'intake' | 'manual' | 'review' | 'confirmation';

interface OnboardingFlowProps {
  onComplete?: () => void;
}

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

  // For progress display, treat intake and manual as same step
  const displayStep = currentStep === 'manual' ? 'intake' : currentStep;
  const displayStepIndex = STEPS.findIndex(s => s.id === displayStep);

  const handleAIIntakeComplete = (data: AIIntakeResult) => {
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

    setSaving(true);
    setError(null);

    try {
      // Validate condition - map to valid values
      const validConditions = ['New', 'Like New', 'Pre-owned', 'Refurbished'];
      let condition = finalData.condition || 'New';
      if (!validConditions.includes(condition)) {
        condition = 'New'; // Default to New if invalid
      }

      // Ensure description is not empty (Firestore rule requires size > 0)
      const description = finalData.description && finalData.description.trim().length > 0
        ? finalData.description
        : `${finalData.name || 'Product'} - No description provided`;

      // Ensure imageUrl exists (Firestore rule requires size > 0)
      const imageUrl = finalData.imageUrl && finalData.imageUrl.length > 0 && finalData.imageUrl.length < 2000
        ? finalData.imageUrl
        : 'https://via.placeholder.com/400x400?text=No+Image';

      const productToSave = {
        name: finalData.name || 'Untitled Product',
        description: description,
        category: finalData.category || 'Uncategorized',
        condition: condition,
        retailPrice: finalData.retailPrice && finalData.retailPrice > 0 ? finalData.retailPrice : 99.99,
        discountPrice: finalData.discountPrice && finalData.discountPrice > 0 ? finalData.discountPrice : 49.99,
        markdownPercentage: finalData.markdownPercentage >= 0 ? finalData.markdownPercentage : 50,
        stock: finalData.stock && finalData.stock > 0 ? finalData.stock : 1,
        allocations: {
          store: (finalData.allocations?.store || 1),
          auction: (finalData.allocations?.auction || 0),
          packs: (finalData.allocations?.packs || 0),
        },
        imageUrl: imageUrl,
        status: 'pending' as const,
        authorUid: auth.currentUser.uid,
      };

      const docRef = await addDoc(collection(db, 'products'), productToSave);
      setCurrentStep('confirmation');
    } catch (err: any) {
      const message = err.message || err.toString();
      setError(message.substring(0, 200));
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
                onComplete={handleAIIntakeComplete}
                onCancel={() => setCurrentStep('entry')}
              />
            </motion.div>
          )}

          {/* Manual Entry */}
          {currentStep === 'manual' && (
            <motion.div key="manual" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
              <ManualEntry
                onComplete={handleAIIntakeComplete}
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
                    onClick={() => setCurrentStep(productData?.confidence === 100 ? 'manual' : 'intake')}
                    className="p-2 hover:bg-purple-100 rounded-xl transition-colors"
                  >
                    <ArrowLeft className="w-5 h-5 text-purple-600" />
                  </button>
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-black text-purple-900">Review Details</h2>
                    <p className="text-purple-400 text-sm font-semibold mt-1">Verify the product information before saving</p>
                  </div>
                </div>

                <div className="bg-white rounded-3xl border-2 border-purple-100 overflow-hidden shadow-sm">
                  {/* Gradient Bar */}
                  <div className="h-2 bg-gradient-to-r from-pink-500 to-purple-600" />

                  {/* Product Preview */}
                  <div className="p-6 sm:p-8 border-b border-purple-100">
                    <div className="flex flex-col sm:flex-row gap-6">
                      {productData.imageUrl && (
                        <div className="flex-shrink-0">
                          <img src={productData.imageUrl} className="w-full sm:w-40 h-auto sm:h-40 rounded-2xl object-cover shadow-md" alt="" />
                        </div>
                      )}
                      <div className="flex-1">
                        <h3 className="text-2xl font-black text-purple-900 mb-2">{productData.name}</h3>
                        <p className="text-purple-600 text-sm font-semibold leading-relaxed mb-4">{productData.description}</p>

                        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-purple-100">
                          <div>
                            <p className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-1">CATEGORY</p>
                            <p className="text-sm font-black text-purple-900">{productData.category}</p>
                          </div>
                          <div>
                            <p className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-1">CONDITION</p>
                            <p className="text-sm font-black text-purple-900">{productData.condition}</p>
                          </div>
                          <div>
                            <p className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-1">RETAIL PRICE</p>
                            <p className="text-sm font-black text-purple-900">R{productData.retailPrice}</p>
                          </div>
                          <div>
                            <p className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-1">SALE PRICE</p>
                            <p className="text-sm font-black bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent">R{productData.discountPrice}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Stock & Actions */}
                  <div className="p-6 sm:p-8 bg-gradient-to-br from-purple-50 to-pink-50 space-y-6">
                    <div>
                      <p className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-2">TOTAL STOCK</p>
                      <p className="text-3xl font-black text-purple-900">{productData.stock}</p>
                    </div>

                    {error && (
                      <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm font-bold">
                        {error}
                      </div>
                    )}

                    <div className="flex flex-col-reverse sm:flex-row gap-3">
                      <button
                        onClick={() => setCurrentStep(productData?.confidence === 100 ? 'manual' : 'intake')}
                        className="py-3 px-6 rounded-2xl text-sm font-bold text-purple-700 bg-white border-2 border-purple-100 hover:border-purple-300 transition-all"
                      >
                        Back
                      </button>
                      <button
                        onClick={() => handleSaveProduct(productData)}
                        disabled={saving}
                        className="py-3 px-6 rounded-2xl text-sm font-bold text-white disabled:opacity-60 transition-all"
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
