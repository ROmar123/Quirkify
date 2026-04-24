import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Product, Campaign } from '../../types';
import { fetchProducts } from '../../services/productService';
import { fetchActiveCampaigns } from '../../services/campaignService';
import { getPersonalizedRecommendations } from '../../services/aiClient';
import { auth } from '../../firebase';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShoppingBag, Search, X, Shield, Truck,
  Sparkles, Zap, ChevronRight, Package, Megaphone, Heart
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
  'Limited':    { gradient: 'linear-gradient(135deg,#06b6d4,#3b82f6)', text: 'white' },
  'Common':     { gradient: 'linear-gradient(135deg,#e0d2ff,#c4b5fd)', text: '#4c1d95' },
};

const CATEGORY_ICONS: Record<string, string> = {
  'Sneakers': '👟', 'Clothing': '👕', 'Accessories': '👜',
  'Electronics': '📱', 'Collectibles': '🏆', 'Toys & Games': '🎮',
  'Books & Media': '📚', 'Beauty & Health': '💅', 'Home & Decor': '🏡',
  'Sports & Outdoors': '⚽', 'Art & Crafts': '🎨', 'Vintage & Retro': '📻',
  'Other': '✨',
};

function FeaturedCard({ product, idx }: { product: Product; idx: number }) {
  const { addToCart } = useCart();
  const [added, setAdded] = useState(false);
  const basePrice = product.retailPrice ?? product.priceRange?.max ?? 0;
  const hasDiscount = Boolean(product.discountPrice && product.discountPrice > 0 && product.discountPrice < basePrice);
  const displayPrice = hasDiscount ? product.discountPrice! : (product.priceRange?.min || basePrice);

  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(idx * 0.04, 0.3), duration: 0.4 }}
      className="flex-shrink-0 w-36 bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-md transition-shadow group"
    >
      <Link to={`/product/${product.id}`} className="block relative aspect-square overflow-hidden bg-gray-50">
        <img
          src={product.imageUrl}
          alt={product.name}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          referrerPolicy="no-referrer"
          onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder-product.png'; }}
        />
        {hasDiscount && (
          <span className="absolute top-1.5 left-1.5 text-[8px] font-black px-1.5 py-0.5 rounded-full bg-red-500 text-white">
            SALE
          </span>
        )}
      </Link>
      <div className="p-2.5">
        <p className="text-[11px] font-semibold text-gray-800 leading-tight line-clamp-1">{product.name}</p>
        <div className="flex items-center justify-between mt-1.5">
          <p className="text-[11px] font-black text-purple-600">R{displayPrice}</p>
          {product.stock > 0 && (
            <button
              onClick={(e) => {
                e.preventDefault();
                addToCart(product);
                setAdded(true);
                setTimeout(() => setAdded(false), 1200);
              }}
              className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 transition-all"
              style={{ background: added ? '#22c55e' : 'var(--gradient-primary)' }}
              title="Add to cart"
            >
              {added ? '✓' : <ShoppingBag className="w-3 h-3" />}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function ProductCard({ product, idx }: { product: Product; idx: number }) {
  const { addToCart } = useCart();
  const [wishlisted, setWishlisted] = useState(false);
  const [added, setAdded] = useState(false);
  const isSoldOut = product.stock === 0;
  const isLowStock = product.stock > 0 && product.stock < 5;
  const basePrice = product.retailPrice ?? product.priceRange?.max ?? 0;
  const hasDiscount = Boolean(product.discountPrice && product.discountPrice > 0 && product.discountPrice < basePrice);
  const displayPrice = hasDiscount ? product.discountPrice! : (product.priceRange?.min || basePrice);
  const discountPct = hasDiscount ? Math.round((1 - displayPrice / basePrice) * 100) : 0;
  const rarity = RARITY_CONFIG[product.rarity || 'Common'] ?? RARITY_CONFIG['Common'];

  const handleAddToCart = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    addToCart(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  };

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
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/8 transition-colors duration-300" />

        {/* Wishlist heart */}
        <motion.button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setWishlisted(v => !v); }}
          whileTap={{ scale: 0.85 }}
          className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center bg-white/80 backdrop-blur-sm shadow-sm opacity-0 group-hover:opacity-100 transition-all duration-200 z-10"
          aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
        >
          <Heart className={cn('w-4 h-4 transition-colors', wishlisted ? 'fill-red-500 text-red-500' : 'text-gray-400')} />
        </motion.button>

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
            <span className="text-[9px] font-black px-2.5 py-1 rounded-full bg-red-500 text-white shadow-sm tracking-tight">
              -{discountPct}%
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

        {/* Added ✓ overlay */}
        <AnimatePresence>
          {added && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[2px] z-20"
            >
              <motion.div
                initial={{ scale: 0.7 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.7 }}
                className="bg-white rounded-full px-4 py-2 shadow-lg"
              >
                <span className="text-xs font-bold text-gray-900">Added ✓</span>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quick add button */}
        {!isSoldOut && !added && (
          <motion.button
            onClick={handleAddToCart}
            whileTap={{ scale: 0.93 }}
            className="absolute bottom-3 right-3 w-9 h-9 rounded-full flex items-center justify-center text-white shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-200 translate-y-2 group-hover:translate-y-0 z-10"
            style={{ background: 'var(--gradient-primary)' }}
            title="Add to cart"
          >
            <ShoppingBag className="w-4 h-4" />
          </motion.button>
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
              <p className="text-[10px] text-gray-400 line-through font-medium">R{basePrice}</p>
              <p className="price text-base text-red-500">R{displayPrice}</p>
            </div>
          ) : (
            <p className="price text-base gradient-text">R{displayPrice}</p>
          )}

          {!isSoldOut ? (
            <motion.button
              onClick={() => handleAddToCart()}
              whileTap={{ scale: 0.93 }}
              className="flex items-center justify-center w-9 h-9 rounded-full text-white shadow-sm lg:hidden flex-shrink-0"
              style={{ background: 'var(--gradient-primary)' }}
              aria-label="Add to cart"
            >
              <ShoppingBag className="w-4 h-4" />
            </motion.button>
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
  const [liveSessions] = useState<{ id: string; title: string; viewerCount: number }[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [recommendations, setRecommendations] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const viewedIdsRef = useRef<string[]>([]);
  const hasRecommendedRef = useRef(false);

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
    fetchActiveCampaigns().then(setCampaigns).catch(() => {});
  }, []);

  // AI recommendations — fetch once after user has viewed 3+ products
  const trackView = useCallback((productId: string) => {
    if (hasRecommendedRef.current) return;
    if (!viewedIdsRef.current.includes(productId)) {
      viewedIdsRef.current = [...viewedIdsRef.current, productId].slice(-10);
    }
    if (viewedIdsRef.current.length >= 3 && auth.currentUser) {
      hasRecommendedRef.current = true;
      const viewed = products.filter(p => viewedIdsRef.current.includes(p.id));
      getPersonalizedRecommendations(viewed, [activeCategory].filter(Boolean) as string[])
        .then((res) => {
          const names: string[] = Array.isArray(res?.recommendations) ? res.recommendations : [];
          const matched = products
            .filter(p => names.some(n => p.name.toLowerCase().includes(n.toLowerCase())))
            .filter(p => !viewedIdsRef.current.includes(p.id))
            .slice(0, 4);
          if (matched.length > 0) setRecommendations(matched);
        })
        .catch(() => {});
    }
  }, [products, activeCategory]);

  const isOnSale = (p: typeof products[0]) => {
    const base = p.retailPrice ?? p.priceRange?.max ?? 0;
    const sale = (p.discountPrice && p.discountPrice > 0) ? p.discountPrice : (p.priceRange?.min ?? base);
    return base > 0 && sale > 0 && sale < base;
  };

  const filtered = useMemo(() => {
    let list = products;
    if (activeFilter === 'sale') list = list.filter(isOnSale);
    else if (activeFilter) list = list.filter(p => p.condition === activeFilter);
    if (activeCategory) list = list.filter(p => p.category === activeCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q));
    }
    return list;
  }, [products, activeFilter, activeCategory, search]);

  const saleCount = products.filter(isOnSale).length;

  return (
    <div className="hero-bg min-h-screen">
      <div className="max-w-7xl mx-auto px-4 pt-8 pb-24">

        {/* ── Hero Section ── */}
        <section className="mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            className="relative overflow-hidden rounded-3xl noise"
            style={{
              background: 'linear-gradient(160deg, #1e1b4b 0%, #4c1d95 55%, #9d174d 100%)',
              boxShadow: '0 12px 40px rgba(76,29,149,0.35)',
            }}
          >
            <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full opacity-20 pointer-events-none"
              style={{ background: 'radial-gradient(circle, #f472b6, transparent)' }} />
            <div className="absolute -bottom-20 -left-16 w-64 h-64 rounded-full opacity-10 pointer-events-none"
              style={{ background: 'radial-gradient(circle, #60a5fa, transparent)' }} />

            <div className="relative p-6 md:p-10">
              <div className="max-w-2xl">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-purple-300 mb-4">
                  <Sparkles className="w-3 h-3" /> Quirkify Store
                </span>

                <h1
                  className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-white leading-[1.1] tracking-tight mb-4"
                  style={{ fontFamily: 'Nunito, sans-serif' }}
                >
                  Curated resale,{' '}
                  <span className="text-pink-300">auction energy</span>{' '}
                  &amp; quirky finds.
                </h1>

                <p className="text-white/70 text-sm md:text-base leading-relaxed mb-6 max-w-lg">
                  South Africa's home for AI-verified collectibles, limited drops, and pre-loved finds.
                  Every item checked before it hits the shelf.
                </p>

                <div className="flex flex-wrap gap-2 mb-7">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 backdrop-blur-sm">
                    <span className="text-[10px] text-white/60 font-medium">Products</span>
                    <span className="text-sm font-black text-white">{loading ? '—' : products.length}</span>
                  </div>
                  {liveSessions.length > 0 && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 backdrop-blur-sm">
                      <span className="live-dot" />
                      <span className="text-[10px] text-emerald-300 font-medium">Live Now</span>
                      <span className="text-sm font-black text-emerald-300">{liveSessions.length}</span>
                    </div>
                  )}
                  {saleCount > 0 && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/20 border border-red-400/30 backdrop-blur-sm">
                      <span className="text-[10px] text-red-300 font-medium">On Sale</span>
                      <span className="text-sm font-black text-red-300">{saleCount}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 backdrop-blur-sm">
                    <span className="text-[10px] text-white/60 font-medium">Categories</span>
                    <span className="text-sm font-black text-white">13</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => document.getElementById('product-grid')?.scrollIntoView({ behavior: 'smooth' })}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-gray-900 text-sm font-bold hover:bg-white/90 transition-colors shadow-lg"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    Shop Now
                  </button>
                  <Link
                    to="/auctions"
                    className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/15 border border-white/25 text-white text-sm font-semibold hover:bg-white/25 transition-colors"
                  >
                    <Zap className="w-4 h-4" />
                    Live Auctions
                  </Link>
                </div>
              </div>

              <div className="hidden md:flex absolute right-8 bottom-8 gap-2">
                {[
                  { icon: Shield, label: 'Secure Payments' },
                  { icon: Sparkles, label: 'AI Verified' },
                  { icon: Truck, label: 'Nationwide Delivery' },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 backdrop-blur-sm">
                    <Icon className="w-3 h-3 text-white/70" />
                    <span className="text-[10px] font-semibold text-white/80">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </section>

        {/* ── New Arrivals strip ── */}
        {!loading && products.length > 0 && (
          <section className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">New Arrivals</h2>
              <button
                onClick={() => {
                  setActiveFilter(null);
                  setActiveCategory(null);
                  document.getElementById('product-grid')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="text-xs font-semibold text-purple-600 hover:text-purple-800 transition-colors flex items-center gap-1"
              >
                See all <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="tag-strip gap-3 pb-2">
              {products.slice(0, 8).map((product, idx) => (
                <FeaturedCard key={product.id} product={product} idx={idx} />
              ))}
            </div>
          </section>
        )}

        {/* ── Campaign Banner ── */}
        <AnimatePresence>
          {campaigns.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mb-6"
            >
              <div
                className="rounded-2xl p-5 relative overflow-hidden noise cursor-pointer"
                style={{ background: 'var(--gradient-warm)' }}
                onClick={() => {
                  setSearch('');
                  setActiveCategory(null);
                  if (campaigns[0].discountPercentage) {
                    setActiveFilter('sale');
                  } else {
                    setActiveFilter(null);
                  }
                  document.getElementById('product-grid')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                <div className="absolute -right-6 -top-6 opacity-10">
                  <Megaphone className="w-28 h-28 text-white" />
                </div>
                <div className="flex items-start justify-between gap-4 relative z-10">
                  <div>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-white/70 mb-1 block">
                      Active Campaign
                    </span>
                    <h3 className="text-base font-black text-white leading-tight">{campaigns[0].title}</h3>
                    <p className="text-xs text-white/80 mt-1 leading-relaxed max-w-xs">{campaigns[0].description}</p>
                  </div>
                  {campaigns[0].discountPercentage && (
                    <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-white/20 border border-white/30 flex flex-col items-center justify-center">
                      <span className="text-[10px] font-bold text-white/70">UP TO</span>
                      <span className="text-lg font-black text-white leading-none">{campaigns[0].discountPercentage}%</span>
                      <span className="text-[9px] font-bold text-white/70">OFF</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-3 relative z-10">
                  <span className="text-xs font-bold text-white">Shop Now</span>
                  <ChevronRight className="w-3.5 h-3.5 text-white" />
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
          <div className="tag-strip">
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

          {/* Category icon pills */}
          <div className="tag-strip mt-2">
            <button
              onClick={() => setActiveCategory(null)}
              className={cn('filter-pill', !activeCategory && 'active')}
            >
              All
            </button>
            {PRODUCT_CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat === activeCategory ? null : cat)}
                className={cn('filter-pill', activeCategory === cat && 'active')}
              >
                <span>{CATEGORY_ICONS[cat] || '🏷️'}</span>
                {cat}
              </button>
            ))}
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
              {(search || activeFilter || activeCategory) ? (
                <>
                  <p className="text-gray-400 text-xs mt-1 mb-3">These filters returned no results:</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {search && (
                      <button
                        onClick={() => setSearch('')}
                        className="flex items-center gap-1 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-full text-xs font-semibold hover:bg-purple-100 transition-colors"
                      >
                        "{search}" <X className="w-3 h-3" />
                      </button>
                    )}
                    {activeFilter && (
                      <button
                        onClick={() => setActiveFilter(null)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-full text-xs font-semibold hover:bg-purple-100 transition-colors"
                      >
                        {activeFilter} <X className="w-3 h-3" />
                      </button>
                    )}
                    {activeCategory && (
                      <button
                        onClick={() => setActiveCategory(null)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-full text-xs font-semibold hover:bg-purple-100 transition-colors"
                      >
                        {activeCategory} <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => { setSearch(''); setActiveFilter(null); setActiveCategory(null); }}
                    className="mt-4 text-xs font-semibold text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    Clear all
                  </button>
                </>
              ) : (
                <p className="text-gray-400 text-xs mt-1">No products have been listed yet</p>
              )}
            </motion.div>
          ) : (
            <div id="product-grid" className="grid grid-cols-2 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
              {filtered.map((product, idx) => (
                <div key={product.id} onClick={() => trackView(product.id)}>
                  <ProductCard product={product} idx={idx} />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── AI Recommendations ── */}
        <AnimatePresence>
          {recommendations.length > 0 && (
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-10"
            >
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-4 h-4 text-purple-500" />
                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Picked for You</h2>
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {recommendations.map((product, idx) => (
                  <ProductCard key={product.id} product={product} idx={idx} />
                ))}
              </div>
            </motion.section>
          )}
        </AnimatePresence>

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
