import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../../firebase';
import { Product } from '../../../types';
import { motion } from 'motion/react';
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
    return <ProductEditor productId={selectedProductId} onBack={() => setSelectedProductId(null)} />;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Products</h2>
          <p className="text-gray-600 text-sm">View and manage all products</p>
        </div>

        {/* Filter */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {(['all', 'approved', 'pending'] as const).map(status => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={cn(
                'px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap',
                filter === status
                  ? 'bg-purple-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:border-gray-400'
              )}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Products Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-64 bg-gray-100 animate-pulse rounded-lg" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-lg border border-gray-200">
          <p className="text-gray-500 text-sm">No products found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <motion.button
              key={product.id}
              onClick={() => setSelectedProductId(product.id)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md hover:border-gray-300 transition-all text-left"
            >
              {/* Image */}
              <div className="relative h-40 bg-gray-100 overflow-hidden group">
                <img
                  src={product.imageUrl}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  alt=""
                />
                <span
                  className={cn(
                    'absolute top-3 right-3 text-xs font-semibold px-3 py-1 rounded-full',
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
              <div className="p-4 space-y-3">
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm mb-1 line-clamp-2">{product.name}</h3>
                  <p className="text-xs text-gray-500">{product.category}</p>
                </div>

                <div className="space-y-2 pt-3 border-t border-gray-200">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-gray-600">Price</span>
                    <span className="font-semibold text-sm text-gray-900">R{product.discountPrice}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-gray-600">Stock</span>
                    <span className="font-semibold text-sm text-gray-900">{product.stock}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-gray-600">Allocated</span>
                    <span className="font-semibold text-sm text-green-600">
                      {(product.allocations?.store || 0) + (product.allocations?.auction || 0) + (product.allocations?.packs || 0)}
                    </span>
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedProductId(product.id);
                  }}
                  className="w-full mt-3 py-2 text-xs font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  View Details
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
