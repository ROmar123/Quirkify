import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, ArrowLeft } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { db, auth } from '../../../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Product } from '../../../types';
import AIIntake, { AIIntakeResult } from './AIIntake';

type Step = 'entry' | 'intake' | 'review' | 'confirmation';

interface OnboardingFlowProps {
  onComplete?: () => void;
}

const STEPS: { id: Step; label: string; number: number }[] = [
  { id: 'entry', label: 'Select Method', number: 1 },
  { id: 'intake', label: 'Upload Product', number: 2 },
  { id: 'review', label: 'Review Details', number: 3 },
  { id: 'confirmation', label: 'Complete', number: 4 },
];

export default function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [currentStep, setCurrentStep] = useState<Step>('entry');
  const [productData, setProductData] = useState<Partial<Product> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep);

  const handleAIIntakeComplete = (data: AIIntakeResult) => {
    setProductData({
      ...data,
      // Set default allocations: all to store
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

  const handleSaveProduct = async (finalData: Partial<Product>) => {
    if (!auth.currentUser) {
      setError('You must be logged in');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const productRef = await addDoc(collection(db, 'products'), {
        ...finalData,
        createdAt: serverTimestamp(),
        authorUid: auth.currentUser.uid,
        status: 'pending', // Always starts as pending for review
      });

      setProductData(finalData);
      setCurrentStep('confirmation');
    } catch (err: any) {
      setError(err.message || 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Step Indicator - Mobile Optimized */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            {STEPS.map((step, idx) => {
              const done = idx < currentStepIndex;
              const active = step.id === currentStep;
              return (
                <div key={step.id} className="flex-1 flex items-center">
                  {/* Step Indicator */}
                  <motion.div
                    animate={{ scale: active ? 1 : 0.9 }}
                    className={cn(
                      'w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-semibold text-xs sm:text-sm transition-all flex-shrink-0',
                      done ? 'bg-green-600 text-white' :
                      active ? 'bg-purple-600 text-white border-2 border-purple-600' :
                      'bg-gray-200 text-gray-600'
                    )}
                  >
                    {done ? <Check className="w-4 h-4 sm:w-5 sm:h-5" /> : step.number}
                  </motion.div>

                  {/* Label - Hidden on mobile */}
                  <div className="hidden sm:block flex-1 ml-3">
                    <p className={cn(
                      'text-xs font-semibold transition-colors',
                      active ? 'text-purple-600' : done ? 'text-green-600' : 'text-gray-400'
                    )}>
                      {step.label}
                    </p>
                  </div>

                  {/* Connector - Hidden on mobile */}
                  {idx < STEPS.length - 1 && (
                    <div className="hidden sm:flex flex-1 h-0.5 mx-2" style={{
                      background: done || active ? 'linear-gradient(to right, rgb(168, 85, 247), rgb(168, 85, 247))' : 'rgb(229, 231, 235)'
                    }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 sm:py-12">
        <AnimatePresence mode="wait">
          {/* Entry Point */}
          {currentStep === 'entry' && (
            <motion.div key="entry" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
              <div className="space-y-8">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Add New Product</h2>
                  <p className="text-gray-600 text-sm sm:text-base">Choose how you'd like to add your product to inventory</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* AI Option */}
                  <motion.button
                    whileHover={{ y: -4 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setCurrentStep('intake')}
                    className="group bg-white rounded-lg border border-gray-200 p-6 sm:p-8 text-left hover:shadow-md hover:border-purple-300 transition-all duration-200"
                  >
                    <div className="space-y-4">
                      <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center">
                        <span className="text-xl font-bold text-purple-600">AI</span>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">AI Intake</h3>
                        <p className="text-gray-600 text-sm">Upload photos and let AI analyze the product details</p>
                      </div>
                      <div className="inline-block text-purple-600 text-sm font-semibold group-hover:translate-x-1 transition-transform">
                        Get Started →
                      </div>
                    </div>
                  </motion.button>

                  {/* Manual Option - Coming Soon */}
                  <div className="bg-gray-50 rounded-lg border border-gray-200 p-6 sm:p-8 text-left opacity-60 cursor-not-allowed">
                    <div className="space-y-4">
                      <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
                        <span className="text-xl font-bold text-gray-400">∨</span>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Manual Entry</h3>
                        <p className="text-gray-600 text-sm">Enter product details manually</p>
                      </div>
                      <div className="inline-block text-gray-400 text-sm font-semibold">
                        Coming Soon
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

        {/* AI Intake */}
        {currentStep === 'intake' && (
          <motion.div key="intake" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <AIIntake
              onComplete={handleAIIntakeComplete}
              onCancel={() => setCurrentStep('entry')}
            />
          </motion.div>
        )}

        {/* Review */}
        {currentStep === 'review' && productData && (
          <motion.div key="review" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
            <div className="space-y-8 max-w-2xl">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Review Details</h2>
                <p className="text-gray-600 text-sm sm:text-base">Verify the product information before saving</p>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                {/* Product Preview */}
                <div className="p-6 sm:p-8 border-b border-gray-200">
                  <div className="flex flex-col sm:flex-row gap-6">
                    {productData.imageUrl && (
                      <div className="flex-shrink-0">
                        <img src={productData.imageUrl} className="w-full sm:w-32 h-auto sm:h-32 rounded-lg object-cover" alt="" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-3">{productData.name}</h3>
                      <p className="text-gray-600 text-sm mb-4 leading-relaxed">{productData.description}</p>

                      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                        <div>
                          <p className="text-xs font-semibold text-gray-500 mb-1">CATEGORY</p>
                          <p className="text-sm font-medium text-gray-900">{productData.category}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-500 mb-1">CONDITION</p>
                          <p className="text-sm font-medium text-gray-900">{productData.condition}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-500 mb-1">PRICE</p>
                          <p className="text-sm font-medium text-gray-900">R{productData.retailPrice} <span className="text-gray-400 line-through">R{productData.discountPrice}</span></p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-500 mb-1">STOCK</p>
                          <p className="text-sm font-medium text-gray-900">{productData.stock} units</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="p-6 sm:p-8 bg-gray-50 flex flex-col-reverse sm:flex-row gap-3">
                  <button
                    onClick={() => setCurrentStep('intake')}
                    className="py-2.5 px-4 rounded-lg text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition-colors"
                  >
                    <span className="flex items-center justify-center gap-2">
                      <ArrowLeft className="w-4 h-4" />
                      Back
                    </span>
                  </button>
                  <button
                    onClick={() => handleSaveProduct(productData)}
                    disabled={saving}
                    className="py-2.5 px-4 rounded-lg text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-60 transition-colors"
                  >
                    {saving ? 'Saving...' : 'Save Product'}
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Confirmation */}
        {currentStep === 'confirmation' && (
          <motion.div key="confirmation" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.3 }}>
            <div className="max-w-2xl flex flex-col items-center text-center space-y-8">
              {/* Success Icon */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center"
              >
                <Check className="w-8 h-8 text-green-600" />
              </motion.div>

              {/* Message */}
              <div className="space-y-3">
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Product Saved</h2>
                <p className="text-gray-600 text-sm sm:text-base max-w-md mx-auto">
                  <strong>{productData?.name}</strong> has been added to your inventory and sent to the review queue. An admin will approve it shortly.
                </p>
              </div>

              {/* Actions */}
              <div className="flex flex-col-reverse sm:flex-row gap-3 w-full sm:w-auto">
                <button
                  onClick={() => onComplete?.()}
                  className="py-2.5 px-6 rounded-lg text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition-colors"
                >
                  Done
                </button>
                <button
                  onClick={() => {
                    setCurrentStep('entry');
                    setProductData(null);
                  }}
                  className="py-2.5 px-6 rounded-lg text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 transition-colors"
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
