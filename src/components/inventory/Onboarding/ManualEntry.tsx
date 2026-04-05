import { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Upload, AlertCircle } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { AIIntakeResult } from './AIIntake';
import { ProductCondition } from '../../../types';

interface ManualEntryProps {
  onComplete: (data: AIIntakeResult) => void;
  onCancel: () => void;
}

const CATEGORIES = ['Electronics', 'Fashion', 'Home & Garden', 'Sports', 'Toys', 'Books', 'Other'];
const CONDITIONS: ProductCondition[] = ['New', 'Like New', 'Pre-owned', 'Refurbished'];

export default function ManualEntry({ onComplete, onCancel }: ManualEntryProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: CATEGORIES[0],
    condition: CONDITIONS[0],
    retailPrice: '',
    discountPrice: '',
    stock: '',
    imageUrl: '',
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be smaller than 5MB');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file');
      return;
    }

    setImageFile(file);
    setError(null);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.name.trim()) {
      setError('Product name is required');
      return;
    }
    if (!formData.description.trim()) {
      setError('Description is required');
      return;
    }
    if (!formData.retailPrice || isNaN(Number(formData.retailPrice))) {
      setError('Valid retail price is required');
      return;
    }
    if (!formData.discountPrice || isNaN(Number(formData.discountPrice))) {
      setError('Valid sale price is required');
      return;
    }
    if (!formData.stock || isNaN(Number(formData.stock)) || Number(formData.stock) < 1) {
      setError('Stock must be at least 1');
      return;
    }
    if (!imagePreview && !formData.imageUrl) {
      setError('Product image is required');
      return;
    }

    setLoading(true);

    try {
      let imageUrl = formData.imageUrl;

      // If user uploaded an image file, convert to base64
      if (imageFile && !imageUrl) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = (reader.result as string).split(',')[1];
            resolve(`data:${imageFile.type};base64,${result}`);
          };
          reader.onerror = reject;
          reader.readAsDataURL(imageFile);
        });
        imageUrl = base64;
      }

      // Submit product data
      const retailPrice = Number(formData.retailPrice);
      const discountPrice = Number(formData.discountPrice);
      const markdownPercentage = Math.round(((retailPrice - discountPrice) / retailPrice) * 100);

      onComplete({
        name: formData.name,
        description: formData.description,
        category: formData.category,
        condition: formData.condition as ProductCondition,
        retailPrice: retailPrice,
        discountPrice: discountPrice,
        markdownPercentage: markdownPercentage,
        stock: Number(formData.stock),
        imageUrl: imageUrl,
        imageUrls: [imageUrl], // Support multiple images in future
        confidenceScore: 100, // Manual entry is 100% confident
      });
    } catch (err: any) {
      setError(err.message || 'Failed to process image');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onCancel}
          className="p-2 hover:bg-purple-100 rounded-xl transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-purple-600" />
        </button>
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-purple-900">Manual Entry</h2>
          <p className="text-purple-400 text-sm font-semibold mt-1">Enter product details to add to inventory</p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Image Upload */}
        <div className="bg-white rounded-3xl border-2 border-purple-100 overflow-hidden shadow-sm">
          <div className="h-2 bg-gradient-to-r from-pink-500 to-purple-600" />
          <div className="p-6 sm:p-8 space-y-4">
            <h3 className="text-lg font-black text-purple-900">Product Image</h3>

            {imagePreview ? (
              <div className="relative">
                <img src={imagePreview} alt="Preview" className="w-full h-48 rounded-2xl object-cover shadow-md" />
                <button
                  type="button"
                  onClick={() => {
                    setImagePreview(null);
                    setImageFile(null);
                  }}
                  className="absolute top-2 right-2 bg-red-500 text-white px-3 py-1 rounded-lg text-xs font-bold hover:bg-red-600"
                >
                  Remove
                </button>
              </div>
            ) : (
              <label className="block cursor-pointer">
                <div className="border-2 border-dashed border-purple-200 rounded-2xl p-8 text-center hover:border-purple-300 transition-colors">
                  <Upload className="w-8 h-8 text-purple-400 mx-auto mb-2" />
                  <p className="text-purple-600 text-sm font-bold">Click to upload image or drag and drop</p>
                  <p className="text-purple-300 text-xs mt-1">PNG, JPG up to 5MB</p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>

        {/* Basic Details */}
        <div className="bg-white rounded-3xl border-2 border-purple-100 overflow-hidden shadow-sm">
          <div className="h-2 bg-gradient-to-r from-pink-500 to-purple-600" />
          <div className="p-6 sm:p-8 space-y-4">
            <h3 className="text-lg font-black text-purple-900">Product Details</h3>

            <div>
              <label className="block text-xs font-bold text-purple-400 uppercase tracking-widest mb-2">Product Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Wireless Headphones"
                className="w-full px-4 py-3 rounded-xl border-2 border-purple-100 focus:border-purple-300 focus:outline-none text-purple-900 placeholder-purple-300 font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-purple-400 uppercase tracking-widest mb-2">Description *</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe the product, condition, and any notable features..."
                rows={4}
                className="w-full px-4 py-3 rounded-xl border-2 border-purple-100 focus:border-purple-300 focus:outline-none text-purple-900 placeholder-purple-300 font-semibold resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-purple-400 uppercase tracking-widest mb-2">Category *</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border-2 border-purple-100 focus:border-purple-300 focus:outline-none text-purple-900 font-semibold"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-purple-400 uppercase tracking-widest mb-2">Condition *</label>
                <select
                  value={formData.condition}
                  onChange={(e) => setFormData({ ...formData, condition: e.target.value as ProductCondition })}
                  className="w-full px-4 py-3 rounded-xl border-2 border-purple-100 focus:border-purple-300 focus:outline-none text-purple-900 font-semibold"
                >
                  {CONDITIONS.map(cond => (
                    <option key={cond} value={cond}>{cond}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Pricing & Stock */}
        <div className="bg-white rounded-3xl border-2 border-purple-100 overflow-hidden shadow-sm">
          <div className="h-2 bg-gradient-to-r from-amber-500 to-orange-600" />
          <div className="p-6 sm:p-8 space-y-4">
            <h3 className="text-lg font-black text-purple-900">Pricing & Stock</h3>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-purple-400 uppercase tracking-widest mb-2">Retail Price (R) *</label>
                <input
                  type="number"
                  value={formData.retailPrice}
                  onChange={(e) => setFormData({ ...formData, retailPrice: e.target.value })}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  className="w-full px-4 py-3 rounded-xl border-2 border-purple-100 focus:border-purple-300 focus:outline-none text-purple-900 placeholder-purple-300 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-purple-400 uppercase tracking-widest mb-2">Sale Price (R) *</label>
                <input
                  type="number"
                  value={formData.discountPrice}
                  onChange={(e) => setFormData({ ...formData, discountPrice: e.target.value })}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  className="w-full px-4 py-3 rounded-xl border-2 border-purple-100 focus:border-purple-300 focus:outline-none text-purple-900 placeholder-purple-300 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-purple-400 uppercase tracking-widest mb-2">Stock *</label>
                <input
                  type="number"
                  value={formData.stock}
                  onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                  placeholder="0"
                  min="1"
                  className="w-full px-4 py-3 rounded-xl border-2 border-purple-100 focus:border-purple-300 focus:outline-none text-purple-900 placeholder-purple-300 font-semibold"
                />
              </div>
            </div>

            {formData.retailPrice && formData.discountPrice && (
              <div className="pt-2 border-t border-purple-100">
                <p className="text-xs text-purple-400 font-bold uppercase tracking-widest mb-1">Discount</p>
                <p className="text-lg font-black text-purple-900">
                  {Math.round((1 - Number(formData.discountPrice) / Number(formData.retailPrice)) * 100)}% off
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-3 p-4 bg-red-50 border-2 border-red-200 rounded-2xl"
          >
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-red-700 text-sm font-bold">{error}</p>
          </motion.div>
        )}

        {/* Submit */}
        <div className="flex flex-col-reverse sm:flex-row gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="py-3 px-6 rounded-2xl text-sm font-bold text-purple-700 bg-white border-2 border-purple-100 hover:border-purple-300 transition-all"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="py-3 px-6 rounded-2xl text-sm font-bold text-white disabled:opacity-60 transition-all"
            style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}
          >
            {loading ? 'Processing...' : 'Review Product'}
          </button>
        </div>
      </form>
    </div>
  );
}
