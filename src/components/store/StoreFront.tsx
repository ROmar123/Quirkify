import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, SlidersHorizontal, Star } from 'lucide-react';
import { subscribeToProducts } from '../../services/productService';
import type { Product } from '../../types';
import { cn } from '../../lib/utils';

const CATEGORIES = ['All', 'Capsules', 'Cosmetics', 'Supplements', 'Tech', 'Home'];

export default function StoreFront() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeToProducts('approved', (data) => {
      setProducts(data);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const filtered = products.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.description?.toLowerCase().includes(search.toLowerCase());
    const matchCat = category === 'All' || p.category === category;
    return matchSearch && matchCat;
  });

  return (
    <div className="min-h-screen pb-20">
      {/* Trust strip */}
      <div className="w-full py-2 px-4 flex items-center justify-center gap-4 text-[10px] font-bold text-purple-500 border-b border-purple-50">
        <span>Secure Payments</span>
        <span className="text-purple-200">•</span>
        <span>AI Verified</span>
        <span className="text-purple-200">•</span>
        <span>Fast Delivery</span>
      </div>

      {/* Search */}
      <div className="sticky top-14 z-50 bg-white/90 backdrop-blur-sm border-b border-purple-50 px-4 py-3 space-y-3">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-300" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search quirky finds..."
              className="w-full pl-10 pr-4 py-2.5 rounded-full border-2 border-purple-100 text-sm font-semibold focus:outline-none focus:border-purple-400 bg-purple-50/30" />
          </div>
          <button onClick={() => setShowFilters(v => !v)} className={cn('p-2.5 rounded-full border-2 transition-colors', showFilters ? 'border-purple-400 bg-purple-50' : 'border-purple-100')}>
            <SlidersHorizontal className="w-4 h-4 text-purple-500" />
          </button>
        </div>
        {showFilters && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {CATEGORIES.map(c => (
              <button key={c} onClick={() => setCategory(c)}
                className={cn('flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-bold border-2 transition-colors',
                  category === c ? 'border-purple-400 bg-purple-500 text-white' : 'border-purple-100 text-purple-500 hover:border-purple-300'
                )}>
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Products */}
      <div className="px-4 py-4">
        <div className="grid grid-cols-2 gap-3">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] rounded-2xl bg-purple-50 animate-pulse" />
            ))
          ) : filtered.length === 0 ? (
            <div className="col-span-2 text-center py-16">
              <p className="text-purple-400 font-bold">No products found</p>
              <p className="text-purple-300 text-sm mt-1">Try adjusting your search or filters</p>
            </div>
          ) : filtered.map(product => (
            <Link key={product.id} to={`/product/${product.id}`} className="group">
              <div className="aspect-[3/4] rounded-2xl overflow-hidden border-2 border-purple-50 group-hover:border-purple-200 transition-all">
                <img src={product.imageUrl} alt={product.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/400x500/FDF4FF/A855F7?text=Quirkify'; }} />
              </div>
              <p className="text-xs font-black text-purple-900 mt-2 truncate">{product.name}</p>
              <p className="text-xs font-bold text-purple-400">R{product.discountPrice?.toFixed(0) || product.retailPrice?.toFixed(0)}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
