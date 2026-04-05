import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, Upload, Loader2, AlertCircle, Sparkles, X } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { identifyProduct } from '../../../services/gemini';
import { mapToStandardCategory } from '../../../lib/categories';
import { ProductCondition } from '../../../types';
import { validateProduct, calculateSellingPrice } from '../Shared/StockValidator';

interface AIIntakeProps {
  onComplete: (data: AIIntakeResult) => void;
  onCancel: () => void;
}

export interface AIIntakeResult {
  name: string;
  description: string;
  category: string;
  retailPrice: number;
  discountPrice: number;
  markdownPercentage: number;
  condition: ProductCondition;
  stock: number;
  imageUrl: string;
  imageUrls: string[];
  confidenceScore: number;
}

const ANALYSIS_STEPS = [
  { id: 'check', label: '📸 Checking product image...' },
  { id: 'analyze', label: '🔍 Doing comparative analysis...' },
  { id: 'generate', label: '💡 Generating product details...' },
  { id: 'pricing', label: '🏷️ Calculating optimal pricing...' },
];

export default function AIIntake({ onComplete, onCancel }: AIIntakeProps) {
  // Image upload
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);

  // AI analysis
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<any>(null);

  // Form editing
  const [formData, setFormData] = useState<Partial<AIIntakeResult> | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = [...files, ...acceptedFiles].slice(0, 3);
    setFiles(newFiles);
    setPreviews(newFiles.map(f => URL.createObjectURL(f)));
    setAiResult(null);
    setFormData(null);
    setError(null);
  }, [files]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    multiple: true,
    maxFiles: 3
  });

  const removeFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    setFiles(newFiles);
    setPreviews(newFiles.map(f => URL.createObjectURL(f)));
  };

  // Simulate AI analysis with progress steps
  const simulateProgress = async () => {
    for (const step of ANALYSIS_STEPS) {
      setAnalysisStep(step.id);
      await new Promise(resolve => setTimeout(resolve, 600));
    }
    setAnalysisStep(null);
  };

  const handleAnalyze = async () => {
    if (files.length === 0) {
      setError('Please select at least one image');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setErrors([]);

    try {
      // Show progress simulation
      await simulateProgress();

      // Analyze first image with AI
      const file = files[0];
      const reader = new FileReader();

      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = (reader.result as string).split(',')[1];
          resolve(result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Call Gemini API
      const analysis = await identifyProduct(base64);

      // Map category to standard
      const standardCategory = mapToStandardCategory(analysis.category || '');
      const retailPrice = analysis.retailPrice || analysis.priceRange?.max || 0;
      const markdownPercentage = 40;
      const discountPrice = calculateSellingPrice(retailPrice, markdownPercentage);

      const result = {
        ...analysis,
        category: standardCategory,
        retailPrice,
        discountPrice,
        markdownPercentage,
        condition: 'New' as ProductCondition,
        stock: 1,
        imageUrl: previews[0],
        imageUrls: previews
      };

      setAiResult(analysis); // Store raw analysis
      setFormData(result); // Set editable form
    } catch (err) {
      console.error('Analysis error:', err);
      setError('Failed to analyze image. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFieldChange = (key: keyof AIIntakeResult, value: any) => {
    const updated = { ...formData, [key]: value };

    // Auto-calculate discount price
    if (key === 'retailPrice' || key === 'markdownPercentage') {
      const retail = key === 'retailPrice' ? value : formData?.retailPrice || 0;
      const markdown = key === 'markdownPercentage' ? value : formData?.markdownPercentage || 40;
      updated.discountPrice = calculateSellingPrice(retail, markdown);
    }

    setFormData(updated);
  };

  const handleSubmit = () => {
    if (!formData) return;

    // Validate
    const validation = validateProduct(formData);
    if (!validation.isValid) {
      setErrors(validation.errors.map(e => e.message));
      return;
    }

    // All good
    setErrors([]);
    onComplete(formData as AIIntakeResult);
  };

  const inputClass = 'w-full px-4 py-2.5 bg-purple-50 border-2 border-purple-100 rounded-2xl text-sm font-semibold text-purple-800 focus:outline-none focus:border-purple-400 transition-colors';
  const labelClass = 'block text-xs font-bold text-purple-400 mb-1 uppercase tracking-widest';

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-black gradient-text">AI Product Intake</h1>
        <p className="text-purple-400 text-xs font-semibold mt-1">Upload photos — AI identifies the product, you review and approve</p>
      </div>

      {/* Image Upload Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Upload */}
        <div className="space-y-4">
          <div
            {...getRootProps()}
            className={cn(
              'aspect-square border-2 border-dashed rounded-3xl flex flex-col items-center justify-center p-6 transition-all cursor-pointer overflow-hidden relative bg-white',
              isDragActive ? 'border-purple-400 bg-purple-50' : 'border-purple-100 hover:border-purple-300',
              previews.length > 0 && 'border-transparent p-0'
            )}
          >
            <input {...getInputProps()} />
            {previews.length > 0 ? (
              <div className="grid grid-cols-2 gap-1 w-full h-full">
                {previews.map((p, i) => (
                  <div key={i} className={cn('relative group', i === 0 && previews.length === 1 ? 'col-span-2 row-span-2' : i === 0 ? 'col-span-2' : '')}>
                    <img src={p} className="w-full h-full object-cover rounded-2xl" alt="" />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(i);
                      }}
                      className="absolute top-2 right-2 p-1 bg-black/60 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {previews.length < 3 && (
                  <div className="flex items-center justify-center bg-purple-50 border-2 border-dashed border-purple-100 rounded-2xl">
                    <span className="text-purple-300 text-sm font-bold">+</span>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-3" style={{ background: 'linear-gradient(135deg, #FDF4FF, #EDE9FE)' }}>
                  <Camera className="w-8 h-8 text-purple-400" />
                </div>
                <p className="text-purple-400 text-center text-xs font-bold">Drag & drop up to 3 photos</p>
                <p className="text-purple-300 text-xs mt-1">or click to browse</p>
              </>
            )}
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-2 text-red-600 text-xs font-bold">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
            </div>
          )}

          {!formData && files.length > 0 && (
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              className="w-full py-3 rounded-2xl font-black text-sm text-white disabled:opacity-50 flex items-center justify-center gap-2 hover:opacity-90 transition-all"
              style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  AI Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Analyze with AI
                </>
              )}
            </button>
          )}

          {isAnalyzing && (
            <div className="space-y-2">
              {ANALYSIS_STEPS.map((step) => (
                <motion.div
                  key={step.id}
                  animate={{ opacity: analysisStep === step.id ? 1 : 0.5 }}
                  className="p-2 text-xs font-semibold text-purple-600 flex items-center gap-2"
                >
                  {analysisStep === step.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <span>✓</span>
                  )}
                  {step.label}
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Form */}
        <AnimatePresence mode="wait">
          {formData ? (
            <motion.div key="form" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              <div className="bg-purple-50 rounded-2xl border border-purple-100 p-4">
                <p className="text-[10px] text-purple-400 font-bold uppercase mb-2">AI Confidence</p>
                <p className={cn(
                  'text-2xl font-black',
                  (formData.confidenceScore ?? 0) > 0.8 ? 'text-green-600' : 'text-amber-600'
                )}>
                  {Math.round((formData.confidenceScore ?? 0) * 100)}%
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className={labelClass}>Product Name</label>
                  <input
                    value={formData.name || ''}
                    onChange={(e) => handleFieldChange('name', e.target.value)}
                    className={inputClass}
                    placeholder="e.g. Vintage Denim Jacket"
                  />
                </div>

                <div>
                  <label className={labelClass}>Description</label>
                  <textarea
                    value={formData.description || ''}
                    onChange={(e) => handleFieldChange('description', e.target.value)}
                    rows={3}
                    className={cn(inputClass, 'resize-none')}
                    placeholder="Describe the item..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Category</label>
                    <select
                      value={formData.category || ''}
                      onChange={(e) => handleFieldChange('category', e.target.value)}
                      className={inputClass}
                    >
                      <option value="">Select...</option>
                      {['Sneakers', 'Clothing', 'Accessories', 'Electronics', 'Collectibles', 'Other'].map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={labelClass}>Condition</label>
                    <select
                      value={formData.condition || 'New'}
                      onChange={(e) => handleFieldChange('condition', e.target.value)}
                      className={inputClass}
                    >
                      <option value="New">New</option>
                      <option value="Like New">Like New</option>
                      <option value="Pre-owned">Pre-owned</option>
                      <option value="Refurbished">Refurbished</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={labelClass}>Retail (R)</label>
                    <input
                      type="number"
                      value={formData.retailPrice || ''}
                      onChange={(e) => handleFieldChange('retailPrice', Number(e.target.value))}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Markdown %</label>
                    <input
                      type="number"
                      value={formData.markdownPercentage || 40}
                      onChange={(e) => handleFieldChange('markdownPercentage', Number(e.target.value))}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Sale Price (R)</label>
                    <div className={cn(inputClass, 'bg-green-50 border-green-200 flex items-center')}>
                      <span className="font-black text-green-700">{formData.discountPrice || 0}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Total Stock</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.stock || 1}
                    onChange={(e) => handleFieldChange('stock', Number(e.target.value))}
                    className={inputClass}
                  />
                </div>
              </div>

              {errors.length > 0 && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-2xl">
                  {errors.map((err, i) => (
                    <p key={i} className="text-xs text-red-600 font-bold mb-1">{err}</p>
                  ))}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setFormData(null);
                    setAiResult(null);
                  }}
                  className="flex-1 py-3 rounded-2xl text-sm font-bold text-purple-700 bg-purple-50 border-2 border-purple-100 hover:border-purple-300 transition-all"
                >
                  ← Back
                </button>
                <button
                  onClick={handleSubmit}
                  className="flex-1 py-3 rounded-2xl text-sm font-bold text-white transition-all hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}
                >
                  Next →
                </button>
              </div>
            </motion.div>
          ) : (
            <div key="empty" className="flex flex-col items-center justify-center text-center p-8 bg-white rounded-3xl border-2 border-dashed border-purple-100">
              <Upload className="w-10 h-10 text-purple-200 mb-3" />
              <p className="text-xs font-bold text-purple-400">Upload photos to start</p>
              <p className="text-[10px] text-purple-300 mt-1">AI will analyze and suggest details</p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
