import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { Product, ProductCondition, AllocationSnapshot } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { Check, Eye, Clock, Edit3, Save, ShoppingBag, Gavel, LayoutGrid, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import AllocationEditor from '../inventory/Shared/AllocationEditor';

export default function ReviewQueue() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedProduct, setEditedProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'products'), where('status', '==', 'pending'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(docs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'products');
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (selectedProduct) {
      setEditedProduct({ ...selectedProduct });
      setIsEditing(false);
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
    const discountPrice = Math.round(price * (1 - editedProduct.markdownPercentage / 100));
    setEditedProduct({ ...editedProduct, retailPrice: price, discountPrice });
  };

  const handleStatus = async (id: string, status: 'approved' | 'rejected') => {
    if (!editedProduct) return;
    setError(null);

    // Validate required fields on approval
    if (status === 'approved') {
      if (!editedProduct.name?.trim()) {
        setError('Product name is required');
        return;
      }
      if (!editedProduct.description?.trim()) {
        setError('Description is required');
        return;
      }
      if (!editedProduct.retailPrice || editedProduct.retailPrice <= 0) {
        setError('Retail price is required and must be greater than 0');
        return;
      }
      if (!editedProduct.stock || editedProduct.stock <= 0) {
        setError('Stock must be at least 1');
        return;
      }

      // Validate allocations don't exceed total stock
      const totalAllocated = (editedProduct.allocations?.store || 0) +
                            (editedProduct.allocations?.auction || 0) +
                            (editedProduct.allocations?.packs || 0);
      if (totalAllocated > (editedProduct.stock || 0)) {
        setError(`Allocations (${totalAllocated}) cannot exceed total stock (${editedProduct.stock})`);
        return;
      }
    }

    try {
      const updateData: any = { status };
      if (status === 'approved') {
        Object.assign(updateData, {
          name: editedProduct.name,
          description: editedProduct.description,
          retailPrice: editedProduct.retailPrice,
          markdownPercentage: editedProduct.markdownPercentage,
          discountPrice: editedProduct.discountPrice,
          condition: editedProduct.condition,
          stock: editedProduct.stock,
          totalStock: editedProduct.stock,
          allocations: editedProduct.allocations || { store: editedProduct.stock, auction: 0, packs: 0 },
          approvalDate: new Date().toISOString(),
          listingType: editedProduct.listingType || 'store'
        });
      }

      await updateDoc(doc(db, 'products', id), updateData);
      if (selectedProduct?.id === id) setSelectedProduct(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `products/${id}`);
    }
  };

  const conditions: ProductCondition[] = ['New', 'Like New', 'Pre-owned', 'Refurbished'];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-12">
        <div>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight mb-2 text-purple-900">Review Queue</h1>
          <p className="text-purple-600 text-xs sm:text-sm font-bold">Human-in-the-loop validation for AI products.</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-2xl border border-purple-100 shadow-sm w-fit">
          <Clock className="w-4 h-4 text-purple-400" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-purple-700">{products.length} Pending</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-12">
        <div className="lg:col-span-1 space-y-2">
          {loading ? (
            [1, 2, 3].map(i => (
              <div key={`skeleton-${i}`} className="h-20 bg-purple-50 animate-pulse rounded-2xl border border-purple-100" />
            ))
          ) : products.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-purple-100 shadow-sm">
              <p className="text-purple-300 text-[10px] font-bold uppercase tracking-widest">Queue is empty.</p>
            </div>
          ) : (
            products.map((product) => (
              <button
                key={product.id}
                onClick={() => setSelectedProduct(product)}
                className={cn(
                  "w-full p-4 rounded-2xl border transition-all flex items-center gap-4 text-left",
                  selectedProduct?.id === product.id
                    ? "border-purple-400 text-white"
                    : "bg-white border-purple-100 text-purple-900 hover:border-purple-300 shadow-sm"
                )}
                style={selectedProduct?.id === product.id ? { background: 'linear-gradient(135deg, #F472B6, #A855F7)' } : {}}
              >
                <div className="w-12 h-12 rounded-2xl overflow-hidden bg-purple-50 flex-shrink-0 border border-purple-100">
                  <img src={product.imageUrl} className="w-full h-full object-cover" alt="" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-xs uppercase tracking-tight truncate">{product.name}</h3>
                  <p className={cn(
                    "text-[10px] font-bold uppercase tracking-widest truncate",
                    selectedProduct?.id === product.id ? "text-white/70" : "text-purple-400"
                  )}>
                    {product.category} • R{product.discountPrice || product.priceRange.max}
                  </p>
                </div>
                <span className={cn(
                  "px-2 py-1 rounded-full text-[8px] font-bold uppercase tracking-widest flex-shrink-0",
                  selectedProduct?.id === product.id
                    ? "bg-white/20 text-white"
                    : "bg-purple-100 text-purple-600"
                )}>
                  Pending
                </span>
              </button>
            ))
          )}
        </div>

        <div className="lg:col-span-2">
          <AnimatePresence mode="wait">
            {selectedProduct && editedProduct ? (
              <motion.div
                key={selectedProduct.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white rounded-3xl border border-purple-100 shadow-sm overflow-hidden"
              >
                <div className="aspect-video w-full bg-purple-50 border-b border-purple-100">
                  <img src={selectedProduct.imageUrl} className="w-full h-full object-contain" alt="" />
                </div>
                <div className="p-8">
                  {error && (
                    <div className="mb-6 p-3 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-xs font-bold flex items-center gap-2">
                      <span>⚠</span> {error}
                    </div>
                  )}
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex-1">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editedProduct.name}
                          onChange={(e) => setEditedProduct({ ...editedProduct, name: e.target.value })}
                          className="w-full px-4 py-3 bg-white border-2 border-purple-100 rounded-2xl text-sm font-bold text-purple-800 placeholder:text-purple-300 focus:outline-none focus:border-purple-400 mb-1"
                        />
                      ) : (
                        <h2 className="text-3xl font-black mb-1 uppercase tracking-tight text-purple-900">{editedProduct.name}</h2>
                      )}
                      <p className="text-purple-400 text-[10px] font-bold uppercase tracking-widest">{selectedProduct.category}</p>
                    </div>
                    <div className="text-right ml-4">
                      <span className="text-[8px] text-purple-400 block mb-1 uppercase tracking-widest font-bold">AI Confidence</span>
                      <span className="text-2xl font-black text-purple-900">{Math.round(selectedProduct.confidenceScore * 100)}%</span>
                    </div>
                  </div>

                  <div className="space-y-8 mb-12">
                    {isEditing ? (
                      <div className="space-y-4">
                        <div>
                          <label className="text-[8px] font-bold uppercase tracking-widest text-purple-400 block mb-1">Description</label>
                          <textarea
                            value={editedProduct.description}
                            onChange={(e) => setEditedProduct({ ...editedProduct, description: e.target.value })}
                            className="w-full px-4 py-3 bg-white border-2 border-purple-100 rounded-2xl text-sm font-bold text-purple-800 placeholder:text-purple-300 focus:outline-none focus:border-purple-400 h-24 resize-none"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-[8px] font-bold uppercase tracking-widest text-purple-400 block mb-1">Retail Price (ZAR)</label>
                            <input
                              type="number"
                              value={editedProduct.retailPrice}
                              onChange={(e) => handleRetailPriceChange(Number(e.target.value))}
                              className="w-full px-4 py-3 bg-white border-2 border-purple-100 rounded-2xl text-sm font-bold text-purple-800 placeholder:text-purple-300 focus:outline-none focus:border-purple-400"
                            />
                          </div>
                          <div>
                            <label className="text-[8px] font-bold uppercase tracking-widest text-purple-400 block mb-1">Markdown %</label>
                            <input
                              type="number"
                              value={editedProduct.markdownPercentage}
                              onChange={(e) => handleMarkdownChange(Number(e.target.value))}
                              className="w-full px-4 py-3 bg-white border-2 border-purple-100 rounded-2xl text-sm font-bold text-purple-800 placeholder:text-purple-300 focus:outline-none focus:border-purple-400"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-[8px] font-bold uppercase tracking-widest text-purple-400 block mb-1">Condition</label>
                            <select
                              value={editedProduct.condition}
                              onChange={(e) => setEditedProduct({ ...editedProduct, condition: e.target.value as ProductCondition })}
                              className="w-full px-4 py-3 bg-white border-2 border-purple-100 rounded-2xl text-sm font-bold text-purple-800 focus:outline-none focus:border-purple-400 appearance-none"
                            >
                              {conditions.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="text-[8px] font-bold uppercase tracking-widest text-purple-400 block mb-1">Quantity</label>
                            <input
                              type="number"
                              value={editedProduct.stock}
                              onChange={(e) => setEditedProduct({ ...editedProduct, stock: Number(e.target.value) })}
                              className="w-full px-4 py-3 bg-white border-2 border-purple-100 rounded-2xl text-sm font-bold text-purple-800 placeholder:text-purple-300 focus:outline-none focus:border-purple-400"
                            />
                          </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-purple-100">
                          <AllocationEditor
                            totalStock={editedProduct.stock || 1}
                            allocations={editedProduct.allocations || { store: 0, auction: 0, packs: 0 }}
                            onChange={(allocations: AllocationSnapshot) => setEditedProduct({ ...editedProduct, allocations })}
                            showPercentages={true}
                            compact={false}
                          />
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-6">
                          <div className="p-6 bg-purple-50 rounded-2xl border border-purple-100">
                            <h4 className="text-[8px] font-bold text-purple-400 uppercase tracking-widest mb-1">Pricing (ZAR)</h4>
                            <div className="flex items-baseline gap-2">
                              <p className="text-xl font-black text-purple-900">R{editedProduct.discountPrice}</p>
                              <p className="text-[10px] text-purple-400 line-through">R{editedProduct.retailPrice}</p>
                              <p className="text-[8px] text-quirky font-bold">-{editedProduct.markdownPercentage}%</p>
                            </div>
                          </div>
                          <div className="p-6 bg-purple-50 rounded-2xl border border-purple-100">
                            <h4 className="text-[8px] font-bold text-purple-400 uppercase tracking-widest mb-1">Condition & Stock</h4>
                            <p className="text-xl font-black text-purple-900 uppercase">{editedProduct.condition} • {editedProduct.stock} UNITS</p>
                          </div>
                        </div>

                        <div>
                          <h4 className="text-[8px] font-bold text-purple-400 uppercase tracking-widest mb-2">Description</h4>
                          <p className="text-purple-600 text-sm leading-relaxed">{editedProduct.description}</p>
                        </div>
                      </>
                    )}


                    <div className="pt-8 border-t border-purple-100">
                      <h4 className="text-[8px] font-bold text-purple-400 uppercase tracking-widest mb-4">Listing Destination</h4>
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { id: 'store', label: 'Store Only', icon: ShoppingBag },
                          { id: 'auction', label: 'Auction Only', icon: Gavel },
                          { id: 'both', label: 'Both', icon: LayoutGrid },
                        ].map((type) => (
                          <button
                            key={type.id}
                            onClick={() => setEditedProduct({ ...editedProduct, listingType: type.id as any })}
                            className={cn(
                              "flex flex-col items-center justify-center p-4 border rounded-2xl transition-all gap-2",
                              editedProduct.listingType === type.id || (!editedProduct.listingType && type.id === 'store')
                                ? "border-purple-400 text-white"
                                : "bg-white border-purple-100 text-purple-400 hover:border-purple-300"
                            )}
                            style={
                              editedProduct.listingType === type.id || (!editedProduct.listingType && type.id === 'store')
                                ? { background: 'linear-gradient(135deg, #F472B6, #A855F7)' }
                                : {}
                            }
                          >
                            <type.icon className="w-5 h-5" />
                            <span className="text-[8px] font-bold uppercase tracking-widest">{type.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    <div className="flex gap-3">
                      <button
                        onClick={() => setIsEditing(!isEditing)}
                        className="flex-1 py-3 bg-purple-50 text-purple-700 rounded-full font-bold uppercase tracking-widest text-[10px] hover:bg-purple-100 transition-all flex items-center justify-center gap-2 border border-purple-100"
                      >
                        {isEditing ? <Save className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
                        {isEditing ? 'Save Changes' : 'Edit Details'}
                      </button>
                      <button
                        onClick={() => handleStatus(selectedProduct.id, 'rejected')}
                        className="px-6 py-3 bg-red-50 text-red-500 border border-red-100 rounded-full font-bold uppercase tracking-widest text-[10px] hover:bg-red-100 transition-all flex items-center justify-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        Reject
                      </button>
                    </div>

                    <button
                      onClick={() => handleStatus(selectedProduct.id, 'approved')}
                      className="w-full px-6 py-3 rounded-full font-bold text-white text-sm flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
                      style={{ background: 'linear-gradient(135deg, #22C55E, #16A34A)' }}
                    >
                      <Check className="w-5 h-5" />
                      Approve &amp; Push to {editedProduct.listingType === 'both' ? 'Store + Auction' : editedProduct.listingType === 'auction' ? 'Auction' : 'Store'}
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-white rounded-3xl border border-purple-100 border-dashed shadow-sm">
                <Eye className="w-10 h-10 text-purple-200 mb-4" />
                <p className="text-purple-300 text-[10px] font-bold uppercase tracking-widest">Select a product to review</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
