import { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Upload, AlertCircle, Sparkles } from 'lucide-react';
import { AIIntakeResult } from './AIIntake';
import { ProductCondition } from '../../../types';
import { uploadFile } from '../../../services/storageService';

const CATEGORIES = ['Sneakers', 'Clothing', 'Accessories', 'Electronics', 'Collectibles', 'Other'];
const CONDITIONS: ProductCondition[] = ['New', 'Like New', 'Pre-owned', 'Refurbished'];

// Default markdowns by condition — agentic suggestion
const CONDITION_MARKDOWNS: Partial<Record<ProductCondition, number>> = {
  'New': 0,
  'Like New': 15,
  'Pre-owned': 30,
  'Refurbished': 40,
};

interface ManualEntryProps {
  onComplete: (data: AIIntakeResult) => void;
  onCancel: () => void;
}

export default function ManualEntry({ onComplete, onCancel }: ManualEntryProps) {
  const [form, setForm] = useState({
    name: '', description: '', category: CATEGORIES[0],
    condition: CONDITIONS[0] as ProductCondition,
    retailPrice: '', markdownPercentage: String(CONDITION_MARKDOWNS[CONDITIONS[0]]),
    stock: '',
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const retail = parseFloat(form.retailPrice) || 0;
  const markdown = parseFloat(form.markdownPercentage) || 0;
  const salePrice = retail > 0 ? Math.round(retail * (1 - markdown / 100)) : 0;
  const saving = retail > 0 && salePrice < retail ? `Save ${markdown}% · R${retail - salePrice} off` : null;

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
    const reader = new FileReader();
    reader.onload = e => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) { setError('Product name is required'); return; }
    if (!form.description.trim()) { setError('Description is required'); return; }
    if (!form.retailPrice || retail <= 0) { setError('Retail price must be greater than 0'); return; }
    if (!form.stock || parseInt(form.stock) < 1) { setError('Stock must be at least 1'); return; }
    if (!imagePreview) { setError('Product image is required'); return; }

    setLoading(true);
    try {
      const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const imageUrl = imageFile
        ? await uploadFile(`products/${tempId}/primary.jpg`, imageFile)
        : imagePreview;

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
    } catch (err: any) {
      setError(err.message || 'Failed to upload image');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onCancel} className="btn-secondary p-2.5">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-gray-900 tracking-tight">Manual entry</h2>
          <p className="text-gray-400 text-sm">Fill in product details to create a listing</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Image */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-amber-400 to-orange-500" />
          <div className="p-5">
            <p className="section-label mb-3">Product image *</p>
            {imagePreview ? (
              <div className="relative">
                <img src={imagePreview} alt="Preview" className="w-full h-48 rounded-xl object-cover" />
                <button type="button"
                  onClick={() => { setImagePreview(null); setImageFile(null); }}
                  className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm text-gray-700 text-xs font-semibold px-3 py-1.5 rounded-full shadow-sm border border-gray-100 hover:bg-red-50 hover:text-red-600 transition-colors">
                  Remove
                </button>
              </div>
            ) : (
              <label className="block cursor-pointer">
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-10 text-center hover:border-purple-200 hover:bg-purple-50/30 transition-all group">
                  <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-3 group-hover:scale-105 transition-transform">
                    <Upload className="w-5 h-5 text-gray-400" />
                  </div>
                  <p className="text-sm font-semibold text-gray-700">Click to upload photo</p>
                  <p className="text-xs text-gray-400 mt-1">PNG, JPG · max 5MB</p>
                </div>
                <input type="file" accept="image/*" onChange={handleImage} className="hidden" />
              </label>
            )}
          </div>
        </div>

        {/* Details */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-pink-500 to-purple-600" />
          <div className="p-5 space-y-4">
            <p className="section-label">Product details</p>
            <div>
              <label className="section-label block mb-1.5">Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Vintage Denim Jacket" className="input" />
            </div>
            <div>
              <label className="section-label block mb-1.5">Description *</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Describe the product, key features, and condition details…" rows={3} className="input resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="section-label block mb-1.5">Category *</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="input">
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="section-label block mb-1.5">Condition *</label>
                <select value={form.condition} onChange={e => setCondition(e.target.value as ProductCondition)} className="input">
                  {CONDITIONS.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Pricing — same structure as AI intake */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-emerald-400 to-teal-500" />
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="section-label">Pricing &amp; stock</p>
              {form.condition !== 'New' && (
                <div className="flex items-center gap-1.5 text-[10px] text-purple-600 font-semibold">
                  <Sparkles className="w-3 h-3" />
                  Markdown auto-set for {form.condition}
                </div>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="section-label block mb-1.5">Retail (R) *</label>
                <input type="number" value={form.retailPrice}
                  onChange={e => setForm(f => ({ ...f, retailPrice: e.target.value }))}
                  placeholder="0" min="0" step="1" className="input" />
              </div>
              <div>
                <label className="section-label block mb-1.5">Markdown %</label>
                <input type="number" value={form.markdownPercentage}
                  onChange={e => setForm(f => ({ ...f, markdownPercentage: e.target.value }))}
                  placeholder="0" min="0" max="100" className="input" />
              </div>
              <div>
                <label className="section-label block mb-1.5">Sale price</label>
                <div className={`input flex items-center font-bold ${salePrice > 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'text-gray-400'}`}>
                  R{salePrice || '—'}
                </div>
              </div>
            </div>
            {saving && (
              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                className="text-xs font-semibold text-emerald-600">
                {saving}
              </motion.p>
            )}
            <div>
              <label className="section-label block mb-1.5">Stock *</label>
              <input type="number" value={form.stock}
                onChange={e => setForm(f => ({ ...f, stock: e.target.value }))}
                placeholder="1" min="1" className="input" />
            </div>
          </div>
        </div>

        {error && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
            className="flex gap-3 p-4 bg-red-50 border border-red-100 rounded-xl">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </motion.div>
        )}

        <div className="flex flex-col-reverse sm:flex-row gap-3">
          <button type="button" onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
          <button type="submit" disabled={loading} className="btn-primary flex-1 disabled:opacity-60 justify-center">
            {loading ? (
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                className="w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
            ) : 'Review product'}
          </button>
        </div>
      </form>
    </div>
  );
}
