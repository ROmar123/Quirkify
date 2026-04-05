import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, Check } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { db, auth } from '../../../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Product } from '../../../types';
import AIIntake, { AIIntakeResult } from './AIIntake';

type Step = 'entry' | 'intake' | 'review' | 'confirmation';

interface OnboardingFlowProps {
  onComplete?: () => void;
}

const STEPS: { id: Step; label: string; icon: string }[] = [
  { id: 'entry', label: 'Choose', icon: '📍' },
  { id: 'intake', label: 'Add', icon: '➕' },
  { id: 'review', label: 'Review', icon: '✓' },
  { id: 'confirmation', label: 'Done', icon: '🎉' },
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
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Step Indicator */}
      <div className="mb-12">
        <div className="flex items-center justify-center gap-3 mb-8">
          {STEPS.map((step, idx) => {
            const done = idx < currentStepIndex;
            const active = step.id === currentStep;
            return (
              <div key={step.id} className="flex items-center gap-3">
                <motion.div
                  animate={{
                    scale: active ? 1.1 : 1,
                    boxShadow: active ? '0 0 20px rgba(168, 85, 247, 0.3)' : 'none'
                  }}
                  className={cn(
                    'w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg transition-all',
                    done ? 'bg-green-500 text-white' : active ? 'bg-purple-500 text-white' : 'bg-purple-100 text-purple-400'
                  )}
                >
                  {done ? <Check className="w-6 h-6" /> : step.icon}
                </motion.div>
                <span className={cn(
                  'hidden sm:inline text-xs font-bold uppercase tracking-widest',
                  active ? 'text-purple-700' : done ? 'text-green-600' : 'text-purple-300'
                )}>
                  {step.label}
                </span>
                {idx < STEPS.length - 1 && (
                  <div className={cn(
                    'w-8 h-1 rounded-full hidden sm:block mx-2',
                    done ? 'bg-green-500' : 'bg-purple-100'
                  )} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {/* Entry Point */}
        {currentStep === 'entry' && (
          <motion.div key="entry" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <div className="max-w-2xl mx-auto">
              <h2 className="text-3xl font-black gradient-text mb-8 text-center">How do you want to add products?</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  onClick={() => setCurrentStep('intake')}
                  className="bg-white rounded-3xl border-2 border-purple-100 p-8 text-center hover:shadow-lg transition-all"
                >
                  <div className="text-5xl mb-4">📸</div>
                  <h3 className="text-lg font-black text-purple-900 mb-2">AI Intake</h3>
                  <p className="text-sm text-purple-400 font-semibold">Upload photos and let AI identify the product</p>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  disabled
                  className="bg-white rounded-3xl border-2 border-purple-100 p-8 text-center opacity-50 cursor-not-allowed"
                >
                  <div className="text-5xl mb-4 opacity-50">✍️</div>
                  <h3 className="text-lg font-black text-purple-900 mb-2">Manual Entry</h3>
                  <p className="text-sm text-purple-400 font-semibold">Coming soon</p>
                </motion.button>
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

        {/* Review - Placeholder for now */}
        {currentStep === 'review' && productData && (
          <motion.div key="review" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <div className="max-w-2xl mx-auto bg-white rounded-3xl border border-purple-100 p-8">
              <h2 className="text-2xl font-black gradient-text mb-6">Review & Confirm</h2>

              <div className="space-y-4 mb-8">
                <div className="flex items-start gap-4">
                  {productData.imageUrl && (
                    <img src={productData.imageUrl} className="w-24 h-24 rounded-2xl object-cover" alt="" />
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-black text-purple-900">{productData.name}</p>
                    <p className="text-xs text-purple-400 mt-1">{productData.description}</p>
                    <div className="flex gap-4 mt-3 text-xs font-bold">
                      <span className="text-purple-600">R{productData.retailPrice} → R{productData.discountPrice}</span>
                      <span className="text-purple-400">Stock: {productData.stock}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setCurrentStep('intake')}
                  className="flex-1 py-3 rounded-2xl text-sm font-bold text-purple-700 bg-purple-50 border-2 border-purple-100 hover:border-purple-300 transition-all"
                >
                  ← Back
                </button>
                <button
                  onClick={() => handleSaveProduct(productData)}
                  disabled={saving}
                  className="flex-1 py-3 rounded-2xl text-sm font-bold text-white disabled:opacity-50 transition-all"
                  style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}
                >
                  {saving ? 'Saving...' : 'Confirm & Save'}
                </button>
              </div>

              {error && (
                <p className="mt-4 text-xs text-red-600 font-bold">{error}</p>
              )}
            </div>
          </motion.div>
        )}

        {/* Confirmation */}
        {currentStep === 'confirmation' && (
          <motion.div key="confirmation" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
            <div className="max-w-md mx-auto text-center">
              <div className="text-6xl mb-6">🎉</div>
              <h2 className="text-2xl font-black gradient-text mb-2">Product Added!</h2>
              <p className="text-purple-400 text-sm font-semibold mb-8">
                {productData?.name} has been sent to the review queue. An admin will approve it shortly.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setCurrentStep('entry');
                    setProductData(null);
                  }}
                  className="flex-1 py-3 rounded-2xl text-sm font-bold text-white transition-all hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}
                >
                  Add Another
                </button>
                <button
                  onClick={() => onComplete?.()}
                  className="flex-1 py-3 rounded-2xl text-sm font-bold text-purple-700 bg-purple-50 border-2 border-purple-100 hover:border-purple-300 transition-all"
                >
                  Done
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
