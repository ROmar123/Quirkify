import { useState, useEffect } from 'react';
import { Product, ProductCondition, AllocationSnapshot } from '../../../types';
import { fetchProduct, updateProduct } from '../../../services/productService';
import { ArrowLeft, Save, Edit2 } from 'lucide-react';
import { cn } from '../../../lib/utils';
import AllocationEditor from '../Shared/AllocationEditor';
import { validateProduct, calculateSellingPrice } from '../Shared/StockValidator';

interface ProductEditorProps {
  productId: string;
  onBack?: () => void;
}

export default function ProductEditor({ productId, onBack }: ProductEditorProps) {
  const [product, setProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<Partial<Product> | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Load product
  useEffect(() => {
    const loadProduct = async () => {
      try {
        const data = await fetchProduct(productId);
        if (data) {
          setProduct(data);
          setFormData(data);
        } else {
          setError('Product not found');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load product');
      } finally {
        setLoading(false);
      }
    };

    loadProduct();
  }, [productId]);

  const handleFieldChange = (key: keyof Product, value: any) => {
    if (!formData) return;
    const updated = { ...formData, [key]: value };

    // Auto-calculate discount price if retail/markdown changed
    if (key === 'retailPrice' || key === 'markdownPercentage') {
      const retail = key === 'retailPrice' ? value : formData.retailPrice || 0;
      const markdown = key === 'markdownPercentage' ? value : formData.markdownPercentage || 40;
      updated.discountPrice = calculateSellingPrice(retail, markdown);
    }

    setFormData(updated);
  };

  const handleAllocationChange = (allocations: AllocationSnapshot) => {
    if (!formData) return;
    setFormData({ ...formData, allocations });
  };

  // Check if allocations are valid
  const isAllocationValid = () => {
    if (!formData || !formData.allocations || !formData.stock) return false;
    const total = (formData.allocations.store || 0) +
                  (formData.allocations.auction || 0) +
                  (formData.allocations.packs || 0);
    return total <= formData.stock;
  };

  // Check if data has changed
  const hasChanges = formData && JSON.stringify(formData) !== JSON.stringify(product);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isEditing && hasChanges) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isEditing, hasChanges]);

  const handleSave = async () => {
    if (!formData || !product) return;

    setError(null);
    setValidationErrors([]);

    // Validate
    const validation = validateProduct(formData);
    if (!validation.isValid) {
      setValidationErrors(validation.errors.map(e => e.message));
      return;
    }

    setSaving(true);

    try {
      const updated = await updateProduct(productId, {
        name: formData.name,
        description: formData.description,
        category: formData.category,
        retailPrice: formData.retailPrice,
        markdownPercentage: formData.markdownPercentage,
        condition: formData.condition,
        stock: formData.stock,
        allocations: formData.allocations,
      });

      setProduct(updated);
      setFormData(updated);
      setIsEditing(false);
    } catch (err: any) {
      setError(err.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const conditions: ProductCondition[] = ['New', 'Like New', 'Pre-owned', 'Refurbished'];
  const inputClass = 'w-full px-4 py-2.5 bg-white border-2 border-purple-100 rounded-2xl text-sm font-semibold text-purple-800 focus:outline-none focus:border-purple-400 transition-colors';
  const labelClass = 'block text-xs font-bold text-purple-400 mb-1 uppercase tracking-widest';

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="h-96 bg-purple-50 animate-pulse rounded-3xl border border-purple-100" />
      </div>
    );
  }

  if (!product || !formData) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-purple-600 font-bold text-sm mb-6 hover:text-purple-700"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <div className="bg-white rounded-3xl border border-purple-100 p-8 text-center">
          <p className="text-purple-400 font-semibold">{error || 'Product not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <button
        onClick={() => {
          if (isEditing && hasChanges) {
            if (window.confirm('You have unsaved changes. Discard them?')) {
              onBack?.();
            }
          } else {
            onBack?.();
          }
        }}
        className="flex items-center gap-2 text-purple-600 font-bold text-sm mb-6 hover:text-purple-700"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <div className="bg-white rounded-3xl border-2 border-purple-100 shadow-sm overflow-hidden">
        {/* Header with Image */}
        <div className="relative h-64 bg-purple-50 border-b-2 border-purple-100 overflow-hidden">
          {isEditing ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-xs text-purple-400 font-bold uppercase tracking-widest mb-2">Product Image</p>
                <img src={formData.imageUrl} className="h-48 object-contain mx-auto" alt="" />
                <p className="text-[10px] text-purple-300 mt-2">Images cannot be changed. Delete and re-add product to change images.</p>
              </div>
            </div>
          ) : (
            <img src={product.imageUrl} className="w-full h-full object-contain" alt="" />
          )}
        </div>

        {/* Content */}
        <div className="p-8">
          {error && (
            <div className="mb-6 p-3 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-xs font-bold">
              {error}
            </div>
          )}

          {validationErrors.length > 0 && (
            <div className="mb-6 p-3 bg-red-50 border border-red-100 rounded-2xl">
              {validationErrors.map((err, i) => (
                <p key={i} className="text-xs text-red-600 font-bold mb-1">{err}</p>
              ))}
            </div>
          )}

          {/* Status Badge */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <span className={cn(
                'text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full',
                product.status === 'approved' ? 'text-green-600 bg-green-50' : 'text-amber-600 bg-amber-50'
              )}>
                {product.status}
              </span>
              {product.updatedAt && (
                <p className="text-[10px] text-purple-400 mt-2">Last updated: {new Date(product.updatedAt).toLocaleDateString()}</p>
              )}
            </div>
          </div>

          {/* Form */}
          <div className="space-y-6">
            {isEditing ? (
              <>
                {/* Product Details */}
                <div className="space-y-4">
                  <div>
                    <label className={labelClass}>Product Name</label>
                    <input
                      type="text"
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
                      rows={4}
                      className={cn(inputClass, 'resize-none')}
                      placeholder="Describe the item..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
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
                        onChange={(e) => handleFieldChange('condition', e.target.value as ProductCondition)}
                        className={inputClass}
                      >
                        {conditions.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
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

                {/* Allocations */}
                <div className="pt-6 border-t border-purple-100">
                  <h3 className="text-sm font-bold text-purple-900 mb-4">Stock Allocation</h3>
                  <AllocationEditor
                    totalStock={formData.stock || 1}
                    allocations={formData.allocations || { store: 0, auction: 0, packs: 0 }}
                    onChange={handleAllocationChange}
                    showPercentages={true}
                  />
                </div>
              </>
            ) : (
              <>
                {/* Display Mode */}
                <div>
                  <h2 className="text-2xl font-black text-purple-900 mb-2">{product.name}</h2>
                  <p className="text-purple-400 text-sm font-semibold">{product.category}</p>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="p-6 bg-purple-50 rounded-2xl border border-purple-100">
                    <h4 className="text-[8px] font-bold text-purple-400 uppercase tracking-widest mb-1">Pricing</h4>
                    <div className="flex items-baseline gap-2">
                      <p className="text-2xl font-black text-purple-900">R{product.discountPrice}</p>
                      <p className="text-sm text-purple-400 line-through">R{product.retailPrice}</p>
                      <p className="text-xs text-quirky font-bold">-{product.markdownPercentage}%</p>
                    </div>
                  </div>
                  <div className="p-6 bg-purple-50 rounded-2xl border border-purple-100">
                    <h4 className="text-[8px] font-bold text-purple-400 uppercase tracking-widest mb-1">Condition & Stock</h4>
                    <p className="text-xl font-black text-purple-900">{product.condition} • {product.stock} UNITS</p>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-2">Description</h4>
                  <p className="text-purple-600 text-sm leading-relaxed">{product.description}</p>
                </div>

                <div className="pt-6 border-t border-purple-100">
                  <h4 className="text-sm font-bold text-purple-900 mb-4">Stock Allocation</h4>
                  <AllocationEditor
                    totalStock={product.stock}
                    allocations={product.allocations}
                    onChange={() => {}}
                    disabled={true}
                    showPercentages={true}
                  />
                </div>
              </>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-8">
            {isEditing ? (
              <>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setFormData(product);
                    setValidationErrors([]);
                  }}
                  className="flex-1 py-3 rounded-2xl text-sm font-bold text-purple-700 bg-purple-50 border-2 border-purple-100 hover:border-purple-300 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !isAllocationValid()}
                  className="flex-1 py-3 rounded-2xl text-sm font-bold text-white disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}
                  title={!isAllocationValid() ? 'Fix allocations: total cannot exceed stock' : ''}
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                {!isAllocationValid() && (
                  <p className="text-xs text-red-600 font-bold mt-2">
                    ⚠️ Fix allocations: Total allocated ({(formData?.allocations?.store || 0) + (formData?.allocations?.auction || 0) + (formData?.allocations?.packs || 0)}) cannot exceed stock ({formData?.stock})
                  </p>
                )}
              </>
            ) : (
              <button
                onClick={() => {
                  setIsEditing(true);
                  setValidationErrors([]);
                }}
                className="w-full py-3 rounded-2xl text-sm font-bold text-white transition-all flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}
              >
                <Edit2 className="w-4 h-4" />
                Edit Product
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
