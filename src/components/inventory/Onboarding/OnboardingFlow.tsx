import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, ArrowLeft, Upload } from 'lucide-react';
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
        status: 'pending',
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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 flex flex-col">
      {/* Sticky Header with Progress */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-purple-100 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <h1 className="text-2xl sm:text-3xl font-black gradient-text mb-6">Add New Product</h1>

          {/* Progress Steps */}
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            {STEPS.map((step, idx) => {
              const done = idx < currentStepIndex;
              const active = step.id === currentStep;
              return (
                <div key={step.id} className="flex-1 flex items-center">
                  <motion.div
                    animate={{ scale: active ? 1.1 : 1 }}
                    className={cn(
                      'w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center font-bold text-sm sm:text-base transition-all flex-shrink-0 shadow-sm',
                      done ? 'bg-gradient-to-br from-green-400 to-green-600 text-white' :
                      active ? 'bg-gradient-to-br from-pink-500 to-purple-600 text-white ring-4 ring-purple-200' :
                      'bg-white text-purple-400 border-2 border-purple-100'
                    )}
                  >
                    {done ? <Check className="w-5 h-5 sm:w-6 sm:h-6" /> : step.number}
                  </motion.div>

                  {idx < STEPS.length - 1 && (
                    <div className="hidden sm:block flex-1 h-1 mx-3" style={{
                      background: done ? 'linear-gradient(to right, #22C55E, #16A34A)' : 'rgb(229, 231, 235)'
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

                  {/* Manual Option - Coming Soon */}
                  <div className="bg-white rounded-3xl border-2 border-purple-100 overflow-hidden opacity-60 cursor-not-allowed">
                    <div className="h-2 bg-gray-200" />
                    <div className="p-8 sm:p-10">
                      <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                        <span className="text-2xl">✍️</span>
                      </div>
                      <h3 className="text-xl sm:text-2xl font-black text-purple-900 mb-2">Manual Entry</h3>
                      <p className="text-purple-600 text-sm font-semibold mb-6">Enter product details manually</p>
                      <div className="inline-block px-4 py-2 bg-gray-200 text-gray-600 text-sm font-bold rounded-full">
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
            <motion.div key="intake" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
              <AIIntake
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
                    onClick={() => setCurrentStep('intake')}
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
                        onClick={() => setCurrentStep('intake')}
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
