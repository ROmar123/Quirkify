import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, query, where, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import { Product, LiveSession } from '../../types';
import { fetchProducts } from '../../services/productService';
import { motion } from 'motion/react';
import { ShoppingBag, Play, Users, Search, X, Tag, Shield, Truck, Sparkles, ArrowUpRight, SlidersHorizontal } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { useCart } from '../../context/CartContext';
import { PRODUCT_CATEGORIES } from '../../lib/categories';
import { sanitizeInput, searchRateLimiter } from '../../lib/security';
import { ProductSkeleton, ErrorState } from '../ui/LoadingSpinner';

const CONDITION_FILTERS = [
  { key: null,        label: 'All' },
  { key: 'sale',      label: '🔥 Sale' },
  { key: 'New',       label: '✨ New' },
  { key: 'Pre-owned', label: '💎 Pre-owned' },
];

const RARITY_STYLE: Record<string, string> = {
  Unique:     'bg-yellow-400 text-black',
  'Super Rare': 'bg-pink-500 text-white',
  Rare:       'bg-purple-500 text-white',
  Common:     'bg-purple-700 text-white',
};

export default function StoreFront() {
  const { addToCart } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [liveSessions, setLiveSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Sanitized search handler with rate limiting
  const handleSearchChange = useCallback((value: string) => {
    const sanitized = sanitizeInput(value);
    
    if (sanitized !== value) {
      console.warn('[Security] Potentially dangerous input sanitized');
    }
    
    if (!searchRateLimiter.canProceed('storefront_search')) {
      setRateLimitError('Please slow down your search. Try again in a moment.');
      setTimeout(() => setRateLimitError(null), 3000);
      return;
    }
    
    setRateLimitError(null);
    setSearch(sanitized);
  }, []);

  const loadProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchProducts('approved');
      setProducts(data);
    } catch (err) {
      console.error('Failed to load products:', err);
      setError('Failed to load products. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();

    // Live sessions stay on Firestore (real-time bidding)
    const qLive = query(collection(db, 'live_sessions'), where('status', '==', 'live'), limit(3));
    const unsubLive = onSnapshot(qLive, (snap) => {
      setLiveSessions(snap.docs.map(d => ({ id: d.id, ...d.data() } as LiveSession)));
    }, () => {});

    return () => { unsubLive(); };
  }, []);

  const filtered = useMemo(() => {
    let list = products;
    if (activeFilter === 'sale') list = list.filter(p => p.discountPrice && p.discountPrice < p.priceRange.min);
    else if (activeFilter) list = list.filter(p => p.condition === activeFilter);
    if (activeCategory) list = list.filter(p => p.category === activeCategory);
    if (search.trim()) {
      const safeSearch = search.toLowerCase();
      list = list.filter(p => 
        p.name.toLowerCase().includes(safeSearch) || 
        p.category?.toLowerCase().includes(safeSearch)
      );
    }
    return list;
  }, [products, activeFilter, activeCategory, search]);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="px-4 py-4 pb-8 md:pb-12">
      <div className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.9fr)]">
        <div className="rounded-[2rem] border border-purple-100 bg-white/90 p-5 shadow-sm shadow-purple-100/60 md:p-7">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-purple-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.28em] text-purple-700">
              Quirkify Storefront
            </span>
          </div>
          <div className="mt-4 max-w-2xl">
            <h1 className="text-3xl font-black leading-tight text-purple-900 md:text-5xl">
              Curated resale, auction energy, and quirky finds in one clean storefront.
            </h1>
            <p className="mt-3 text-sm font-semibold leading-6 text-purple-500 md:max-w-xl">
              South Africa's home for verified collectibles, limited drops, and pre-loved finds. Every item is AI-checked before it hits the shelf.
            </p>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <div className="rounded-2xl bg-purple-50 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-purple-400">Products listed</p>
              <p className="mt-1 text-2xl font-black text-purple-900">{loading ? '—' : products.length}</p>
            </div>
            <div className="rounded-2xl bg-purple-50 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-purple-400">Live auctions</p>
              <p className="mt-1 text-2xl font-black text-purple-900">{liveSessions.length}</p>
            </div>
            <div className="rounded-2xl bg-purple-50 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-purple-400">Categories</p>
              <p className="mt-1 text-2xl font-black text-purple-900">13</p>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-purple-100 bg-[linear-gradient(135deg,#2D1B69_0%,#7E22CE_55%,#F472B6_100%)] p-5 text-white shadow-lg shadow-purple-200/50 md:p-6">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[10px] font-black uppercase tracking-[0.28em] text-pink-100">Why Quirkify</span>
            <ArrowUpRight className="h-4 w-4 text-pink-100" />
          </div>
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-pink-100">AI Verified</p>
              <p className="mt-2 text-sm font-semibold text-white/90">Every listing is analysed by AI before approval — no fakes, no misleading descriptions.</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-pink-100">Auction Drops</p>
              <p className="mt-2 text-sm font-semibold text-white/90">Bid live on limited and rare pieces. New drops added regularly — set a reminder and don't miss out.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Live banner */}
      {liveSessions.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="mb-6 rounded-2xl overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #2D1B69, #A855F7)' }}>
          <div className="flex items-center gap-4 px-5 py-3 overflow-x-auto">
            <span className="text-[9px] font-black uppercase tracking-widest text-pink-300 whitespace-nowrap flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse inline-block" /> Live Now
            </span>
            {liveSessions.map(s => (
              <Link key={s.id} to={`/live/${s.id}`}
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 rounded-xl px-3 py-1.5 transition-colors whitespace-nowrap">
                <Play className="w-3 h-3 text-white fill-white" />
                <span className="text-xs font-bold text-white">{s.title}</span>
                <span className="text-[9px] text-white/60 flex items-center gap-1"><Users className="w-3 h-3" />{s.viewerCount}</span>
              </Link>
            ))}
          </div>
        </motion.div>
      )}

      {/* Search + Filters */}
      <div className="mb-8 space-y-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-300 pointer-events-none" />
          <input
            value={search}
            onChange={e => handleSearchChange(e.target.value)}
            placeholder="Search products…"
            className="w-full pl-11 pr-10 py-3.5 bg-white border-2 border-purple-100 rounded-2xl text-sm font-semibold text-purple-800 placeholder:text-purple-300 focus:outline-none focus:border-purple-400 transition-colors"
            maxLength={100}
            aria-label="Search products"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-purple-50" aria-label="Clear search">
              <X className="w-4 h-4 text-purple-400" />
            </button>
          )}
        </div>
        {rateLimitError && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs font-bold text-amber-700">
            {rateLimitError}
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_220px]">
          <div className="hidden md:flex items-center gap-2 rounded-2xl border-2 border-dashed border-purple-100 bg-white px-4 text-xs font-bold uppercase tracking-[0.22em] text-purple-400">
            <SlidersHorizontal className="h-4 w-4" />
            Refine the catalogue
          </div>
          <select
            value={activeFilter ?? ''}
            onChange={e => setActiveFilter(e.target.value || null)}
            className="flex-1 px-4 py-2.5 bg-white border-2 border-purple-100 rounded-2xl text-sm font-bold text-purple-800 focus:outline-none focus:border-purple-400 transition-colors appearance-none cursor-pointer"
          >
            {CONDITION_FILTERS.map(f => (
              <option key={String(f.key)} value={f.key ?? ''}>{f.label}</option>
            ))}
          </select>
          <select
            value={activeCategory ?? ''}
            onChange={e => setActiveCategory(e.target.value || null)}
            className="flex-1 px-4 py-2.5 bg-white border-2 border-purple-100 rounded-2xl text-sm font-bold text-purple-800 focus:outline-none focus:border-purple-400 transition-colors appearance-none cursor-pointer"
          >
            <option value="">All Categories</option>
            {PRODUCT_CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Product Grid */}
      <div>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-black gradient-text">
            {activeFilter === 'sale' ? '🔥 Sale' : activeFilter === 'New' ? '✨ New Arrivals' : activeFilter === 'Pre-owned' ? '💎 Pre-owned' : 'All Products'}
            {!loading && filtered.length > 0 && <span className="text-purple-300 font-semibold text-sm ml-2">({filtered.length})</span>}
          </h2>
        </div>

        {loading ? (
          <ProductSkeleton count={8} />
        ) : error ? (
          <ErrorState
            title="Couldn't load products"
            message={error}
            onRetry={loadProducts}
            onGoHome={() => navigate('/')}
          />
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 rounded-3xl border border-purple-100 bg-purple-50">
            <ShoppingBag className="w-10 h-10 mx-auto mb-3 text-purple-200" />
            <p className="text-purple-400 font-bold text-sm">No products found</p>
            {search && <button onClick={() => setSearch('')} className="mt-3 text-xs font-bold text-purple-500 underline">Clear search</button>}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
            {filtered.map((product, idx) => {
              const isSoldOut = product.stock === 0;
              const isLowStock = product.stock > 0 && product.stock < 5;
              const hasDiscount = product.discountPrice && product.discountPrice < product.priceRange.min;
              return (
                <motion.div key={product.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(idx * 0.04, 0.3) }}
                  className="bg-white rounded-3xl border border-purple-100 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 group flex flex-col"
                >
                  {/* Image */}
                  <Link to={`/product/${product.id}`} className="relative block aspect-[3/4] overflow-hidden bg-purple-50">
                    <img 
                      src={product.imageUrl} 
                      alt={product.name}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/placeholder-product.png';
                      }}
                    />
                    {/* Badges */}
                    <div className="absolute top-2 left-2 flex flex-col gap-1">
                      {product.rarity && (
                        <span className={cn('text-[8px] font-bold px-2 py-0.5 rounded-full', RARITY_STYLE[product.rarity] ?? 'bg-purple-700 text-white')}>
                          {product.rarity}
                        </span>
                      )}
                      {hasDiscount && <span className="text-[8px] font-bold px-2 py-0.5 rounded-full bg-red-500 text-white flex items-center gap-0.5"><Tag className="w-2 h-2" />Sale</span>}
                      {isLowStock && <span className="text-[8px] font-bold px-2 py-0.5 rounded-full bg-orange-400 text-white">Last {product.stock}!</span>}
                      {isSoldOut && <span className="text-[8px] font-bold px-2 py-0.5 rounded-full bg-purple-300 text-white">Sold Out</span>}
                    </div>
                  </Link>

                  {/* Info */}
                  <div className="p-3 flex flex-col gap-2 flex-1">
                    <div>
                      <Link to={`/product/${product.id}`}>
                        <p className="text-xs font-black leading-tight line-clamp-2 hover:text-purple-600 transition-colors">{product.name}</p>
                      </Link>
                      {product.condition && <p className="text-[9px] text-purple-400 font-semibold mt-0.5">{product.condition}</p>}
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
                        <Link to={`/product/${product.id}`} className="text-[9px] font-bold text-purple-400 underline">Details</Link>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Trust strip */}
      <div className="mt-10 rounded-3xl border border-purple-100 bg-white px-4 py-5 shadow-sm md:mt-16 md:px-6 md:py-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6">
        {[
          { icon: Shield, label: 'Secure Payments', sub: 'Powered by Yoco' },
          { icon: Sparkles, label: 'AI Verified', sub: 'Every item checked' },
          { icon: Truck, label: 'Fast Delivery', sub: 'The Courier Guy' },
        ].map(({ icon: Icon, label, sub }) => (
          <div key={label} className="flex items-center gap-3 rounded-2xl bg-purple-50/70 px-4 py-3 text-left sm:flex-col sm:bg-transparent sm:px-0 sm:py-0 sm:text-center">
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
