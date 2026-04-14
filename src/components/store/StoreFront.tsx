import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, query, where, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import { Product, LiveSession } from '../../types';
import { fetchProducts } from '../../services/productService';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShoppingBag, Play, Users, Search, X, Shield, Truck,
  Sparkles, SlidersHorizontal, Zap, Tag, ChevronRight,
  ArrowUpRight, TrendingUp, Package
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { useCart } from '../../context/CartContext';
import { PRODUCT_CATEGORIES } from '../../lib/categories';
import { sanitizeInput, searchRateLimiter } from '../../lib/security';
import { ProductSkeleton, ErrorState } from '../ui/LoadingSpinner';

const CONDITION_FILTERS = [
  { key: null,        label: 'All', emoji: '' },
  { key: 'sale',      label: 'Sale', emoji: '🔥' },
  { key: 'New',       label: 'New', emoji: '✨' },
  { key: 'Pre-owned', label: 'Pre-owned', emoji: '💎' },
];

const RARITY_CONFIG: Record<string, { gradient: string; text: string }> = {
  'Unique':     { gradient: 'linear-gradient(135deg,#f59e0b,#ef4444)', text: 'white' },
  'Super Rare': { gradient: 'linear-gradient(135deg,#f472b6,#a855f7)', text: 'white' },
  'Rare':       { gradient: 'linear-gradient(135deg,#a855f7,#6366f1)', text: 'white' },
  'Common':     { gradient: 'linear-gradient(135deg,#e0d2ff,#c4b5fd)', text: '#4c1d95' },
};

function ProductCard({ product, idx }: { product: Product; idx: number }) {
  const { addToCart } = useCart();
  const isSoldOut = product.stock === 0;
  const isLowStock = product.stock > 0 && product.stock < 5;
  const hasDiscount = product.discountPrice && product.discountPrice < product.priceRange.min;
  const rarity = RARITY_CONFIG[product.rarity || 'Common'];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(idx * 0.05, 0.4), duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="card-product group flex flex-col"
    >
      {/* Image */}
      <Link to={`/product/${product.id}`} className="relative block aspect-[3/4] overflow-hidden bg-gray-50 img-zoom">
        <img
          src={product.imageUrl}
          alt={product.name}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
          onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder-product.png'; }}
        />
        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/8 transition-colors duration-300" />

        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5">
          {product.rarity && product.rarity !== 'Common' && (
            <span
              className="text-[9px] font-bold px-2.5 py-1 rounded-full shadow-sm"
              style={{ background: rarity.gradient, color: rarity.text }}
            >
              {product.rarity}
            </span>
          )}
          {hasDiscount && (
            <span className="text-[9px] font-bold px-2.5 py-1 rounded-full bg-red-500 text-white flex items-center gap-0.5 shadow-sm">
              <Tag className="w-2.5 h-2.5" /> Sale
            </span>
          )}
          {isLowStock && (
            <span className="text-[9px] font-bold px-2.5 py-1 rounded-full bg-amber-500 text-white shadow-sm">
              {product.stock} left
            </span>
          )}
        </div>

        {/* Sold out overlay */}
        {isSoldOut && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-sm">
            <span className="text-xs font-bold text-gray-500 bg-white px-3 py-1.5 rounded-full border border-gray-200 shadow-sm">
              Sold Out
            </span>
          </div>
        )}

        {/* Quick add button */}
        {!isSoldOut && (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); addToCart(product); }}
            className="absolute bottom-3 right-3 w-9 h-9 rounded-full flex items-center justify-center text-white shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-200 translate-y-2 group-hover:translate-y-0"
            style={{ background: 'var(--gradient-primary)' }}
            title="Add to cart"
          >
            <ShoppingBag className="w-4 h-4" />
          </button>
        )}
      </Link>

      {/* Info */}
      <div className="p-3.5 flex flex-col gap-2 flex-1">
        <div className="flex-1">
          <Link to={`/product/${product.id}`}>
            <p className="text-sm font-semibold leading-tight line-clamp-2 text-gray-900 hover:text-purple-700 transition-colors">
              {product.name}
            </p>
          </Link>
          {product.condition && (
            <p className="text-[10px] text-gray-400 font-medium mt-0.5 uppercase tracking-wide">{product.condition}</p>
          )}
        </div>

        <div className="flex items-center justify-between mt-auto">
          {hasDiscount ? (
            <div>
              <p className="text-[10px] text-gray-300 line-through font-medium">R{product.priceRange.min}</p>
              <p className="price text-base text-red-500">R{product.discountPrice}</p>
            </div>
          ) : (
            <p className="price text-base gradient-text">R{product.priceRange.min}</p>
          )}

          {!isSoldOut ? (
            <button
              onClick={() => addToCart(product)}
              className="text-xs font-semibold px-3 py-1.5 rounded-full border border-purple-200 text-purple-600 hover:bg-purple-50 hover:border-purple-400 transition-all lg:hidden"
            >
              Add
            </button>
          ) : (
            <Link
              to={`/product/${product.id}`}
              className="text-[10px] font-semibold text-gray-400 hover:text-purple-500 transition-colors"
            >
              Details
            </Link>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function StoreFront() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [liveSessions, setLiveSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);

  const handleSearchChange = useCallback((value: string) => {
    const sanitized = sanitizeInput(value);
    if (!searchRateLimiter.canProceed('storefront_search')) {
      setRateLimitError('Too many searches. Please slow down.');
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
      setError('Failed to load products. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
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
      const q = search.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q));
    }
    return list;
  }, [products, activeFilter, activeCategory, search]);

  const saleCount = products.filter(p => p.discountPrice && p.discountPrice < p.priceRange.min).length;

  return (
    <div className="hero-bg min-h-screen">
      <div className="max-w-7xl mx-auto px-4 pt-8 pb-24">

        {/* ── Hero Section ── */}
        <section className="mb-10">
          <div className="grid gap-4 lg:grid-cols-[1fr_380px]">

            {/* Left hero */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="relative overflow-hidden rounded-3xl bg-white border border-purple-100/80 p-6 md:p-8"
              style={{ boxShadow: '0 4px 24px rgba(168,85,247,0.08)' }}
            >
              {/* Background decoration */}
              <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full opacity-[0.06]"
                style={{ background: 'radial-gradient(circle, #a855f7, transparent)' }} />
              <div className="absolute -bottom-12 -left-8 w-40 h-40 rounded-full opacity-[0.04]"
                style={{ background: 'radial-gradient(circle, #f472b6, transparent)' }} />

              <div className="relative">
                <span className="badge badge-primary text-[10px] tracking-widest uppercase font-bold mb-4 inline-flex">
                  <Sparkles className="w-3 h-3" /> Quirkify Store
                </span>

                <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-gray-900 leading-[1.12] tracking-tight mt-3 mb-4"
                  style={{ fontFamily: 'Nunito, sans-serif' }}>
                  Curated resale,{' '}
                  <span className="gradient-text">auction energy</span>{' '}
                  &amp; quirky finds.
                </h1>

                <p className="text-gray-500 text-sm md:text-base leading-relaxed max-w-lg mb-6">
                  South Africa's home for AI-verified collectibles, limited drops, and pre-loved finds.
                  Every item checked before it hits the shelf.
                </p>

                {/* Stats row */}
                <div className="flex flex-wrap gap-3">
                  <div className="stat-chip">
                    <span className="stat-chip-label">Products</span>
                    <span className="stat-chip-value stat-number">{loading ? '—' : products.length}</span>
                  </div>
                  <div className="stat-chip">
                    <span className="stat-chip-label">Live Now</span>
                    <span className="stat-chip-value stat-number">{liveSessions.length}</span>
                  </div>
                  {saleCount > 0 && (
                    <div className="stat-chip" style={{ borderColor: '#fecaca' }}>
                      <span className="stat-chip-label" style={{ color: '#ef4444' }}>On Sale</span>
                      <span className="stat-chip-value stat-number" style={{ color: '#dc2626' }}>{saleCount}</span>
                    </div>
                  )}
                  <div className="stat-chip">
                    <span className="stat-chip-label">Categories</span>
                    <span className="stat-chip-value stat-number">13</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Right — value props */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-3xl overflow-hidden relative noise"
              style={{
                background: 'linear-gradient(145deg, #1e1b4b 0%, #4c1d95 55%, #9d174d 100%)',
                boxShadow: '0 8px 32px rgba(76,29,149,0.30)',
              }}
            >
              <div className="p-6 md:p-7 h-full flex flex-col">
                <div className="flex items-center justify-between mb-5">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-purple-300">
                    Why Quirkify
                  </span>
                  <ArrowUpRight className="w-4 h-4 text-purple-300" />
                </div>

                <div className="space-y-3 flex-1">
                  {[
                    {
                      icon: Sparkles,
                      title: 'AI Verified',
                      desc: 'Every listing analysed by Gemini AI — no fakes, no misleading descriptions.',
                    },
                    {
                      icon: Zap,
                      title: 'Live Auction Drops',
                      desc: 'Bid live on limited & rare pieces. New drops added regularly.',
                    },
                    {
                      icon: Shield,
                      title: 'Secure & Trusted',
                      desc: 'PCI-compliant Yoco payments. Nationwide courier delivery.',
                    },
                  ].map(({ icon: Icon, title, desc }) => (
                    <div key={title} className="flex gap-3 p-3.5 rounded-2xl bg-white/10 backdrop-blur-sm">
                      <div className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center bg-white/10">
                        <Icon className="w-4 h-4 text-purple-200" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white">{title}</p>
                        <p className="text-xs text-white/60 leading-relaxed mt-0.5">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <Link
                  to="/auctions"
                  className="mt-4 flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/15 hover:bg-white/25 transition-colors text-white text-xs font-semibold justify-center"
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  View Live Auctions
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ── Live sessions banner ── */}
        <AnimatePresence>
          {liveSessions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6"
            >
              <div
                className="rounded-2xl overflow-hidden"
                style={{ background: 'linear-gradient(135deg, #1e1b4b, #6d28d9)' }}
              >
                <div className="flex items-center gap-4 px-5 py-3 overflow-x-auto tag-strip">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-pink-300 whitespace-nowrap flex items-center gap-2">
                    <span className="live-dot" /> Live Now
                  </span>
                  {liveSessions.map(s => (
                    <Link
                      key={s.id}
                      to={`/live/${s.id}`}
                      className="flex items-center gap-2 bg-white/10 hover:bg-white/20 rounded-xl px-3 py-1.5 transition-colors whitespace-nowrap"
                    >
                      <Play className="w-3 h-3 text-white fill-white" />
                      <span className="text-xs font-semibold text-white">{s.title}</span>
                      <span className="text-[9px] text-white/50 flex items-center gap-1">
                        <Users className="w-2.5 h-2.5" />{s.viewerCount}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Search + Filters ── */}
        <div className="mb-8 space-y-4">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              value={search}
              onChange={e => handleSearchChange(e.target.value)}
              placeholder="Search products, categories…"
              className="w-full pl-11 pr-10 py-3 bg-white border border-gray-200 rounded-2xl text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all shadow-sm"
              maxLength={100}
              aria-label="Search products"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-gray-100 transition-colors"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5 text-gray-400" />
              </button>
            )}
          </div>

          {rateLimitError && (
            <p className="text-xs text-amber-600 font-medium px-1">{rateLimitError}</p>
          )}

          {/* Condition filter pills */}
          <div className="flex items-center gap-3">
            <div className="tag-strip flex-1">
              {CONDITION_FILTERS.map(f => (
                <button
                  key={String(f.key)}
                  onClick={() => setActiveFilter(activeFilter === f.key ? null : f.key)}
                  className={cn('filter-pill', activeFilter === f.key && 'active')}
                >
                  {f.emoji && <span>{f.emoji}</span>}
                  {f.label}
                  {f.key === 'sale' && saleCount > 0 && (
                    <span className={cn(
                      'ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold',
                      activeFilter === 'sale' ? 'bg-white/20 text-white' : 'bg-red-100 text-red-600'
                    )}>
                      {saleCount}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Category dropdown */}
            <div className="relative flex-shrink-0">
              <button
                onClick={() => setShowCategoryMenu(v => !v)}
                className={cn(
                  'filter-pill',
                  activeCategory && 'active'
                )}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                {activeCategory || 'Category'}
              </button>

              <AnimatePresence>
                {showCategoryMenu && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setShowCategoryMenu(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 6, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 4, scale: 0.97 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl border border-gray-100 shadow-xl z-30 overflow-hidden"
                    >
                      <div className="p-1.5 max-h-72 overflow-y-auto">
                        <button
                          onClick={() => { setActiveCategory(null); setShowCategoryMenu(false); }}
                          className={cn(
                            'w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-colors',
                            !activeCategory ? 'bg-purple-50 text-purple-700' : 'text-gray-700 hover:bg-gray-50'
                          )}
                        >
                          All Categories
                        </button>
                        {PRODUCT_CATEGORIES.map(cat => (
                          <button
                            key={cat}
                            onClick={() => { setActiveCategory(cat); setShowCategoryMenu(false); }}
                            className={cn(
                              'w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-colors',
                              activeCategory === cat ? 'bg-purple-50 text-purple-700' : 'text-gray-700 hover:bg-gray-50'
                            )}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* ── Product Grid ── */}
        <section>
          {/* Section header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-bold text-gray-900">
                {activeFilter === 'sale' ? '🔥 On Sale'
                  : activeFilter === 'New' ? '✨ New Arrivals'
                  : activeFilter === 'Pre-owned' ? '💎 Pre-owned'
                  : activeCategory ? activeCategory
                  : 'All Products'}
              </h2>
              {!loading && filtered.length > 0 && (
                <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                  {filtered.length}
                </span>
              )}
            </div>

            {(activeFilter || activeCategory || search) && (
              <button
                onClick={() => { setActiveFilter(null); setActiveCategory(null); setSearch(''); }}
                className="text-xs font-medium text-gray-500 hover:text-gray-700 flex items-center gap-1 transition-colors"
              >
                <X className="w-3 h-3" /> Clear filters
              </button>
            )}
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
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-24 rounded-3xl border border-gray-100 bg-white"
            >
              <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
                <Package className="w-6 h-6 text-gray-300" />
              </div>
              <p className="text-gray-500 font-semibold text-sm">No products found</p>
              <p className="text-gray-400 text-xs mt-1">Try adjusting your filters or search</p>
              {(search || activeFilter || activeCategory) && (
                <button
                  onClick={() => { setSearch(''); setActiveFilter(null); setActiveCategory(null); }}
                  className="mt-4 text-sm font-semibold text-purple-600 hover:text-purple-700 underline transition-colors"
                >
                  Clear all filters
                </button>
              )}
            </motion.div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
              {filtered.map((product, idx) => (
                <ProductCard key={product.id} product={product} idx={idx} />
              ))}
            </div>
          )}
        </section>

        {/* ── Trust strip ── */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-16"
        >
          <div className="rounded-2xl border border-gray-100 bg-white px-6 py-5 shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                {
                  icon: Shield,
                  label: 'Secure Payments',
                  sub: 'PCI-compliant via Yoco',
                  color: '#a855f7',
                },
                {
                  icon: Sparkles,
                  label: 'AI Verified',
                  sub: 'Every item checked by Gemini',
                  color: '#f472b6',
                },
                {
                  icon: Truck,
                  label: 'Nationwide Delivery',
                  sub: 'The Courier Guy',
                  color: '#4ade80',
                },
              ].map(({ icon: Icon, label, sub, color }) => (
                <div key={label} className="flex items-center gap-3 sm:flex-col sm:text-center">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${color}15` }}
                  >
                    <Icon className="w-5 h-5" style={{ color }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
