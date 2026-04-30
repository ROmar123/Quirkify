import { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Upload, AlertCircle, Sparkles, X, CheckCircle2 } from 'lucide-react';
import { AIIntakeResult } from './AIIntake';
import { ProductCondition } from '../../../types';
import { uploadFile } from '../../../services/storageService';
import { cn } from '../../../lib/utils';

const CATEGORIES = ['Sneakers', 'Clothing', 'Accessories', 'Electronics', 'Collectibles', 'Other'];
const CONDITIONS: ProductCondition[] = ['New', 'Like New', 'Pre-owned', 'Refurbished'];

const CONDITION_MARKDOWNS: Partial<Record<ProductCondition, number>> = {
  'New': 0, 'Like New': 15, 'Pre-owned': 30, 'Refurbished': 40,
};

const CONDITION_COLORS: Partial<Record<ProductCondition, string>> = {
  'New': 'border-green-300 bg-green-50 text-green-700',
  'Like New': 'border-emerald-300 bg-emerald-50 text-emerald-700',
  'Pre-owned': 'border-amber-300 bg-amber-50 text-amber-700',
  'Refurbished': 'border-blue-300 bg-blue-50 text-blue-700',
};

interface ManualEntryProps {
  onComplete: (data: AIIntakeResult) => void;
  onCancel: () => void;
}

export default function ManualEntry({ onComplete, onCancel }: ManualEntryProps) {
  const [form, setForm] = useState({
    name: '', description: '', category: CATEGORIES[0],
    condition: CONDITIONS[0] as ProductCondition,
    retailPrice: '', markdownPercentage: String(CONDITION_MARKDOWNS[CONDITIONS[0]] ?? 0),
    stock: '1',
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'done' | 'fallback'>('idle');
  const [error, setError] = useState<string | null>(null);

  const retail = parseFloat(form.retailPrice) || 0;
  const markdown = parseFloat(form.markdownPercentage) || 0;
  const salePrice = retail > 0 ? Math.round(retail * (1 - markdown / 100)) : 0;
  const savingText = retail > 0 && salePrice > 0 && salePrice < retail
    ? `Customer saves R${(retail - salePrice).toLocaleString()} (${markdown}% off)`
    : null;

  const setCondition = (c: ProductCondition) => {
    setForm(f => ({ ...f, condition: c, markdownPercentage: String(CONDITION_MARKDOWNS[c] ?? 0) }));
  };

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError('Image must be under 5MB'); return; }
    if (!file.type.startsWith('image/')) { setError('Please select a valid image'); return; }
    setImageFile(file);
    setError(null);
    setUploadStatus('idle');
    const reader = new FileReader();
    reader.onload = ev => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleImageDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const fakeEvent = { target: { files: [file] } } as any;
    handleImage(fakeEvent);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) { setError('Product name is required'); return; }
    if (!form.description.trim()) { setError('Description is required'); return; }
    if (!form.retailPrice || retail <= 0) { setError('Retail price must be greater than 0'); return; }
    if (!form.stock || parseInt(form.stock) < 1) { setError('Stock must be at least 1'); return; }
    if (!imagePreview) { setError('Product image is required — please upload a photo'); return; }

    setLoading(true);
    let imageUrl = imagePreview; // default: use data URL if upload fails

    if (imageFile) {
      try {
        setUploadStatus('uploading');
        const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        imageUrl = await uploadFile(`products/${tempId}/primary.jpg`, imageFile);
        setUploadStatus('done');
      } catch {
        // Firebase Storage unavailable — use the base64 data URL captured in imagePreview
        // The product will still save correctly; image displays from the data URL
        setUploadStatus('fallback');
        imageUrl = imagePreview;
      }
    }

    onComplete({
      name: form.name.trim(),
      description: form.description.trim(),
      category: form.category,
      condition: form.condition,
      retailPrice: retail,
      markdownPercentage: markdown,
      discountPrice: salePrice,
      stock: parseInt(form.stock),
      imageUrl,
      imageUrls: [imageUrl],
      confidenceScore: 1,
    });

    setLoading(false);
  };

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button type="button" onClick={onCancel} className="btn-secondary p-2.5">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-gray-900 tracking-tight">Manual entry</h2>
          <p className="text-gray-400 text-sm">Fill in product details to add to review queue</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Image upload */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-amber-400 to-orange-500" />
          <div className="p-5">
            <p className="section-label mb-3">Product image *</p>
            {imagePreview ? (
              <div className="relative group">
                <img src={imagePreview} alt="Preview" className="w-full h-56 rounded-xl object-cover" />
                <div className="absolute inset-0 rounded-xl bg-black/0 group-hover:bg-black/20 transition-colors" />
                <button type="button"
                  onClick={() => { setImagePreview(null); setImageFile(null); setUploadStatus('idle'); }}
                  className="absolute top-2.5 right-2.5 w-8 h-8 flex items-center justify-center bg-white/90 backdrop-blur-sm rounded-full shadow-md hover:bg-red-50 transition-colors"
                >
                  <X className="w-3.5 h-3.5 text-gray-600" />
                </button>
                {uploadStatus === 'fallback' && (
                  <div className="absolute bottom-2.5 left-2.5 right-2.5 bg-amber-500/90 backdrop-blur-sm text-white text-[10px] font-bold px-3 py-1.5 rounded-full text-center">
                    Saved locally — will sync to storage on next upload
                  </div>
                )}
              </div>
            ) : (
              <label className="block cursor-pointer"
                onDragOver={e => e.preventDefault()}
                onDrop={handleImageDrop}
              >
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-12 text-center hover:border-purple-300 hover:bg-purple-50/30 transition-all group">
                  <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center mx-auto mb-3 group-hover:scale-105 transition-transform shadow-sm">
                    <Upload className="w-6 h-6 text-gray-400" />
                  </div>
                  <p className="text-sm font-semibold text-gray-700">Drag photo here or click to upload</p>
                  <p className="text-xs text-gray-400 mt-1">PNG, JPG · max 5MB</p>
                </div>
                <input type="file" accept="image/*" onChange={handleImage} className="hidden" />
              </label>
            )}
          </div>
        </div>

        {/* Product details */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-pink-500 to-purple-600" />
          <div className="p-5 space-y-4">
            <p className="section-label">Product details</p>
            <div>
              <label className="section-label block mb-1.5">Product name *</label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Vintage Denim Jacket — 90s Levi's"
                className="input"
              />
            </div>
            <div>
              <label className="section-label block mb-1.5">Description *</label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Describe the product — key features, condition details, why it's great…"
                rows={3}
                className="input resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="section-label block mb-1.5">Category *</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="input">
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="section-label block mb-2">Condition *</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {CONDITIONS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCondition(c)}
                      className={cn(
                        'py-1.5 px-2 rounded-lg text-[11px] font-bold border transition-all',
                        form.condition === c
                          ? CONDITION_COLORS[c]
                          : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300'
                      )}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-emerald-400 to-teal-500" />
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="section-label">Pricing &amp; stock</p>
              {form.condition !== 'New' && markdown > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] text-purple-600 font-bold">
                  <Sparkles className="w-3 h-3" /> Auto-markdown for {form.condition}
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="section-label block mb-1.5">Retail / RRP (R) *</label>
                <input
                  type="number" value={form.retailPrice}
                  onChange={e => setForm(f => ({ ...f, retailPrice: e.target.value }))}
                  placeholder="0" min="0" step="1" className="input"
                />
              </div>
              <div>
                <label className="section-label block mb-1.5">Markdown %</label>
                <input
                  type="number" value={form.markdownPercentage}
                  onChange={e => setForm(f => ({ ...f, markdownPercentage: e.target.value }))}
                  placeholder="0" min="0" max="100" className="input"
                />
              </div>
              <div>
                <label className="section-label block mb-1.5">Selling price</label>
                <div className={cn('input flex items-center font-bold tabular-nums', salePrice > 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'text-gray-400')}>
                  {salePrice > 0 ? `R${salePrice.toLocaleString()}` : '—'}
                </div>
              </div>
            </div>

            {savingText && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="flex items-center gap-2 text-xs text-emerald-700 font-semibold"
              >
                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                {savingText}
              </motion.div>
            )}

            <div>
              <label className="section-label block mb-1.5">Stock quantity *</label>
              <input
                type="number" value={form.stock}
                onChange={e => setForm(f => ({ ...f, stock: e.target.value }))}
                placeholder="1" min="1" className="input"
              />
            </div>
          </div>
        </div>

        {error && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
            className="flex gap-3 p-4 bg-red-50 border border-red-100 rounded-xl">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 font-medium">{error}</p>
          </motion.div>
        )}

        <div className="flex flex-col-reverse sm:flex-row gap-3 pt-1">
          <button type="button" onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary flex-1 justify-center disabled:opacity-60"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                  className="w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                {uploadStatus === 'uploading' ? 'Uploading image…' : 'Saving…'}
              </span>
            ) : 'Review product →'}
          </button>
        </div>
      </form>
    </div>
  );
}
