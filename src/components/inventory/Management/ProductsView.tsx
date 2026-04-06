import { useState, useEffect } from 'react';
import { Product } from '../../../types';
import { subscribeToProducts } from '../../../services/productService';
import { motion } from 'motion/react';
import { Package } from 'lucide-react';
import { cn } from '../../../lib/utils';
import ProductEditor from './ProductEditor';

interface ProductsViewProps {
  onBack?: () => void;
}

export default function ProductsView({ onBack }: ProductsViewProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeToProducts('approved', (data) => {
      setProducts(data);
      setLoading(false);
    });
    return unsub;
  }, []);

  if (selectedProductId) {
    return <ProductEditor productId={selectedProductId} onBack={() => setSelectedProductId(null)} />;
  }

  return (
    <div className="space-y-6">
      {/* Products Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-80 bg-gray-200 animate-pulse rounded-3xl border-2 border-purple-100" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border-2 border-purple-100 shadow-sm">
          <div className="flex justify-center mb-4">
            <Package className="w-12 h-12 text-purple-300" />
          </div>
          <p className="text-purple-600 text-sm font-bold">No Approved Products</p>
          <p className="text-purple-400 text-xs mt-1">Create and approve products in Product Onboarding</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <motion.button
              key={product.id}
              onClick={() => setSelectedProductId(product.id)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -6, boxShadow: '0 20px 40px rgba(168, 85, 247, 0.15)' }}
              whileTap={{ scale: 0.98 }}
              className="bg-white rounded-3xl border-2 border-purple-100 overflow-hidden hover:border-purple-300 transition-all text-left shadow-sm group"
            >
              {/* Gradient Bar */}
              <div className="h-1.5 bg-gradient-to-r from-purple-500 to-indigo-600" />

              {/* Image */}
              <div className="relative h-48 bg-purple-50 overflow-hidden">
                {product.imageUrl ? (
                  <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-12 h-12 text-purple-200" />
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-4 space-y-3">
                <div>
                  <h3 className="text-sm font-black text-purple-900 line-clamp-2">{product.name}</h3>
                  <p className="text-[10px] text-purple-400 font-semibold mt-1">{product.category}</p>
                </div>

                {/* Pricing */}
                <div className="flex items-center justify-between border-t border-purple-100 pt-3">
                  <div>
                    <p className="text-[10px] text-purple-400 font-bold uppercase tracking-widest">Retail</p>
                    <p className="text-sm font-black text-purple-900">R{(product.retailPrice || 0).toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-purple-400 font-bold uppercase tracking-widest">Stock</p>
                    <p className={cn('text-sm font-black', (product.stock || 0) <= 5 ? 'text-red-600' : 'text-green-600')}>
                      {product.stock || 0}
                    </p>
                  </div>
                </div>

                {/* Action */}
                <div className="text-xs font-bold text-purple-600 group-hover:text-purple-700 flex items-center justify-between pt-2">
                  <span>Edit Product</span>
                  <span>→</span>
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
}
