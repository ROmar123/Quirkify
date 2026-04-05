import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion } from 'motion/react';
import { Loader2, AlertCircle, X, ArrowLeft, Upload } from 'lucide-react';
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
  { id: 'check', label: 'Analyzing image' },
  { id: 'analyze', label: 'Identifying product' },
  { id: 'generate', label: 'Generating description' },
  { id: 'pricing', label: 'Calculating price' },
];

export default function AIIntake({ onComplete, onCancel }: AIIntakeProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState<number>(-1);
  const [formData, setFormData] = useState<Partial<AIIntakeResult> | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = [...files, ...acceptedFiles].slice(0, 3);
    setFiles(newFiles);
    setPreviews(newFiles.map(f => URL.createObjectURL(f)));
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
            onClick={() => setFormData(null)}
            className="p-2 hover:bg-purple-100 rounded-xl transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-purple-600" />
          </button>
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-purple-900">Verify AI Analysis</h2>
            <p className="text-purple-400 text-sm font-semibold mt-1">Review and edit the AI-generated details</p>
          </div>
        </div>

        <div className="bg-white rounded-3xl border-2 border-purple-100 overflow-hidden shadow-sm">
          <div className="h-2 bg-gradient-to-r from-pink-500 to-purple-600" />

          <div className="p-6 sm:p-8 border-b border-purple-100">
            <div className="flex flex-col sm:flex-row gap-6">
              {previews[0] && (
                <div className="flex-shrink-0">
                  <img src={previews[0]} className="w-full sm:w-32 h-auto sm:h-32 rounded-2xl object-cover shadow-md" alt="" />
                </div>
              )}
              <div className="flex-1">
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-2">AI CONFIDENCE</p>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(formData.confidenceScore ?? 0) * 100}%` }}
                          className={cn(
                            'h-full rounded-full',
                            (formData.confidenceScore ?? 0) > 0.8
                              ? 'bg-gradient-to-r from-green-400 to-green-600'
                              : 'bg-gradient-to-r from-amber-400 to-amber-600'
                          )}
                        />
                      </div>
                      <span className={cn(
                        'text-sm font-black min-w-fit',
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
              <label className="block text-xs font-bold text-purple-400 uppercase tracking-widest mb-2">Product Name</label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) => handleFieldChange('name', e.target.value)}
                className="w-full px-4 py-3 bg-purple-50 border-2 border-purple-100 rounded-2xl text-sm font-semibold text-purple-900 focus:outline-none focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all"
                placeholder="e.g. Vintage Denim Jacket"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-purple-400 uppercase tracking-widest mb-2">Description</label>
              <textarea
                value={formData.description || ''}
                onChange={(e) => handleFieldChange('description', e.target.value)}
                rows={4}
                className="w-full px-4 py-3 bg-purple-50 border-2 border-purple-100 rounded-2xl text-sm font-semibold text-purple-900 focus:outline-none focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all resize-none"
                placeholder="Describe the product..."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-purple-400 uppercase tracking-widest mb-2">Category</label>
                <select
                  value={formData.category || ''}
                  onChange={(e) => handleFieldChange('category', e.target.value)}
                  className="w-full px-4 py-3 bg-purple-50 border-2 border-purple-100 rounded-2xl text-sm font-semibold text-purple-900 focus:outline-none focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all appearance-none"
                >
                  <option value="">Select category...</option>
                  {['Sneakers', 'Clothing', 'Accessories', 'Electronics', 'Collectibles', 'Other'].map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-purple-400 uppercase tracking-widest mb-2">Condition</label>
                <select
                  value={formData.condition || 'New'}
                  onChange={(e) => handleFieldChange('condition', e.target.value)}
                  className="w-full px-4 py-3 bg-purple-50 border-2 border-purple-100 rounded-2xl text-sm font-semibold text-purple-900 focus:outline-none focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all appearance-none"
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
                <label className="block text-xs font-bold text-purple-400 uppercase tracking-widest mb-2">Retail Price</label>
                <div className="relative">
                  <span className="absolute left-4 top-3 text-purple-900 font-bold">R</span>
                  <input
                    type="number"
                    value={formData.retailPrice || ''}
                    onChange={(e) => handleFieldChange('retailPrice', Number(e.target.value))}
                    className="w-full pl-8 pr-4 py-3 bg-purple-50 border-2 border-purple-100 rounded-2xl text-sm font-semibold text-purple-900 focus:outline-none focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-purple-400 uppercase tracking-widest mb-2">Markdown %</label>
                <div className="relative">
                  <input
                    type="number"
                    value={formData.markdownPercentage || 40}
                    onChange={(e) => handleFieldChange('markdownPercentage', Number(e.target.value))}
                    className="w-full px-4 py-3 bg-purple-50 border-2 border-purple-100 rounded-2xl text-sm font-semibold text-purple-900 focus:outline-none focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all"
                  />
                  <span className="absolute right-4 top-3 text-purple-900 font-bold">%</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-purple-400 uppercase tracking-widest mb-2">Sale Price</label>
                <div className="w-full px-4 py-3 bg-gradient-to-br from-pink-100 to-purple-100 border-2 border-pink-300 rounded-2xl text-sm font-black text-transparent bg-clip-text">
                  R{formData.discountPrice || 0}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-purple-400 uppercase tracking-widest mb-2">Total Stock</label>
              <input
                type="number"
                min="1"
                value={formData.stock || 1}
                onChange={(e) => handleFieldChange('stock', Number(e.target.value))}
                className="w-full px-4 py-3 bg-purple-50 border-2 border-purple-100 rounded-2xl text-sm font-semibold text-purple-900 focus:outline-none focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all"
              />
            </div>

            {errors.length > 0 && (
              <div className="p-4 bg-red-50 border-2 border-red-200 rounded-2xl space-y-1">
                {errors.map((err, i) => (
                  <p key={i} className="text-xs font-bold text-red-600">{err}</p>
                ))}
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4 border-t-2 border-purple-100">
              <button
                onClick={() => setFormData(null)}
                className="py-3 px-6 rounded-2xl text-sm font-bold text-purple-700 bg-white border-2 border-purple-100 hover:border-purple-300 transition-all"
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                className="py-3 px-6 rounded-2xl text-sm font-bold text-white transition-all"
                style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}
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
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      <div className="flex items-center gap-3">
        <button
          onClick={onCancel}
          className="p-2 hover:bg-purple-100 rounded-xl transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-purple-600" />
        </button>
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-purple-900">Upload Product Photos</h2>
          <p className="text-purple-400 text-sm font-semibold mt-1">Add up to 3 images for AI analysis</p>
        </div>
      </div>

      <div
        {...getRootProps()}
        className={cn(
          'border-3 border-dashed rounded-3xl p-12 sm:p-16 text-center transition-all cursor-pointer',
          isDragActive
            ? 'border-purple-500 bg-gradient-to-br from-purple-100 to-pink-100'
            : 'border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50 hover:border-purple-400'
        )}
      >
        <input {...getInputProps()} />
        <div className="space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-500 to-purple-600 shadow-lg">
            <Upload className="w-8 h-8 text-white" />
          </div>
          <div>
            <p className="text-purple-900 font-black text-base sm:text-lg">Drag & drop photos here</p>
            <p className="text-purple-400 text-sm font-semibold mt-2">or click to browse (up to 3 images)</p>
          </div>
        </div>
      </div>

      {previews.length > 0 && (
        <div className="space-y-4">
          <p className="text-sm font-bold text-purple-900">{previews.length} image{previews.length !== 1 ? 's' : ''} selected</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {previews.map((preview, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative group rounded-2xl overflow-hidden bg-purple-100 shadow-md border-2 border-purple-200"
              >
                <img src={preview} className="w-full h-32 object-cover" alt={`Preview ${i + 1}`} />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(i);
                  }}
                  className="absolute top-2 right-2 p-2 bg-black/70 hover:bg-black rounded-lg text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border-2 border-red-200 rounded-2xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm font-bold text-red-700">{error}</p>
        </div>
      )}

      {isAnalyzing && (
        <div className="bg-white rounded-3xl border-2 border-purple-100 p-6 shadow-sm">
          <div className="h-1 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full mb-6" />
          <p className="text-sm font-bold text-purple-900 mb-4">AI is analyzing...</p>
          <div className="space-y-3">
            {ANALYSIS_STEPS.map((step, idx) => (
              <motion.div
                key={step.id}
                animate={{ opacity: analysisStep >= idx ? 1 : 0.5 }}
                className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-purple-50 to-pink-50"
              >
                {analysisStep === idx ? (
                  <Loader2 className="w-4 h-4 text-purple-600 animate-spin flex-shrink-0" />
                ) : analysisStep > idx ? (
                  <div className="w-4 h-4 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex-shrink-0" />
                ) : (
                  <div className="w-4 h-4 rounded-full bg-purple-200 flex-shrink-0" />
                )}
                <span className={cn(
                  'text-sm font-bold transition-colors',
                  analysisStep === idx ? 'text-purple-900' : 'text-purple-400'
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
          whileHover={{ scale: 1.02, boxShadow: '0 20px 40px rgba(168, 85, 247, 0.2)' }}
          whileTap={{ scale: 0.98 }}
          onClick={handleAnalyze}
          className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-pink-500 to-purple-600 text-white font-black text-base shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
        >
          Analyze with AI
        </motion.button>
      )}
    </motion.div>
  );
}
