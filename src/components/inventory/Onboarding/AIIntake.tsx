import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, AlertCircle, X, ArrowLeft } from 'lucide-react';
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
  { id: 'check', label: 'Checking product image' },
  { id: 'analyze', label: 'Analyzing details' },
  { id: 'generate', label: 'Generating description' },
  { id: 'pricing', label: 'Calculating pricing' },
];

export default function AIIntake({ onComplete, onCancel }: AIIntakeProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState<number>(-1);
  const [aiResult, setAiResult] = useState<any>(null);
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
    setAnalysisStep(-1);
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
    setPreviews(previews.filter((_, i) => i !== index));
  };

  const simulateProgress = async () => {
    for (let i = 0; i < ANALYSIS_STEPS.length; i++) {
      setAnalysisStep(i);
      await new Promise(resolve => setTimeout(resolve, 800));
    }
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
      await simulateProgress();

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

      const analysis = await identifyProduct(base64);
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

      setAiResult(analysis);
      setFormData(result);
      setAnalysisStep(-1);
    } catch (err) {
      console.error('Analysis error:', err);
      setError('Failed to analyze image. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFieldChange = (key: keyof AIIntakeResult, value: any) => {
    const updated = { ...formData, [key]: value };

    if (key === 'retailPrice' || key === 'markdownPercentage') {
      const retail = key === 'retailPrice' ? value : formData?.retailPrice || 0;
      const markdown = key === 'markdownPercentage' ? value : formData?.markdownPercentage || 40;
      updated.discountPrice = calculateSellingPrice(retail, markdown);
    }

    setFormData(updated);
  };

  const handleSubmit = () => {
    if (!formData) return;

    const validation = validateProduct(formData);
    if (!validation.isValid) {
      setErrors(validation.errors.map(e => e.message));
      return;
    }

    setErrors([]);
    onComplete(formData as AIIntakeResult);
  };

  if (formData) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setFormData(null);
              setAiResult(null);
            }}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Verify Product Details</h2>
            <p className="text-sm text-gray-600 mt-1">AI has analyzed the image. Review and adjust as needed</p>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="p-6 sm:p-8 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row gap-6">
              {previews[0] && (
                <div className="flex-shrink-0">
                  <img src={previews[0]} className="w-full sm:w-32 h-auto sm:h-32 rounded-lg object-cover" alt="" />
                </div>
              )}
              <div className="flex-1">
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-2">CONFIDENCE SCORE</p>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(formData.confidenceScore ?? 0) * 100}%` }}
                          className={cn(
                            'h-full transition-colors',
                            (formData.confidenceScore ?? 0) > 0.8 ? 'bg-green-600' : 'bg-amber-600'
                          )}
                        />
                      </div>
                      <span className={cn(
                        'text-sm font-semibold min-w-fit',
                        (formData.confidenceScore ?? 0) > 0.8 ? 'text-green-600' : 'text-amber-600'
                      )}>
                        {Math.round((formData.confidenceScore ?? 0) * 100)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">Product Name</label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) => handleFieldChange('name', e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent transition-all"
                placeholder="e.g. Vintage Denim Jacket"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">Description</label>
              <textarea
                value={formData.description || ''}
                onChange={(e) => handleFieldChange('description', e.target.value)}
                rows={4}
                className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent transition-all resize-none"
                placeholder="Describe the product..."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Category</label>
                <select
                  value={formData.category || ''}
                  onChange={(e) => handleFieldChange('category', e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent transition-all appearance-none"
                >
                  <option value="">Select category...</option>
                  {['Sneakers', 'Clothing', 'Accessories', 'Electronics', 'Collectibles', 'Other'].map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Condition</label>
                <select
                  value={formData.condition || 'New'}
                  onChange={(e) => handleFieldChange('condition', e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent transition-all appearance-none"
                >
                  <option value="New">New</option>
                  <option value="Like New">Like New</option>
                  <option value="Pre-owned">Pre-owned</option>
                  <option value="Refurbished">Refurbished</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Retail Price</label>
                <div className="relative">
                  <span className="absolute left-4 top-2.5 text-gray-600 font-semibold">R</span>
                  <input
                    type="number"
                    value={formData.retailPrice || ''}
                    onChange={(e) => handleFieldChange('retailPrice', Number(e.target.value))}
                    className="w-full pl-8 pr-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Markdown %</label>
                <div className="relative">
                  <input
                    type="number"
                    value={formData.markdownPercentage || 40}
                    onChange={(e) => handleFieldChange('markdownPercentage', Number(e.target.value))}
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent transition-all"
                  />
                  <span className="absolute right-4 top-2.5 text-gray-600 font-semibold">%</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Sale Price</label>
                <div className="relative">
                  <span className="absolute left-4 top-2.5 text-gray-600 font-semibold">R</span>
                  <div className="w-full pl-8 pr-4 py-2.5 bg-green-50 border border-green-200 rounded-lg text-sm font-semibold text-green-700">
                    {formData.discountPrice || 0}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">Total Stock</label>
              <input
                type="number"
                min="1"
                value={formData.stock || 1}
                onChange={(e) => handleFieldChange('stock', Number(e.target.value))}
                className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent transition-all"
              />
            </div>

            {errors.length > 0 && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg space-y-1">
                {errors.map((err, i) => (
                  <p key={i} className="text-sm text-red-700">{err}</p>
                ))}
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setFormData(null);
                  setAiResult(null);
                }}
                className="py-2.5 px-4 rounded-lg text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                className="py-2.5 px-4 rounded-lg text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 transition-colors"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onCancel}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Upload Product Photos</h2>
          <p className="text-sm text-gray-600 mt-1">AI will analyze the images to generate product details</p>
        </div>
      </div>

      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 sm:p-12 text-center transition-all cursor-pointer',
          isDragActive ? 'border-purple-500 bg-purple-50' : 'border-gray-300 bg-gray-50 hover:border-gray-400'
        )}
      >
        <input {...getInputProps()} />
        <div className="space-y-3">
          <div className="text-gray-400">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <p className="text-gray-900 font-semibold text-sm sm:text-base">Drag & drop photos here</p>
            <p className="text-gray-600 text-xs sm:text-sm mt-1">or click to browse (up to 3 images)</p>
          </div>
        </div>
      </div>

      {previews.length > 0 && (
        <div className="space-y-4">
          <p className="text-sm font-medium text-gray-900">{previews.length} image{previews.length !== 1 ? 's' : ''} selected</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {previews.map((preview, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative group rounded-lg overflow-hidden bg-gray-100"
              >
                <img src={preview} className="w-full h-32 object-cover" alt={`Preview ${i + 1}`} />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(i);
                  }}
                  className="absolute top-2 right-2 p-1.5 bg-black/70 hover:bg-black rounded-lg text-white opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {isAnalyzing && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-900">Analyzing images...</p>
          <div className="space-y-2">
            {ANALYSIS_STEPS.map((step, idx) => (
              <motion.div
                key={step.id}
                animate={{ opacity: analysisStep >= idx ? 1 : 0.5 }}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
              >
                {analysisStep === idx ? (
                  <Loader2 className="w-4 h-4 text-purple-600 animate-spin flex-shrink-0" />
                ) : analysisStep > idx ? (
                  <div className="w-4 h-4 rounded-full bg-green-600 flex-shrink-0" />
                ) : (
                  <div className="w-4 h-4 rounded-full bg-gray-300 flex-shrink-0" />
                )}
                <span className={cn(
                  'text-sm font-medium',
                  analysisStep === idx ? 'text-gray-900' : 'text-gray-600'
                )}>
                  {step.label}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {!isAnalyzing && previews.length > 0 && !formData && (
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleAnalyze}
          className="w-full py-3 px-4 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-medium text-sm transition-colors flex items-center justify-center gap-2"
        >
          <span>Analyze with AI</span>
        </motion.button>
      )}
    </motion.div>
  );
}
