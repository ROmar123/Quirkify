import { useState, useEffect } from 'react';
import { Product } from '../../../types';
import { subscribeToProductsAdmin } from '../../../services/adminProductService';
import { motion } from 'motion/react';
import { Package, Search, X } from 'lucide-react';
import { cn } from '../../../lib/utils';
import ProductEditor from './ProductEditor';

type ChannelFilter = 'all' | 'store' | 'auction' | 'both' | 'pack';

const CHANNEL_FILTERS: Array<{ key: ChannelFilter; label: string }> = [
  { key: 'all',     label: 'All' },
  { key: 'store',   label: 'Store' },
  { key: 'auction', label: 'Auction' },
  { key: 'both',    label: 'Both' },
  { key: 'pack',    label: 'Pack' },
];

const CHANNEL_BADGE: Record<string, { label: string; color: string }> = {
  store:   { label: 'Store',    color: '#6366f1' },
  auction: { label: 'Auction',  color: '#f59e0b' },
  both:    { label: 'Both',     color: '#a855f7' },
  pack:    { label: 'Pack',     color: '#06b6d4' },
};

interface ProductsViewProps {
  onBack?: () => void;
}

export default function ProductsView({ onBack }: ProductsViewProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('all');

  useEffect(() => {
    return subscribeToProductsAdmin('approved', (data) => {
      setProducts(data);
      setLoading(false);
    });
  }, []);

  if (selectedProductId) {
    return <ProductEditor productId={selectedProductId} onBack={() => setSelectedProductId(null)} />;
  }

  const filtered = products.filter(p => {
    const matchesChannel = channelFilter === 'all' || (p.listingType || 'store') === channelFilter;
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || (p.name || '').toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q);
    return matchesChannel && matchesSearch;
  });

  return (
    <div className="space-y-5">
      {/* Channel filter strip */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {CHANNEL_FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setChannelFilter(f.key)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-bold transition-all border',
              channelFilter === f.key
                ? 'bg-purple-600 text-white border-purple-600'
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Search */}
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
            {search || channelFilter !== 'all' ? 'No products match' : 'No approved products yet'}
          </p>
          <p className="text-gray-400 text-xs mt-1">
            {search || channelFilter !== 'all' ? 'Try a different filter' : 'Approve products in the Review tab'}
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-400 font-medium">
            {filtered.length} of {products.length} product{products.length !== 1 ? 's' : ''}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((product, idx) => {
              const ch = CHANNEL_BADGE[product.listingType || 'store'] || CHANNEL_BADGE.store;
              const selling = product.discountPrice ?? product.retailPrice ?? 0;
              const retail = product.retailPrice ?? 0;
              const hasDiscount = selling > 0 && retail > 0 && selling < retail;
              return (
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
                  <div className="h-1 bg-gradient-to-r from-purple-500 to-indigo-500" />

                  <div className="relative h-44 bg-gray-50 overflow-hidden">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-10 h-10 text-gray-200" />
                      </div>
                    )}

                    {/* Channel badge */}
                    <span
                      className="absolute top-2.5 left-2.5 text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                      style={{ background: ch.color }}
                    >
                      {ch.label}
                    </span>

                    {(product.stock || 0) <= 5 && (product.stock || 0) > 0 && (
                      <div className="absolute top-2.5 right-2.5 px-2 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded-full">
                        Low stock
                      </div>
                    )}
                    {(product.stock || 0) === 0 && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-sm">
                        <span className="text-xs font-bold text-gray-500 bg-white px-3 py-1.5 rounded-full border border-gray-200">Out of stock</span>
                      </div>
                    )}
                  </div>

                  <div className="p-4 space-y-3">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 line-clamp-1">{product.name}</h3>
                      <p className="text-[11px] text-gray-400 font-medium mt-0.5 uppercase tracking-wide">{product.category}</p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                      <div>
                        <p className="section-label">Selling</p>
                        <p className="text-sm font-bold text-purple-600">R{selling.toLocaleString()}</p>
                        {hasDiscount && (
                          <p className="text-[10px] text-gray-400 line-through">R{retail.toLocaleString()}</p>
                        )}
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
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
