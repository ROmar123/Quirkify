import { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Upload, AlertCircle } from 'lucide-react';
import { AIIntakeResult } from './AIIntake';
import { ProductCondition } from '../../../types';
import { uploadFile } from '../../../services/storageService';

interface ManualEntryProps {
  onComplete: (data: AIIntakeResult) => void;
  onCancel: () => void;
}

const CATEGORIES = ['Sneakers', 'Clothing', 'Accessories', 'Electronics', 'Collectibles', 'Other'];
const CONDITIONS: ProductCondition[] = ['New', 'Like New', 'Pre-owned', 'Refurbished'];

export default function ManualEntry({ onComplete, onCancel }: ManualEntryProps) {
  const [formData, setFormData] = useState({
    name: '', description: '', category: CATEGORIES[0], condition: CONDITIONS[0],
    retailPrice: '', discountPrice: '', stock: '', imageUrl: '',
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError('Image must be smaller than 5MB'); return; }
    if (!file.type.startsWith('image/')) { setError('Please select a valid image file'); return; }
    setImageFile(file);
    setError(null);
    const reader = new FileReader();
    reader.onload = e => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!formData.name.trim()) { setError('Product name is required'); return; }
    if (!formData.description.trim()) { setError('Description is required'); return; }
    if (!formData.retailPrice || isNaN(Number(formData.retailPrice))) { setError('Valid retail price is required'); return; }
    if (!formData.discountPrice || isNaN(Number(formData.discountPrice))) { setError('Valid sale price is required'); return; }
    if (!formData.stock || isNaN(Number(formData.stock)) || Number(formData.stock) < 1) { setError('Stock must be at least 1'); return; }
    if (!imagePreview && !formData.imageUrl) { setError('Product image is required'); return; }

    setLoading(true);
    try {
      let imageUrl = formData.imageUrl;
      if (imageFile) {
        const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        imageUrl = await uploadFile(`products/${tempId}/primary.jpg`, imageFile);
      }

      const retailPrice = Number(formData.retailPrice);
      const discountPrice = Number(formData.discountPrice);
      const markdownPercentage = Math.round(((retailPrice - discountPrice) / retailPrice) * 100);

      onComplete({
        name: formData.name, description: formData.description, category: formData.category,
        condition: formData.condition as ProductCondition, retailPrice, discountPrice,
        markdownPercentage, stock: Number(formData.stock),
        imageUrl, imageUrls: [imageUrl], confidenceScore: 1,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to process image');
    } finally {
      setLoading(false);
    }
  };

  const discountPct = formData.retailPrice && formData.discountPrice
    ? Math.round((1 - Number(formData.discountPrice) / Number(formData.retailPrice)) * 100)
    : null;

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center gap-3">
        <button onClick={onCancel} className="btn-secondary p-2">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Manual entry</h2>
          <p className="text-gray-400 text-sm mt-0.5">Enter product details manually</p>
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
                <img src={imagePreview} alt="Preview" className="w-full h-44 rounded-xl object-cover" />
                <button type="button" onClick={() => { setImagePreview(null); setImageFile(null); }}
                  className="absolute top-2 right-2 bg-white text-gray-700 text-xs font-semibold px-2.5 py-1 rounded-full shadow-sm border border-gray-100 hover:bg-red-50 hover:text-red-600 transition-colors">
                  Remove
                </button>
              </div>
            ) : (
              <label className="block cursor-pointer">
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-gray-300 hover:bg-gray-50 transition-all">
                  <Upload className="w-7 h-7 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-600">Click to upload</p>
                  <p className="text-xs text-gray-400 mt-0.5">PNG, JPG up to 5MB</p>
                </div>
                <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
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
              <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Wireless Headphones" className="input" />
            </div>
            <div>
              <label className="section-label block mb-1.5">Description *</label>
              <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Describe the product, condition, and features…" rows={3} className="input resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="section-label block mb-1.5">Category *</label>
                <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} className="input">
                  {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              <div>
                <label className="section-label block mb-1.5">Condition *</label>
                <select value={formData.condition} onChange={e => setFormData({ ...formData, condition: e.target.value as ProductCondition })} className="input">
                  {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-green-400 to-teal-500" />
          <div className="p-5 space-y-4">
            <p className="section-label">Pricing &amp; stock</p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="section-label block mb-1.5">Retail (R) *</label>
                <input type="number" value={formData.retailPrice} onChange={e => setFormData({ ...formData, retailPrice: e.target.value })} placeholder="0.00" min="0" step="0.01" className="input" />
              </div>
              <div>
                <label className="section-label block mb-1.5">Sale (R) *</label>
                <input type="number" value={formData.discountPrice} onChange={e => setFormData({ ...formData, discountPrice: e.target.value })} placeholder="0.00" min="0" step="0.01" className="input" />
              </div>
              <div>
                <label className="section-label block mb-1.5">Stock *</label>
                <input type="number" value={formData.stock} onChange={e => setFormData({ ...formData, stock: e.target.value })} placeholder="1" min="1" className="input" />
              </div>
            </div>
            {discountPct !== null && discountPct > 0 && (
              <p className="text-xs font-semibold text-green-600">{discountPct}% off retail</p>
            )}
          </div>
        </div>

        {error && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="flex gap-3 p-4 bg-red-50 border border-red-100 rounded-xl">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </motion.div>
        )}

        <div className="flex flex-col-reverse sm:flex-row gap-3">
          <button type="button" onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
          <button type="submit" disabled={loading} className="btn-primary flex-1 disabled:opacity-60">
            {loading ? 'Processing…' : 'Review product'}
          </button>
        </div>
      </form>
    </div>
  );
}
