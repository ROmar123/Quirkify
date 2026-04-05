import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../../firebase';
import { Product } from '../../../types';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight } from 'lucide-react';
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
    return (
      <ProductEditor
        productId={selectedProductId}
        onBack={() => setSelectedProductId(null)}
      />
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-purple-900 mb-2">Products</h1>
        <p className="text-purple-400 text-sm font-semibold mb-6">View and manage all products</p>

        <div className="flex gap-2">
          {(['all', 'approved', 'pending'] as const).map(status => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={cn(
                'px-4 py-2 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all whitespace-nowrap',
                filter === status
                  ? 'text-white border-transparent'
                  : 'bg-white text-purple-400 border-2 border-purple-100 hover:border-purple-300'
              )}
              style={filter === status ? { background: 'linear-gradient(135deg, #F472B6, #A855F7)' } : {}}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          [1, 2, 3].map(i => (
            <div key={`skeleton-${i}`} className="h-64 bg-purple-50 animate-pulse rounded-3xl border border-purple-100" />
          ))
        ) : products.length === 0 ? (
          <div className="col-span-full p-12 text-center bg-white rounded-3xl border border-purple-100">
            <p className="text-purple-300 text-xs font-bold uppercase tracking-widest">No products found</p>
          </div>
        ) : (
          products.map((product) => (
            <motion.button
              key={product.id}
              onClick={() => setSelectedProductId(product.id)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-3xl border border-purple-100 overflow-hidden hover:shadow-lg transition-all text-left group"
            >
              {/* Image */}
              <div className="relative h-40 bg-purple-50 overflow-hidden">
                <img src={product.imageUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform" alt="" />
                <span className={cn(
                  'absolute top-3 right-3 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full',
                  product.status === 'approved' ? 'text-green-600 bg-green-50' : 'text-amber-600 bg-amber-50'
                )}>
                  {product.status}
                </span>
              </div>

              {/* Content */}
              <div className="p-4 space-y-3">
                <div>
                  <h3 className="font-bold text-sm text-purple-900 uppercase tracking-tight mb-1 line-clamp-2">{product.name}</h3>
                  <p className="text-[10px] text-purple-400 font-bold">{product.category}</p>
                </div>

                <div className="space-y-2 border-t border-purple-100 pt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-purple-400 font-bold">Pricing</span>
                    <span className="font-bold text-sm text-purple-900">R{product.discountPrice}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-purple-400 font-bold">Stock</span>
                    <span className="font-bold text-sm text-purple-900">{product.stock} units</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-purple-400 font-bold">Allocated</span>
                    <span className="font-bold text-sm text-green-600">
                      {(product.allocations?.store || 0) + (product.allocations?.auction || 0) + (product.allocations?.packs || 0)}
                    </span>
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedProductId(product.id);
                  }}
                  className="w-full mt-3 py-2 text-xs font-bold text-purple-700 bg-purple-50 border border-purple-100 rounded-2xl hover:border-purple-300 transition-all flex items-center justify-center gap-2 group-hover:bg-purple-100"
                >
                  View Details
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </motion.button>
          ))
        )}
      </div>
    </div>
  );
}
