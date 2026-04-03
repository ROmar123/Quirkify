import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { Product, ProductCondition } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { Check, Eye, Clock, Edit3, Save, ShoppingBag, Gavel, LayoutGrid, Trash2, X } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function ReviewQueue() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedProduct, setEditedProduct] = useState<Product | null>(null);

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
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="flex items-center justify-between mb-12">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2 text-black">Review Queue</h1>
          <p className="text-zinc-500 text-sm uppercase tracking-widest font-bold">Human-in-the-loop validation for AI products.</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-zinc-50 rounded-none border border-zinc-100">
          <Clock className="w-4 h-4 text-zinc-400" />
          <span className="text-[10px] font-bold uppercase tracking-widest">{products.length} Pending</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-1 space-y-2">
          {loading ? (
            [1, 2, 3].map(i => <div key={`skeleton-${i}`} className="h-20 bg-zinc-50 animate-pulse rounded-none" />)
          ) : products.length === 0 ? (
            <div className="p-12 text-center border border-zinc-100 rounded-none bg-zinc-50">
              <p className="text-zinc-300 text-[10px] font-bold uppercase tracking-widest">Queue is empty.</p>
            </div>
          ) : (
            products.map((product) => (
              <button
                key={product.id}
                onClick={() => setSelectedProduct(product)}
                className={cn(
                  "w-full p-4 rounded-none border transition-all flex items-center gap-4 text-left",
                  selectedProduct?.id === product.id 
                    ? "bg-black border-black text-white" 
                    : "bg-white border-zinc-100 text-black hover:border-zinc-300"
                )}
              >
                <div className="w-12 h-12 rounded-none overflow-hidden bg-zinc-50 flex-shrink-0 border border-zinc-100">
                  <img src={product.imageUrl} className="w-full h-full object-cover" alt="" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-xs uppercase tracking-tight truncate">{product.name}</h3>
                  <p className={cn("text-[10px] font-bold uppercase tracking-widest truncate", selectedProduct?.id === product.id ? "text-zinc-400" : "text-zinc-400")}>
                    {product.category} • R{product.discountPrice || product.priceRange.max}
                  </p>
                </div>
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
                className="bg-white rounded-none border border-zinc-100 shadow-sm overflow-hidden"
              >
                <div className="aspect-video w-full bg-zinc-50 border-b border-zinc-100">
                  <img src={selectedProduct.imageUrl} className="w-full h-full object-contain" alt="" />
                </div>
                <div className="p-8">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex-1">
                      {isEditing ? (
                        <input 
                          type="text" 
                          value={editedProduct.name}
                          onChange={(e) => setEditedProduct({ ...editedProduct, name: e.target.value })}
                          className="text-3xl font-bold mb-1 uppercase tracking-tight w-full bg-zinc-50 border border-zinc-100 p-2 focus:outline-none focus:border-black"
                        />
                      ) : (
                        <h2 className="text-3xl font-bold mb-1 uppercase tracking-tight">{editedProduct.name}</h2>
                      )}
                      <p className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest">{selectedProduct.category}</p>
                    </div>
                    <div className="text-right ml-4">
                      <span className="text-[8px] text-zinc-400 block mb-1 uppercase tracking-widest font-bold">AI Confidence</span>
                      <span className="text-2xl font-bold text-black">{Math.round(selectedProduct.confidenceScore * 100)}%</span>
                    </div>
                  </div>

                  <div className="space-y-8 mb-12">
                    {isEditing ? (
                      <div className="space-y-4">
                        <div>
                          <label className="text-[8px] font-bold uppercase tracking-widest text-zinc-400 block mb-1">Description</label>
                          <textarea 
                            value={editedProduct.description}
                            onChange={(e) => setEditedProduct({ ...editedProduct, description: e.target.value })}
                            className="w-full p-3 bg-zinc-50 border border-zinc-100 text-xs leading-relaxed focus:outline-none focus:border-black h-24"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-[8px] font-bold uppercase tracking-widest text-zinc-400 block mb-1">Retail Price (ZAR)</label>
                            <input 
                              type="number" 
                              value={editedProduct.retailPrice}
                              onChange={(e) => handleRetailPriceChange(Number(e.target.value))}
                              className="w-full p-3 bg-zinc-50 border border-zinc-100 text-xs font-bold focus:outline-none focus:border-black"
                            />
                          </div>
                          <div>
                            <label className="text-[8px] font-bold uppercase tracking-widest text-zinc-400 block mb-1">Markdown %</label>
                            <input 
                              type="number" 
                              value={editedProduct.markdownPercentage}
                              onChange={(e) => handleMarkdownChange(Number(e.target.value))}
                              className="w-full p-3 bg-zinc-50 border border-zinc-100 text-xs font-bold focus:outline-none focus:border-black"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-[8px] font-bold uppercase tracking-widest text-zinc-400 block mb-1">Condition</label>
                            <select 
                              value={editedProduct.condition}
                              onChange={(e) => setEditedProduct({ ...editedProduct, condition: e.target.value as ProductCondition })}
                              className="w-full p-3 bg-zinc-50 border border-zinc-100 text-xs font-bold uppercase tracking-widest focus:outline-none focus:border-black appearance-none"
                            >
                              {conditions.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="text-[8px] font-bold uppercase tracking-widest text-zinc-400 block mb-1">Quantity</label>
                            <input 
                              type="number" 
                              value={editedProduct.stock}
                              onChange={(e) => setEditedProduct({ ...editedProduct, stock: Number(e.target.value) })}
                              className="w-full p-3 bg-zinc-50 border border-zinc-100 text-xs font-bold focus:outline-none focus:border-black"
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-6">
                          <div className="p-6 bg-zinc-50 rounded-none border border-zinc-100">
                            <h4 className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Pricing (ZAR)</h4>
                            <div className="flex items-baseline gap-2">
                              <p className="text-xl font-bold text-black">R{editedProduct.discountPrice}</p>
                              <p className="text-[10px] text-zinc-400 line-through">R{editedProduct.retailPrice}</p>
                              <p className="text-[8px] text-quirky font-bold">-{editedProduct.markdownPercentage}%</p>
                            </div>
                          </div>
                          <div className="p-6 bg-zinc-50 rounded-none border border-zinc-100">
                            <h4 className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Condition & Stock</h4>
                            <p className="text-xl font-bold text-black uppercase">{editedProduct.condition} • {editedProduct.stock} UNITS</p>
                          </div>
                        </div>

                        <div>
                          <h4 className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Description</h4>
                          <p className="text-zinc-600 text-sm leading-relaxed">{editedProduct.description}</p>
                        </div>
                      </>
                    )}

                    <div className="pt-8 border-t border-zinc-100">
                      <h4 className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest mb-4">Listing Destination</h4>
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
                              "flex flex-col items-center justify-center p-4 border rounded-none transition-all gap-2",
                              editedProduct.listingType === type.id || (!editedProduct.listingType && type.id === 'store')
                                ? "bg-black border-black text-white"
                                : "bg-white border-zinc-100 text-zinc-400 hover:border-zinc-200"
                            )}
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
                        className="flex-1 py-4 bg-zinc-100 text-black rounded-none font-bold uppercase tracking-widest text-[10px] hover:bg-zinc-200 transition-all flex items-center justify-center gap-2"
                      >
                        {isEditing ? <Save className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
                        {isEditing ? 'Save Changes' : 'Edit Details'}
                      </button>
                      <button
                        onClick={() => handleStatus(selectedProduct.id, 'rejected')}
                        className="px-6 py-4 bg-red-50 text-red-600 rounded-none font-bold uppercase tracking-widest text-[10px] hover:bg-red-100 transition-all flex items-center justify-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        Reject
                      </button>
                    </div>
                    
                    <button
                      onClick={() => handleStatus(selectedProduct.id, 'approved')}
                      className="w-full py-4 bg-black text-white rounded-none font-bold uppercase tracking-widest text-xs hover:bg-zinc-800 transition-all flex items-center justify-center gap-2"
                    >
                      <Check className="w-5 h-5" />
                      Approve & Push to {editedProduct.listingType === 'both' ? 'Store + Auction' : editedProduct.listingType === 'auction' ? 'Auction' : 'Store'}
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-12 border border-zinc-100 rounded-none border-dashed bg-zinc-50">
                <Eye className="w-10 h-10 text-zinc-200 mb-4" />
                <p className="text-zinc-300 text-[10px] font-bold uppercase tracking-widest">Select a product to review</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
