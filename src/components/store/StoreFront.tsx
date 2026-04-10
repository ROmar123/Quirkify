import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import { Product, LiveSession } from '../../types';
import { fetchProducts } from '../../services/productService';
import { motion } from 'motion/react';
import { ShoppingBag, Play, Users, Search, X, Tag, Shield, Truck, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { useCart } from '../../context/CartContext';
import { PRODUCT_CATEGORIES } from '../../lib/categories';

const CONDITION_FILTERS = [
  { key: null, label: 'All' },
  { key: 'sale', label: '🔥 Sale' },
  { key: 'New', label: '✨ New' },
  { key: 'Pre-owned', label: '💎 Pre-owned' },
];

const RARITY_STYLE: Record<string, string> = {
  Unique: 'bg-yellow-400 text-black',
  'Super Rare': 'bg-pink-500 text-white',
  Rare: 'bg-purple-500 text-white',
  Common: 'bg-purple-700 text-white',
};

export default function StoreFront() {
  const { addToCart } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [liveSessions, setLiveSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    fetchProducts('approved')
      .then((data) => {
        if (!mounted) return;
        setProducts(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load products:', err);
        if (!mounted) return;
        setProducts([]);
        setLoading(false);
      });

    const qLive = query(collection(db, 'live_sessions'), where('status', '==', 'live'), limit(3));
    const unsubLive = onSnapshot(qLive, (snap) => {
      if (!mounted) return;
      setLiveSessions(snap.docs.map((d) => ({ id: d.id, ...d.data() } as LiveSession)));
    }, (error) => {
      if (!mounted) return;
      console.error('Failed to subscribe to live sessions:', error);
      setLiveSessions([]);
    });

    return () => {
      mounted = false;
      unsubLive();
    };
  }, []);

  const filtered = useMemo(() => {
    let list = products;

    if (activeFilter === 'sale') {
      list = list.filter((p) => p.discountPrice && p.discountPrice < p.priceRange.min);
    } else if (activeFilter) {
      list = list.filter((p) => p.condition === activeFilter);
    }

    if (activeCategory) {
      list = list.filter((p) => p.category === activeCategory);
    }

    if (search.trim()) {
      const needle = search.toLowerCase();
      list = list.filter(
        (p) => p.name.toLowerCase().includes(needle) || p.category?.toLowerCase().includes(needle)
      );
    }

    return list;
  }, [products, activeFilter, activeCategory, search]);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="px-4 py-4 pb-8 md:pb-12">
        {liveSessions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 rounded-2xl overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #2D1B69, #A855F7)' }}
          >
            <div className="flex items-center gap-4 px-5 py-3 overflow-x-auto">
              <span className="text-[9px] font-black uppercase tracking-widest text-pink-300 whitespace-nowrap flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse inline-block" />
                Live Now
              </span>
              {liveSessions.map((session) => (
                <Link
                  key={session.id}
                  to={`/live/${session.id}`}
                  className="flex items-center gap-2 bg-white/10 hover:bg-white/20 rounded-xl px-3 py-1.5 transition-colors whitespace-nowrap"
                >
                  <Play className="w-3 h-3 text-white fill-white" />
                  <span className="text-xs font-bold text-white">{session.title}</span>
                  <span className="text-[9px] text-white/60 flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {session.viewerCount}
                  </span>
                </Link>
              ))}
            </div>
          </motion.div>
        )}

        <div className="mb-8 space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-300 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products…"
              className="w-full pl-11 pr-10 py-3.5 bg-white border-2 border-purple-100 rounded-2xl text-sm font-semibold text-purple-800 placeholder:text-purple-300 focus:outline-none focus:border-purple-400 transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-purple-50"
              >
                <X className="w-4 h-4 text-purple-400" />
              </button>
            )}
          </div>

          <div className="flex gap-3">
            <select
              value={activeFilter ?? ''}
              onChange={(e) => setActiveFilter(e.target.value || null)}
              className="flex-1 px-4 py-2.5 bg-white border-2 border-purple-100 rounded-2xl text-sm font-bold text-purple-800 focus:outline-none focus:border-purple-400 transition-colors appearance-none cursor-pointer"
            >
              {CONDITION_FILTERS.map((filter) => (
                <option key={String(filter.key)} value={filter.key ?? ''}>
                  {filter.label}
                </option>
              ))}
            </select>
            <select
              value={activeCategory ?? ''}
              onChange={(e) => setActiveCategory(e.target.value || null)}
              className="flex-1 px-4 py-2.5 bg-white border-2 border-purple-100 rounded-2xl text-sm font-bold text-purple-800 focus:outline-none focus:border-purple-400 transition-colors appearance-none cursor-pointer"
            >
              <option value="">All Categories</option>
              {PRODUCT_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-black gradient-text">
              {activeFilter === 'sale'
                ? '🔥 Sale'
                : activeFilter === 'New'
                  ? '✨ New Arrivals'
                  : activeFilter === 'Pre-owned'
                    ? '💎 Pre-owned'
                    : 'All Products'}
              {!loading && filtered.length > 0 && (
                <span className="text-purple-300 font-semibold text-sm ml-2">({filtered.length})</span>
              )}
            </h2>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="aspect-[3/4] bg-purple-50 animate-pulse rounded-3xl" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-24 rounded-3xl border border-purple-100 bg-purple-50">
              <ShoppingBag className="w-10 h-10 mx-auto mb-3 text-purple-200" />
              <p className="text-purple-400 font-bold text-sm">No products found</p>
              {search && (
                <button onClick={() => setSearch('')} className="mt-3 text-xs font-bold text-purple-500 underline">
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filtered.map((product, idx) => {
                const isSoldOut = product.stock === 0;
                const isLowStock = product.stock > 0 && product.stock < 5;
                const hasDiscount = product.discountPrice && product.discountPrice < product.priceRange.min;

                return (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(idx * 0.04, 0.3) }}
                    className="bg-white rounded-3xl border border-purple-100 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 group flex flex-col"
                  >
                    <Link to={`/product/${product.id}`} className="relative block aspect-[3/4] overflow-hidden bg-purple-50">
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute top-2 left-2 flex flex-col gap-1">
                        {product.rarity && (
                          <span
                            className={cn(
                              'text-[8px] font-bold px-2 py-0.5 rounded-full',
                              RARITY_STYLE[product.rarity] ?? 'bg-purple-700 text-white'
                            )}
                          >
                            {product.rarity}
                          </span>
                        )}
                        {hasDiscount && (
                          <span className="text-[8px] font-bold px-2 py-0.5 rounded-full bg-red-500 text-white flex items-center gap-0.5">
                            <Tag className="w-2 h-2" />
                            Sale
                          </span>
                        )}
                        {isLowStock && (
                          <span className="text-[8px] font-bold px-2 py-0.5 rounded-full bg-orange-400 text-white">
                            Last {product.stock}!
                          </span>
                        )}
                        {isSoldOut && (
                          <span className="text-[8px] font-bold px-2 py-0.5 rounded-full bg-purple-300 text-white">
                            Sold Out
                          </span>
                        )}
                      </div>
                    </Link>

                    <div className="p-3 flex flex-col gap-2 flex-1">
                      <div>
                        <Link to={`/product/${product.id}`}>
                          <p className="text-xs font-black leading-tight line-clamp-2 hover:text-purple-600 transition-colors">
                            {product.name}
                          </p>
                        </Link>
                        {product.condition && (
                          <p className="text-[9px] text-purple-400 font-semibold mt-0.5">{product.condition}</p>
                        )}
                      </div>

                      <div className="flex items-center justify-between mt-auto">
                        {hasDiscount ? (
                          <div>
                            <p className="text-[9px] text-purple-300 line-through">R{product.priceRange.min}</p>
                            <p className="text-sm font-black text-red-500">R{product.discountPrice}</p>
                          </div>
                        ) : (
                          <p className="text-sm font-black gradient-text">R{product.priceRange.min}</p>
                        )}
                        {!isSoldOut ? (
                          <button
                            onClick={() => addToCart(product)}
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white shadow-md hover:scale-110 transition-transform flex-shrink-0"
                            style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}
                            title="Add to cart"
                          >
                            <ShoppingBag className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <Link to={`/product/${product.id}`} className="text-[9px] font-bold text-purple-400 underline">
                            Details
                          </Link>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-10 rounded-3xl border border-purple-100 bg-white px-4 py-5 shadow-sm md:mt-16 md:px-6 md:py-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6">
            {[
              { icon: Shield, label: 'Secure Payments', sub: 'Powered by Yoco' },
              { icon: Sparkles, label: 'AI Verified', sub: 'Every item checked' },
              { icon: Truck, label: 'Fast Delivery', sub: 'The Courier Guy' },
            ].map(({ icon: Icon, label, sub }) => (
              <div
                key={label}
                className="flex items-center gap-3 rounded-2xl bg-purple-50/70 px-4 py-3 text-left sm:flex-col sm:bg-transparent sm:px-0 sm:py-0 sm:text-center"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white shadow-sm">
                  <Icon className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-purple-700">{label}</p>
                  <p className="text-[10px] text-purple-400">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
