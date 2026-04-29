import { useState, useEffect } from 'react';
import { Product, ProductCondition, AllocationSnapshot } from '../../../types';
import { fetchProduct, updateProduct } from '../../../services/productService';
import { ArrowLeft, Save, Edit2, AlertCircle } from 'lucide-react';
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

  const isAllocationValid = () => {
    if (!formData || !formData.allocations || !formData.stock) return false;
    const total = (formData.allocations.store || 0) + (formData.allocations.auction || 0) + (formData.allocations.packs || 0);
    return total <= formData.stock;
  };

  const hasChanges = formData && JSON.stringify(formData) !== JSON.stringify(product);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isEditing && hasChanges) { e.preventDefault(); e.returnValue = ''; return ''; }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isEditing, hasChanges]);

  const handleSave = async () => {
    if (!formData || !product) return;
    setError(null);
    setValidationErrors([]);
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
        listingType: formData.listingType,
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

  const CHANNEL_BADGE: Record<string, { label: string; bg: string; text: string }> = {
    store:   { label: 'Store',           bg: 'bg-indigo-50',  text: 'text-indigo-700' },
    auction: { label: 'Auction',         bg: 'bg-amber-50',   text: 'text-amber-700'  },
    both:    { label: 'Store + Auction', bg: 'bg-purple-50',  text: 'text-purple-700' },
    pack:    { label: 'Pack component',  bg: 'bg-teal-50',    text: 'text-teal-700'   },
  };
  const channelBadge = CHANNEL_BADGE[formData?.listingType || 'store'] || CHANNEL_BADGE.store;

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="skeleton h-64 rounded-2xl" />
        <div className="skeleton h-96 rounded-2xl" />
      </div>
    );
  }

  if (!product || !formData) {
    return (
      <div className="max-w-4xl mx-auto">
        <button onClick={onBack} className="btn-secondary mb-5">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center shadow-sm">
          <p className="text-gray-500 font-medium">{error || 'Product not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <button
        onClick={() => {
          if (isEditing && hasChanges) {
            if (window.confirm('You have unsaved changes. Discard them?')) onBack?.();
          } else {
            onBack?.();
          }
        }}
        className="btn-secondary"
      >
        <ArrowLeft className="w-4 h-4" /> Back to products
      </button>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Product image */}
        <div className="relative h-56 bg-gray-50 border-b border-gray-100 overflow-hidden">
          {(isEditing ? formData.imageUrl : product.imageUrl) ? (
            <img src={isEditing ? formData.imageUrl : product.imageUrl} className="w-full h-full object-contain" alt="" />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-200">No image</div>
          )}
          {isEditing && (
            <div className="absolute bottom-3 left-3 right-3 text-center">
              <span className="text-[10px] text-gray-400 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full border border-gray-100">
                Images cannot be edited — delete &amp; re-add to change
              </span>
            </div>
          )}
        </div>

        <div className="p-6 sm:p-8">
          {/* Errors */}
          {(error || validationErrors.length > 0) && (
            <div className="mb-5 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                {error && <p className="text-sm text-red-700 font-medium">{error}</p>}
                {validationErrors.map((e, i) => (
                  <p key={i} className="text-xs text-red-600">{e}</p>
                ))}
              </div>
            </div>
          )}

          {/* Status + meta */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <span className={cn(
                'text-xs font-semibold px-3 py-1 rounded-full',
                product.status === 'approved' ? 'text-green-700 bg-green-50' : 'text-amber-700 bg-amber-50'
              )}>
                {product.status}
              </span>
              <span className={cn('text-xs font-semibold px-3 py-1 rounded-full', channelBadge.bg, channelBadge.text)}>
                {channelBadge.label}
              </span>
            </div>
            {product.updatedAt && (
              <p className="text-[11px] text-gray-400">
                Updated {new Date(product.updatedAt).toLocaleDateString()}
              </p>
            )}
          </div>

          {/* Form fields */}
          <div className="space-y-5">
            {isEditing ? (
              <>
                <div className="space-y-4">
                  <div>
                    <label className="section-label block mb-1.5">Product Name</label>
                    <input type="text" value={formData.name || ''} onChange={e => handleFieldChange('name', e.target.value)} className="input" placeholder="e.g. Vintage Denim Jacket" />
                  </div>
                  <div>
                    <label className="section-label block mb-1.5">Description</label>
                    <textarea value={formData.description || ''} onChange={e => handleFieldChange('description', e.target.value)} rows={4} className="input resize-none" placeholder="Describe the item..." />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="section-label block mb-1.5">Category</label>
                      <select value={formData.category || ''} onChange={e => handleFieldChange('category', e.target.value)} className="input">
                        <option value="">Select...</option>
                        {['Sneakers','Clothing','Accessories','Electronics','Collectibles','Other'].map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="section-label block mb-1.5">Condition</label>
                      <select value={formData.condition || 'New'} onChange={e => handleFieldChange('condition', e.target.value as ProductCondition)} className="input">
                        {conditions.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="section-label block mb-1.5">Listing type</label>
                    <select value={formData.listingType || 'store'} onChange={e => handleFieldChange('listingType', e.target.value)} className="input">
                      <option value="store">Store only</option>
                      <option value="auction">Auction only</option>
                      <option value="both">Store + Auction</option>
                      <option value="pack">Pack component</option>
                    </select>
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
                      <label className="section-label block mb-1.5">Sale Price (R)</label>
                      <div className="input bg-green-50 border-green-200 font-bold text-green-700 flex items-center">
                        {formData.discountPrice || 0}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="section-label block mb-1.5">Total Stock</label>
                    <input type="number" min="1" value={formData.stock || 1} onChange={e => handleFieldChange('stock', Number(e.target.value))} className="input" />
                  </div>
                </div>

                <div className="pt-5 border-t border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-800 mb-4">Stock Allocation</h3>
                  <AllocationEditor totalStock={formData.stock || 1} allocations={formData.allocations || { store: 0, auction: 0, packs: 0 }} onChange={handleAllocationChange} showPercentages />
                </div>

                {!isAllocationValid() && (
                  <p className="text-xs text-red-600 font-medium">
                    Allocation total ({(formData.allocations?.store || 0) + (formData.allocations?.auction || 0) + (formData.allocations?.packs || 0)}) exceeds stock ({formData.stock})
                  </p>
                )}
              </>
            ) : (
              <>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{product.name}</h2>
                  <p className="text-gray-400 text-sm mt-0.5">{product.category} · {product.condition}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <p className="section-label mb-1">Pricing</p>
                    {(() => {
                      const selling = product.discountPrice ?? product.retailPrice ?? 0;
                      const retail = product.retailPrice ?? 0;
                      const hasDiscount = selling > 0 && retail > 0 && selling < retail;
                      return (
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <p className="text-xl font-bold text-gray-900">R{selling.toLocaleString()}</p>
                          {hasDiscount && <>
                            <p className="text-sm text-gray-400 line-through">R{retail.toLocaleString()}</p>
                            <p className="text-xs text-quirky font-semibold">-{product.markdownPercentage}%</p>
                          </>}
                        </div>
                      );
                    })()}
                  </div>
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <p className="section-label mb-1">Stock</p>
                    <p className={cn('text-xl font-bold', (product.stock || 0) <= 5 ? 'text-amber-600' : 'text-gray-900')}>
                      {product.stock} units
                    </p>
                  </div>
                </div>

                <div>
                  <p className="section-label mb-1.5">Description</p>
                  <p className="text-gray-600 text-sm leading-relaxed">{product.description}</p>
                </div>

                <div className="pt-5 border-t border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-800 mb-4">Stock Allocation</h3>
                  <AllocationEditor totalStock={product.stock ?? 0} allocations={product.allocations ?? { store: 0, auction: 0, packs: 0 }} onChange={() => {}} disabled showPercentages />
                </div>
              </>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-6 pt-5 border-t border-gray-100">
            {isEditing ? (
              <>
                <button onClick={() => { setIsEditing(false); setFormData(product); setValidationErrors([]); }} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !isAllocationValid()}
                  className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </>
            ) : (
              <button onClick={() => { setIsEditing(true); setValidationErrors([]); }} className="btn-primary w-full flex items-center justify-center gap-2">
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
