import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { Product, ProductCondition } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Filter, Edit3, Pause, Play, Lock, Unlock, Trash2, Save, ShoppingBag, Gavel, LayoutGrid, X } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function ListingManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'store' | 'auction' | 'both'>('all');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'products'), where('status', '==', 'approved'));
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

  const handleTogglePause = async (product: Product) => {
    try {
      await updateDoc(doc(db, 'products', product.id), { isPaused: !product.isPaused });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `products/${product.id}`);
    }
  };

  const handleToggleReserve = async (product: Product) => {
    try {
      await updateDoc(doc(db, 'products', product.id), { isReserved: !product.isReserved });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `products/${product.id}`);
    }
  };

  const handleUpdateProduct = async () => {
    if (!editingProduct) return;
    try {
      await updateDoc(doc(db, 'products', editingProduct.id), {
        name: editingProduct.name,
        description: editingProduct.description,
        retailPrice: editingProduct.retailPrice,
        markdownPercentage: editingProduct.markdownPercentage,
        discountPrice: editingProduct.discountPrice,
        condition: editingProduct.condition,
        stock: editingProduct.stock,
        listingType: editingProduct.listingType
      });
      setEditingProduct(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `products/${editingProduct.id}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this listing?')) return;
    try {
      await deleteDoc(doc(db, 'products', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `products/${id}`);
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         p.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filter === 'all' || p.listingType === filter;
    return matchesSearch && matchesFilter;
  });

  const conditions: ProductCondition[] = ['New', 'Like New', 'Pre-owned', 'Refurbished'];

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-6">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2 text-black">E-commerce Listings</h1>
          <p className="text-zinc-500 text-sm uppercase tracking-widest font-bold">Manage your active store and auction inventory.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input 
              type="text"
              placeholder="Search listings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-zinc-100 rounded-none text-[10px] font-bold uppercase tracking-widest focus:outline-none focus:border-black w-full sm:w-64"
            />
          </div>
          <div className="flex border border-zinc-100 bg-white">
            {(['all', 'store', 'auction', 'both'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-4 py-2 text-[8px] font-bold uppercase tracking-widest transition-all border-r last:border-r-0",
                  filter === f ? "bg-black text-white" : "text-zinc-400 hover:text-black hover:bg-zinc-50"
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          [1, 2, 3, 4, 5, 6].map(i => <div key={`skeleton-${i}`} className="aspect-[4/5] bg-zinc-50 animate-pulse rounded-none" />)
        ) : filteredProducts.length === 0 ? (
          <div className="col-span-full p-24 text-center border border-zinc-100 rounded-none bg-zinc-50 border-dashed">
            <ShoppingBag className="w-12 h-12 text-zinc-200 mx-auto mb-4" />
            <p className="text-zinc-300 text-[10px] font-bold uppercase tracking-widest">No listings found.</p>
          </div>
        ) : (
          filteredProducts.map((product) => (
            <motion.div
              key={product.id}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={cn(
                "group bg-white border border-zinc-100 rounded-none overflow-hidden hover:shadow-xl transition-all relative",
                product.isPaused && "opacity-60 grayscale",
                product.isReserved && "border-quirky/30"
              )}
            >
              <div className="aspect-square relative overflow-hidden bg-zinc-50">
                <img src={product.imageUrl} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="" />
                
                <div className="absolute top-4 left-4 flex flex-col gap-2">
                  <div className={cn(
                    "px-2 py-1 text-[8px] font-bold uppercase tracking-widest border",
                    product.listingType === 'auction' ? "bg-amber-50 border-amber-100 text-amber-600" :
                    product.listingType === 'both' ? "bg-purple-50 border-purple-100 text-purple-600" :
                    "bg-green-50 border-green-100 text-green-600"
                  )}>
                    {product.listingType || 'store'}
                  </div>
                  {product.isPaused && (
                    <div className="px-2 py-1 bg-zinc-800 text-white text-[8px] font-bold uppercase tracking-widest">Paused</div>
                  )}
                  {product.isReserved && (
                    <div className="px-2 py-1 bg-quirky text-white text-[8px] font-bold uppercase tracking-widest">Reserved</div>
                  )}
                </div>

                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button 
                    onClick={() => setEditingProduct(product)}
                    className="p-3 bg-white text-black hover:bg-zinc-100 transition-colors"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleTogglePause(product)}
                    className="p-3 bg-white text-black hover:bg-zinc-100 transition-colors"
                  >
                    {product.isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                  </button>
                  <button 
                    onClick={() => handleToggleReserve(product)}
                    className="p-3 bg-white text-black hover:bg-zinc-100 transition-colors"
                  >
                    {product.isReserved ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                  </button>
                  <button 
                    onClick={() => handleDelete(product.id)}
                    className="p-3 bg-red-600 text-white hover:bg-red-700 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-xs uppercase tracking-tight truncate flex-1">{product.name}</h3>
                  <span className="text-[10px] font-bold ml-4">R{product.discountPrice}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[8px] text-zinc-400 font-bold uppercase tracking-widest">{product.category}</span>
                  <span className="text-[8px] text-zinc-400 font-bold uppercase tracking-widest">{product.stock} IN STOCK</span>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Edit Modal */}
      <AnimatePresence>
        {editingProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingProduct(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-none shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-zinc-100 flex items-center justify-between">
                <h2 className="text-xl font-bold uppercase tracking-tight">Edit Listing</h2>
                <button onClick={() => setEditingProduct(null)} className="p-2 hover:bg-zinc-50 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="text-[8px] font-bold uppercase tracking-widest text-zinc-400 block mb-1">Product Name</label>
                      <input 
                        type="text" 
                        value={editingProduct.name}
                        onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                        className="w-full p-3 bg-zinc-50 border border-zinc-100 text-xs font-bold uppercase tracking-tight focus:outline-none focus:border-black"
                      />
                    </div>
                    <div>
                      <label className="text-[8px] font-bold uppercase tracking-widest text-zinc-400 block mb-1">Description</label>
                      <textarea 
                        value={editingProduct.description}
                        onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                        className="w-full p-3 bg-zinc-50 border border-zinc-100 text-xs leading-relaxed focus:outline-none focus:border-black h-32"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[8px] font-bold uppercase tracking-widest text-zinc-400 block mb-1">Retail Price</label>
                        <input 
                          type="number" 
                          value={editingProduct.retailPrice}
                          onChange={(e) => {
                            const retail = Number(e.target.value);
                            const discount = Math.round(retail * (1 - editingProduct.markdownPercentage / 100));
                            setEditingProduct({ ...editingProduct, retailPrice: retail, discountPrice: discount });
                          }}
                          className="w-full p-3 bg-zinc-50 border border-zinc-100 text-xs font-bold focus:outline-none focus:border-black"
                        />
                      </div>
                      <div>
                        <label className="text-[8px] font-bold uppercase tracking-widest text-zinc-400 block mb-1">Markdown %</label>
                        <input 
                          type="number" 
                          value={editingProduct.markdownPercentage}
                          onChange={(e) => {
                            const markdown = Number(e.target.value);
                            const discount = Math.round(editingProduct.retailPrice * (1 - markdown / 100));
                            setEditingProduct({ ...editingProduct, markdownPercentage: markdown, discountPrice: discount });
                          }}
                          className="w-full p-3 bg-zinc-50 border border-zinc-100 text-xs font-bold focus:outline-none focus:border-black"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[8px] font-bold uppercase tracking-widest text-zinc-400 block mb-1">Condition</label>
                        <select 
                          value={editingProduct.condition}
                          onChange={(e) => setEditingProduct({ ...editingProduct, condition: e.target.value as ProductCondition })}
                          className="w-full p-3 bg-zinc-50 border border-zinc-100 text-xs font-bold uppercase tracking-widest focus:outline-none focus:border-black appearance-none"
                        >
                          {conditions.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[8px] font-bold uppercase tracking-widest text-zinc-400 block mb-1">Stock</label>
                        <input 
                          type="number" 
                          value={editingProduct.stock}
                          onChange={(e) => setEditingProduct({ ...editingProduct, stock: Number(e.target.value) })}
                          className="w-full p-3 bg-zinc-50 border border-zinc-100 text-xs font-bold focus:outline-none focus:border-black"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[8px] font-bold uppercase tracking-widest text-zinc-400 block mb-1">Listing Type</label>
                      <div className="grid grid-cols-3 gap-2">
                        {(['store', 'auction', 'both'] as const).map((type) => (
                          <button
                            key={type}
                            onClick={() => setEditingProduct({ ...editingProduct, listingType: type })}
                            className={cn(
                              "py-3 border rounded-none text-[8px] font-bold uppercase tracking-widest transition-all",
                              editingProduct.listingType === type
                                ? "bg-black border-black text-white"
                                : "bg-zinc-50 border-zinc-100 text-zinc-400 hover:border-zinc-200"
                            )}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-8 bg-zinc-50 border-t border-zinc-100 flex gap-4">
                <button
                  onClick={() => setEditingProduct(null)}
                  className="flex-1 py-4 bg-white border border-zinc-200 text-black rounded-none font-bold uppercase tracking-widest text-[10px] hover:bg-zinc-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateProduct}
                  className="flex-1 py-4 bg-black text-white rounded-none font-bold uppercase tracking-widest text-[10px] hover:bg-zinc-800 transition-all flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Save Changes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
