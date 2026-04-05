import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../../firebase';
import { Product } from '../../../types';
import { motion } from 'motion/react';
import { ChevronRight, Package } from 'lucide-react';
import { cn } from '../../../lib/utils';
import ProductEditor from './ProductEditor';

export default function ProductsView() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'approved' | 'pending'>('approved');

  useEffect(() => {
    let q;
    if (filter === 'all') {
      q = query(collection(db, 'products'));
    } else {
      q = query(collection(db, 'products'), where('status', '==', filter));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(docs);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'products');
      setLoading(false);
    });

    return unsubscribe;
  }, [filter]);

  if (selectedProductId) {
    return <ProductEditor productId={selectedProductId} onBack={() => setSelectedProductId(null)} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">Products</h2>
          <p className="text-purple-400 text-xs sm:text-sm font-semibold mt-1">Browse and manage your complete product catalog</p>
        </div>

        {/* Filter Buttons */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {(['all', 'approved', 'pending'] as const).map(status => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={cn(
                'px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap uppercase tracking-widest',
                filter === status
                  ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-md'
                  : 'bg-white text-purple-600 border-2 border-purple-100 hover:border-purple-300'
              )}
            >
              {status === 'all' ? 'All Products' : status === 'approved' ? 'Approved' : 'Pending'}
            </button>
          ))}
        </div>
      </div>

      {/* Products Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-72 bg-purple-100 animate-pulse rounded-3xl border-2 border-purple-100" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border-2 border-purple-100 shadow-sm">
          <div className="flex justify-center mb-4">
            <Package className="w-12 h-12 text-purple-300" />
          </div>
          <p className="text-purple-400 text-sm font-semibold">No products found</p>
          <p className="text-purple-300 text-xs mt-1">Create your first product to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {products.map((product) => (
            <motion.button
              key={product.id}
              onClick={() => setSelectedProductId(product.id)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -4, boxShadow: '0 12px 24px rgba(168, 85, 247, 0.1)' }}
              whileTap={{ scale: 0.98 }}
              className="bg-white rounded-3xl border-2 border-purple-100 overflow-hidden hover:border-purple-300 transition-all text-left shadow-sm"
            >
              {/* Gradient Bar */}
              <div className="h-1.5 bg-gradient-to-r from-pink-500 to-purple-600" />

              {/* Image */}
              <div className="relative h-40 bg-purple-50 overflow-hidden group">
                <img
                  src={product.imageUrl}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  alt={product.name}
                />
                <span
                  className={cn(
                    'absolute top-3 right-3 text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-widest',
                    product.status === 'approved'
                      ? 'bg-green-100 text-green-700'
                      : product.status === 'pending'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-red-100 text-red-700'
                  )}
                >
                  {product.status}
                </span>
              </div>

              {/* Content */}
              <div className="p-4 sm:p-5 space-y-3">
                <div>
                  <h3 className="font-black text-purple-900 text-sm mb-1 line-clamp-2">{product.name}</h3>
                  <p className="text-xs text-purple-400 font-semibold">{product.category}</p>
                </div>

                <div className="space-y-2 pt-3 border-t-2 border-purple-100">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-purple-400 uppercase tracking-widest">Price</span>
                    <span className="font-black text-sm text-purple-900">R{product.discountPrice}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-purple-400 uppercase tracking-widest">Stock</span>
                    <span className="font-black text-sm text-purple-900">{product.stock}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-purple-400 uppercase tracking-widest">Allocated</span>
                    <span className="font-black text-sm bg-gradient-to-r from-green-400 to-emerald-600 bg-clip-text text-transparent">
                      {(product.allocations?.store || 0) + (product.allocations?.auction || 0) + (product.allocations?.packs || 0)}
                    </span>
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedProductId(product.id);
                  }}
                  className="w-full mt-4 py-2.5 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-2xl transition-colors flex items-center justify-center gap-2 uppercase tracking-widest"
                >
                  Edit Details
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
}
