import { useState, useEffect } from 'react';
import { subscribeToProducts, updateProduct } from '../../services/productService';
import { Product, ProductCondition, AllocationSnapshot } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { Check, Eye, Clock, Edit3, Save, ShoppingBag, Gavel, LayoutGrid, Trash2, ArrowLeft, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import AllocationEditor from '../inventory/Shared/AllocationEditor';

export default function ReviewQueue() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedProduct, setEditedProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = subscribeToProducts('pending', (data) => {
      setProducts(data);
      setLoading(false);
    }, { skipDemo: true });
    return unsub;
  }, []);

  useEffect(() => {
    if (selectedProduct) {
      setEditedProduct({ ...selectedProduct });
      setIsEditing(false);
      setError(null);
    } else {
      setEditedProduct(null);
    }
  }, [selectedProduct]);

  const handleMarkdownChange = (percentage: number) => {
    if (!editedProduct) return;
    const discountPrice = Math.round(editedProduct.retailPrice * (1 - percentage / 100));
    setEditedProduct({ ...editedProduct, markdownPercentage: percentage, discountPrice });
  };

  const handleRetailPriceChange = (price: number) => {
    if (!editedProduct) return;
    const discountPrice = Math.round(price * (1 - (editedProduct.markdownPercentage || 0) / 100));
    setEditedProduct({ ...editedProduct, retailPrice: price, discountPrice });
  };

  const handleStatus = async (id: string, status: 'approved' | 'rejected') => {
    if (!editedProduct) return;
    setError(null);

    if (status === 'approved') {
      if (!editedProduct.name?.trim()) { setError('Product name is required'); return; }
      if (!editedProduct.description?.trim()) { setError('Description is required'); return; }
      if (!editedProduct.retailPrice || editedProduct.retailPrice <= 0) { setError('Retail price must be greater than 0'); return; }
      if (!editedProduct.stock || editedProduct.stock <= 0) { setError('Stock must be at least 1'); return; }

      const totalAllocated = (editedProduct.allocations?.store || 0) +
        (editedProduct.allocations?.auction || 0) +
        (editedProduct.allocations?.packs || 0);
      if (totalAllocated > (editedProduct.stock || 0)) {
        setError(`Allocations (${totalAllocated}) exceed total stock (${editedProduct.stock})`);
        return;
      }
    }

    setSaving(true);
    try {
      const updates: Partial<Product> = { status };
      if (status === 'approved') {
        Object.assign(updates, {
          name: editedProduct.name,
          description: editedProduct.description,
          retailPrice: editedProduct.retailPrice,
          markdownPercentage: editedProduct.markdownPercentage,
          discountPrice: editedProduct.discountPrice,
          condition: editedProduct.condition,
          stock: editedProduct.stock,
          allocations: editedProduct.allocations || { store: editedProduct.stock, auction: 0, packs: 0 },
          listingType: editedProduct.listingType || 'store',
        });
      }
      await updateProduct(id, updates);
      if (selectedProduct?.id === id) setSelectedProduct(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to update product. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const conditions: ProductCondition[] = ['New', 'Like New', 'Pre-owned', 'Refurbished'];
  const showDetail = !!selectedProduct && !!editedProduct;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Review Queue</h1>
          <p className="text-gray-400 text-xs mt-0.5">Human-in-the-loop validation for AI products</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <Clock className="w-4 h-4 text-gray-400" />
          <span className="text-xs font-semibold text-gray-700">{products.length} Pending</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Product list — hidden on mobile when one is selected */}
        <div className={cn('lg:col-span-1 space-y-2', showDetail && 'hidden lg:block')}>
          {loading ? (
            [1, 2, 3].map(i => <div key={i} className="skeleton h-20 rounded-2xl" />)
          ) : products.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-gray-100 shadow-sm">
              <Eye className="w-8 h-8 text-gray-200 mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-500">Queue is empty</p>
              <p className="text-xs text-gray-400 mt-1">New AI intake submissions appear here</p>
            </div>
          ) : (
            products.map((product) => {
              const active = selectedProduct?.id === product.id;
              return (
                <motion.button
                  key={product.id}
                  onClick={() => setSelectedProduct(product)}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    'w-full p-4 rounded-2xl border transition-all flex items-center gap-3 text-left',
                    active
                      ? 'border-purple-400 bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-md'
                      : 'bg-white border-gray-100 text-gray-900 hover:border-gray-200 shadow-sm'
                  )}
                >
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-50 flex-shrink-0 border border-gray-100">
                    {product.imageUrl
                      ? <img src={product.imageUrl} className="w-full h-full object-cover" alt="" />
                      : <div className="w-full h-full flex items-center justify-center"><ShoppingBag className="w-5 h-5 text-gray-200" /></div>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm truncate">{product.name || 'Unnamed product'}</h3>
                    <p className={cn('text-xs mt-0.5 truncate', active ? 'text-white/70' : 'text-gray-400')}>
                      {product.category} · R{product.discountPrice || product.retailPrice || 0}
                    </p>
                  </div>
                  <span className={cn(
                    'px-2 py-1 rounded-full text-[10px] font-semibold flex-shrink-0',
                    active ? 'bg-white/20 text-white' : 'bg-amber-50 text-amber-600 border border-amber-100'
                  )}>
                    Pending
                  </span>
                </motion.button>
              );
            })
          )}
        </div>

        {/* Detail panel */}
        <div className={cn('lg:col-span-2', !showDetail && 'hidden lg:block')}>
          <AnimatePresence mode="wait">
            {showDetail ? (
              <motion.div
                key={selectedProduct!.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
              >
                {/* Mobile back button */}
                <div className="lg:hidden flex items-center gap-2 p-4 border-b border-gray-100">
                  <button onClick={() => setSelectedProduct(null)} className="btn-secondary p-2">
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm font-semibold text-gray-900">Review Product</span>
                </div>

                {/* Image */}
                <div className="aspect-video w-full bg-gray-50 border-b border-gray-100">
                  {selectedProduct!.imageUrl
                    ? <img src={selectedProduct!.imageUrl} className="w-full h-full object-contain" alt="" />
                    : <div className="w-full h-full flex items-center justify-center"><ShoppingBag className="w-12 h-12 text-gray-200" /></div>
                  }
                </div>

                <div className="p-5 sm:p-8">
                  {error && (
                    <div className="mb-5 p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-red-700">{error}</p>
                    </div>
                  )}

                  {/* Product header */}
                  <div className="flex items-start justify-between gap-3 mb-6">
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editedProduct!.name}
                          onChange={(e) => setEditedProduct({ ...editedProduct!, name: e.target.value })}
                          className="input w-full mb-1"
                          placeholder="Product name"
                        />
                      ) : (
                        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">{editedProduct!.name}</h2>
                      )}
                      <p className="section-label mt-1">{selectedProduct!.category}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="section-label mb-1">AI Confidence</p>
                      <span className="text-xl font-bold text-gray-900">
                        {Math.round((selectedProduct!.confidenceScore || 0) * 100)}%
                      </span>
                    </div>
                  </div>

                  {/* Edit / view fields */}
                  <div className="space-y-6 mb-8">
                    {isEditing ? (
                      <div className="space-y-4">
                        <div>
                          <label className="section-label block mb-1.5">Description</label>
                          <textarea
                            value={editedProduct!.description}
                            onChange={(e) => setEditedProduct({ ...editedProduct!, description: e.target.value })}
                            className="input resize-none h-24"
                            placeholder="Product description…"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="section-label block mb-1.5">Retail Price (R)</label>
                            <input
                              type="number"
                              value={editedProduct!.retailPrice || ''}
                              onChange={(e) => handleRetailPriceChange(Number(e.target.value))}
                              className="input"
                              min="0"
                            />
                          </div>
                          <div>
                            <label className="section-label block mb-1.5">Markdown %</label>
                            <input
                              type="number"
                              value={editedProduct!.markdownPercentage || ''}
                              onChange={(e) => handleMarkdownChange(Number(e.target.value))}
                              className="input"
                              min="0"
                              max="100"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="section-label block mb-1.5">Condition</label>
                            <select
                              value={editedProduct!.condition}
                              onChange={(e) => setEditedProduct({ ...editedProduct!, condition: e.target.value as ProductCondition })}
                              className="input"
                            >
                              {conditions.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="section-label block mb-1.5">Stock</label>
                            <input
                              type="number"
                              value={editedProduct!.stock || ''}
                              onChange={(e) => setEditedProduct({ ...editedProduct!, stock: Number(e.target.value) })}
                              className="input"
                              min="1"
                            />
                          </div>
                        </div>
                        <div className="pt-4 border-t border-gray-100">
                          <AllocationEditor
                            totalStock={editedProduct!.stock || 1}
                            allocations={editedProduct!.allocations || { store: 0, auction: 0, packs: 0 }}
                            onChange={(allocations: AllocationSnapshot) => setEditedProduct({ ...editedProduct!, allocations })}
                            showPercentages={true}
                            compact={false}
                          />
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                            <p className="section-label mb-2">Pricing (ZAR)</p>
                            <div className="flex items-baseline gap-2 flex-wrap">
                              <span className="text-lg font-bold text-gray-900">R{editedProduct!.discountPrice}</span>
                              <span className="text-xs text-gray-400 line-through">R{editedProduct!.retailPrice}</span>
                              {editedProduct!.markdownPercentage ? (
                                <span className="text-xs text-quirky font-bold">-{editedProduct!.markdownPercentage}%</span>
                              ) : null}
                            </div>
                          </div>
                          <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                            <p className="section-label mb-2">Condition & Stock</p>
                            <p className="text-sm font-bold text-gray-900">{editedProduct!.condition} · {editedProduct!.stock} units</p>
                          </div>
                        </div>
                        {editedProduct!.description && (
                          <div>
                            <p className="section-label mb-2">Description</p>
                            <p className="text-sm text-gray-600 leading-relaxed">{editedProduct!.description}</p>
                          </div>
                        )}
                      </>
                    )}

                    {/* Listing destination */}
                    <div className="pt-5 border-t border-gray-100">
                      <p className="section-label mb-3">Listing Destination</p>
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { id: 'store', label: 'Store', icon: ShoppingBag },
                          { id: 'auction', label: 'Auction', icon: Gavel },
                          { id: 'both', label: 'Both', icon: LayoutGrid },
                        ].map((type) => {
                          const active = editedProduct!.listingType === type.id || (!editedProduct!.listingType && type.id === 'store');
                          return (
                            <button
                              key={type.id}
                              onClick={() => setEditedProduct({ ...editedProduct!, listingType: type.id as any })}
                              className={cn(
                                'flex flex-col items-center justify-center p-3 rounded-xl border transition-all gap-1.5 text-sm',
                                active
                                  ? 'border-transparent text-white bg-gradient-to-br from-pink-500 to-purple-600 shadow-sm'
                                  : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                              )}
                            >
                              <type.icon className="w-4 h-4" />
                              <span className="text-[10px] font-semibold uppercase tracking-wide">{type.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-3">
                    <div className="flex gap-3">
                      <button
                        onClick={() => setIsEditing(!isEditing)}
                        className="btn-secondary flex-1 justify-center"
                        disabled={saving}
                      >
                        {isEditing ? <Save className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
                        {isEditing ? 'Save' : 'Edit'}
                      </button>
                      <button
                        onClick={() => handleStatus(selectedProduct!.id, 'rejected')}
                        disabled={saving}
                        className="px-5 py-2.5 bg-red-50 text-red-600 border border-red-100 rounded-xl font-semibold text-sm hover:bg-red-100 transition-all flex items-center gap-2 disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                        Reject
                      </button>
                    </div>
                    <button
                      onClick={() => handleStatus(selectedProduct!.id, 'approved')}
                      disabled={saving}
                      className="btn-primary w-full justify-center py-3 disabled:opacity-50"
                    >
                      {saving ? (
                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} className="w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                      ) : (
                        <Check className="w-5 h-5" />
                      )}
                      {saving ? 'Saving…' : `Approve & Push to ${editedProduct!.listingType === 'both' ? 'Store + Auction' : editedProduct!.listingType === 'auction' ? 'Auction' : 'Store'}`}
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-80 flex flex-col items-center justify-center text-center p-12 bg-white rounded-2xl border border-gray-100 border-dashed shadow-sm"
              >
                <Eye className="w-10 h-10 text-gray-200 mb-4" />
                <p className="text-sm font-semibold text-gray-500">Select a product to review</p>
                <p className="text-xs text-gray-400 mt-1">Pick from the pending queue on the left</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
