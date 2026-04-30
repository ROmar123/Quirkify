import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion } from 'motion/react';
import { Loader2, AlertCircle, X, ArrowLeft, Upload, CheckCircle2 } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { identifyProduct } from '../../../services/gemini';
import { mapToStandardCategory } from '../../../lib/categories';
import { ProductCondition } from '../../../types';
import { validateProduct, calculateSellingPrice } from '../Shared/StockValidator';
import { uploadFile } from '../../../services/storageService';

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
  { id: 'check', label: 'Analysing image' },
  { id: 'analyze', label: 'Identifying product' },
  { id: 'generate', label: 'Generating description' },
  { id: 'pricing', label: 'Calculating price' },
];

export default function AIIntake({ onComplete, onCancel }: AIIntakeProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [imageBase64s, setImageBase64s] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState<number>(-1);
  const [formData, setFormData] = useState<Partial<AIIntakeResult> | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const validFiles = acceptedFiles.filter(f => {
      if (f.size > 5 * 1024 * 1024) {
        setError(`${f.name} is too large (max 5MB)`);
        return false;
      }
      return true;
    });
    if (validFiles.length === 0) return;

    const newFiles = [...files, ...validFiles].slice(0, 3);
    setFiles(newFiles);
    const newPreviews = newFiles.map(f => URL.createObjectURL(f));
    setPreviews(newPreviews);

    const base64Array = await Promise.all(newFiles.map(f => new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(f);
    })));

    setImageBase64s(base64Array);
    setFormData(null);
    setError(null);
    setAnalysisStep(-1);
  }, [files]);

  useEffect(() => {
    return () => { previews.forEach(p => URL.revokeObjectURL(p)); };
  }, [previews]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'image/*': [] }, multiple: true, maxFiles: 3,
  });

  const removeFile = (index: number) => {
    URL.revokeObjectURL(previews[index]);
    const newFiles = files.filter((_, i) => i !== index);
    setFiles(newFiles);
    setPreviews(previews.filter((_, i) => i !== index));
  };

  const simulateProgress = async () => {
    for (let i = 0; i < ANALYSIS_STEPS.length; i++) {
      setAnalysisStep(i);
      await new Promise(r => setTimeout(r, 800));
    }
  };

  const handleAnalyze = async () => {
    if (imageBase64s.length === 0) { setError('Please select at least one image'); return; }
    setIsAnalyzing(true);
    setError(null);
    setErrors([]);
    try {
      await simulateProgress();
      setAnalysisStep(3);
      const analysis = await Promise.race([
        identifyProduct(imageBase64s[0]),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Analysis timed out')), 45000)),
      ]) as any;

      const retailPrice = analysis.retailPrice || analysis.priceRange?.max || 0;
      const markdownPercentage = 40;
      const discountPrice = calculateSellingPrice(retailPrice, markdownPercentage);
      const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      // Try Firebase Storage; fall back to embedded base64 data URL if unavailable
      let imageUrl: string;
      try {
        imageUrl = await uploadFile(`products/${tempId}/primary.jpg`, files[0]);
      } catch {
        imageUrl = `data:image/jpeg;base64,${imageBase64s[0]}`;
      }

      setFormData({
        ...analysis,
        category: mapToStandardCategory(analysis.category || ''),
        retailPrice,
        discountPrice,
        markdownPercentage,
        condition: 'New' as ProductCondition,
        stock: 1,
        imageUrl,
        imageUrls: [imageUrl],
      });
      setAnalysisStep(-1);
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Analysis failed. Please try again.');
      setFormData(null);
      setAnalysisStep(-1);
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
    if (!validation.isValid) { setErrors(validation.errors.map(e => e.message)); return; }
    setErrors([]);
    onComplete(formData as AIIntakeResult);
  };

  if (formData) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 max-w-2xl">
        <div className="flex items-center gap-3">
          <button onClick={() => setFormData(null)} className="btn-secondary p-2">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Verify AI analysis</h2>
            <p className="text-gray-400 text-sm mt-0.5">Review and edit the details before continuing</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-pink-500 to-purple-600" />
          <div className="p-6 border-b border-gray-100">
            <div className="flex gap-5">
              {previews[0] && (
                <img src={previews[0]} className="w-24 h-24 rounded-xl object-cover flex-shrink-0 border border-gray-100" alt="" />
              )}
              <div>
                <p className="section-label mb-2">AI Confidence</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(formData.confidenceScore ?? 0) * 100}%` }}
                      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                      className={cn('h-full rounded-full', (formData.confidenceScore ?? 0) > 0.8 ? 'bg-green-500' : 'bg-amber-400')}
                    />
                  </div>
                  <span className={cn('text-sm font-bold', (formData.confidenceScore ?? 0) > 0.8 ? 'text-green-600' : 'text-amber-600')}>
                    {Math.round((formData.confidenceScore ?? 0) * 100)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <label className="section-label block mb-1.5">Product Name</label>
              <input type="text" value={formData.name || ''} onChange={e => handleFieldChange('name', e.target.value)} className="input" placeholder="e.g. Vintage Denim Jacket" />
            </div>
            <div>
              <label className="section-label block mb-1.5">Description</label>
              <textarea value={formData.description || ''} onChange={e => handleFieldChange('description', e.target.value)} rows={3} className="input resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="section-label block mb-1.5">Category</label>
                <select value={formData.category || ''} onChange={e => handleFieldChange('category', e.target.value)} className="input">
                  <option value="">Select…</option>
                  {['Sneakers','Clothing','Accessories','Electronics','Collectibles','Other'].map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="section-label block mb-1.5">Condition</label>
                <select value={formData.condition || 'New'} onChange={e => handleFieldChange('condition', e.target.value)} className="input">
                  {['New','Like New','Pre-owned','Refurbished'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="section-label block mb-1.5">Retail (R)</label>
                <input type="number" value={formData.retailPrice || ''} onChange={e => handleFieldChange('retailPrice', Number(e.target.value))} className="input" />
              </div>
              <div>
                <label className="section-label block mb-1.5">Markdown %</label>
                <input type="number" value={formData.markdownPercentage || 40} onChange={e => handleFieldChange('markdownPercentage', Number(e.target.value))} className="input" />
              </div>
              <div>
                <label className="section-label block mb-1.5">Sale Price</label>
                <div className="input bg-green-50 border-green-200 font-bold text-green-700 flex items-center">R{formData.discountPrice || 0}</div>
              </div>
            </div>
            <div>
              <label className="section-label block mb-1.5">Stock</label>
              <input type="number" min="1" value={formData.stock || 1} onChange={e => handleFieldChange('stock', Number(e.target.value))} className="input" />
            </div>

            {errors.length > 0 && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-xl space-y-1">
                {errors.map((e, i) => <p key={i} className="text-xs text-red-600">{e}</p>)}
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2 border-t border-gray-100">
              <button onClick={() => setFormData(null)} className="btn-secondary flex-1">Back</button>
              <button onClick={handleSubmit} className="btn-primary flex-1">Continue</button>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onCancel} className="btn-secondary p-2">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Upload product photos</h2>
          <p className="text-gray-400 text-sm mt-0.5">Up to 3 images for AI analysis</p>
        </div>
      </div>

      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer',
          isDragActive ? 'border-quirky bg-purple-50/40' : 'border-gray-200 bg-gray-50/50 hover:border-gray-300 hover:bg-gray-50'
        )}
      >
        <input {...getInputProps()} />
        <div className="w-12 h-12 rounded-xl bg-white border border-gray-100 flex items-center justify-center mx-auto mb-4 shadow-sm">
          <Upload className="w-6 h-6 text-gray-400" />
        </div>
        <p className="text-sm font-semibold text-gray-700">Drag &amp; drop photos here</p>
        <p className="text-xs text-gray-400 mt-1">or click to browse · up to 3 images · max 5MB each</p>
      </div>

      {previews.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {previews.map((preview, i) => (
            <motion.div key={i} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              className="relative group rounded-xl overflow-hidden border border-gray-100">
              <img src={preview} className="w-full h-28 object-cover" alt="" />
              <button
                onClick={e => { e.stopPropagation(); removeFile(i); }}
                className="absolute top-1.5 right-1.5 w-6 h-6 bg-white/90 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
              >
                <X className="w-3 h-3 text-gray-600" />
              </button>
            </motion.div>
          ))}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-xl">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {isAnalyzing && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-pink-500 to-purple-600" />
          <div className="p-5 space-y-3">
            <p className="text-sm font-semibold text-gray-800">Analysing with AI…</p>
            {ANALYSIS_STEPS.map((step, idx) => (
              <div key={step.id} className={cn('flex items-center gap-3 text-sm transition-colors', analysisStep >= idx ? 'text-gray-800' : 'text-gray-300')}>
                {analysisStep > idx ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                ) : analysisStep === idx ? (
                  <Loader2 className="w-4 h-4 text-quirky animate-spin flex-shrink-0" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-gray-200 flex-shrink-0" />
                )}
                <span className={analysisStep >= idx ? 'font-medium' : ''}>{step.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isAnalyzing && previews.length > 0 && !formData && (
        <button onClick={handleAnalyze} className="btn-primary w-full justify-center py-3.5">
          Analyse with AI
        </button>
      )}
    </motion.div>
  );
}
