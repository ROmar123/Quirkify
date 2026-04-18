import { useState, useEffect } from 'react';
import { Product } from '../../../types';
import { subscribeToProducts } from '../../../services/productService';
import { motion } from 'motion/react';
import { Package, Search, X } from 'lucide-react';
import { cn } from '../../../lib/utils';
import ProductEditor from './ProductEditor';

interface ProductsViewProps {
  onBack?: () => void;
}

export default function ProductsView({ onBack }: ProductsViewProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const unsub = subscribeToProducts('approved', (data) => {
      setProducts(data);
      setLoading(false);
    }, { skipDemo: true });
    return unsub;
  }, []);

  if (selectedProductId) {
    return <ProductEditor productId={selectedProductId} onBack={() => setSelectedProductId(null)} />;
  }

  const filtered = search.trim()
    ? products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.category?.toLowerCase().includes(search.toLowerCase()))
    : products;

  return (
    <div className="space-y-5">
      {/* Search */}
      {products.length > 0 && (
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search products…"
            className="input pl-11 pr-10"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-gray-100">
              <X className="w-3.5 h-3.5 text-gray-400" />
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="skeleton h-72 rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-16 text-center bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
            <Package className="w-7 h-7 text-gray-300" />
          </div>
          <p className="text-gray-700 text-sm font-semibold">
            {search ? 'No products match your search' : 'No approved products yet'}
          </p>
          <p className="text-gray-400 text-xs mt-1">
            {search ? 'Try a different keyword' : 'Approve products in Product Onboarding'}
          </p>
        </div>
      ) : (
        <>
          {search && (
            <p className="text-xs text-gray-400 font-medium">{filtered.length} of {products.length} products</p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((product, idx) => (
              <motion.button
                key={product.id}
                onClick={() => setSelectedProductId(product.id)}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx * 0.04, 0.3) }}
                whileHover={{ y: -3, boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}
                whileTap={{ scale: 0.98 }}
                className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:border-gray-200 transition-all text-left shadow-sm group"
              >
                {/* Color accent bar */}
                <div className="h-1 bg-gradient-to-r from-purple-500 to-indigo-500" />

                {/* Image */}
                <div className="relative h-44 bg-gray-50 overflow-hidden">
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-10 h-10 text-gray-200" />
                    </div>
                  )}
                  {(product.stock || 0) <= 5 && (product.stock || 0) > 0 && (
                    <div className="absolute top-2.5 right-2.5 px-2 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded-full">
                      Low stock
                    </div>
                  )}
                  {(product.stock || 0) === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-sm">
                      <span className="text-xs font-bold text-gray-500 bg-white px-3 py-1.5 rounded-full border border-gray-200">
                        Out of stock
                      </span>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-4 space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 line-clamp-1">{product.name}</h3>
                    <p className="text-[11px] text-gray-400 font-medium mt-0.5 uppercase tracking-wide">{product.category}</p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <div>
                      <p className="section-label">Retail</p>
                      <p className="text-sm font-bold text-gray-900">R{(product.retailPrice || 0).toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="section-label">Stock</p>
                      <p className={cn('text-sm font-bold', (product.stock || 0) <= 5 ? 'text-amber-600' : 'text-gray-900')}>
                        {product.stock || 0}
                      </p>
                    </div>
                  </div>

                  <div className="text-xs font-semibold text-quirky flex items-center justify-between">
                    <span>Edit product</span>
                    <span className="group-hover:translate-x-0.5 transition-transform">→</span>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
