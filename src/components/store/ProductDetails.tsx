import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { fetchProduct as fetchProductById } from '../../services/productService';
import { Product } from '../../types';
import { useCart } from '../../context/CartContext';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShoppingBag, ShieldCheck, Truck, Zap, Trophy,
  ChevronRight, ChevronLeft, Share2, Heart,
  Star, Package, RefreshCcw, Tag
} from 'lucide-react';
import { cn } from '../../lib/utils';

const RARITY_CONFIG: Record<string, { gradient: string; text: string; bg: string }> = {
  'Unique':     { gradient: 'linear-gradient(135deg,#f59e0b,#ef4444)', text: 'white', bg: '#fef3c7' },
  'Super Rare': { gradient: 'linear-gradient(135deg,#f472b6,#a855f7)', text: 'white', bg: '#fce7f3' },
  'Rare':       { gradient: 'linear-gradient(135deg,#a855f7,#6366f1)', text: 'white', bg: '#f5f3ff' },
  'Common':     { gradient: 'linear-gradient(135deg,#e0d2ff,#c4b5fd)', text: '#4c1d95', bg: '#faf5ff' },
};

export default function ProductDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [isLiked, setIsLiked] = useState(false);
  const [addedToCart, setAddedToCart] = useState(false);
  const [cartMessage, setCartMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadProduct = async () => {
      if (!id) return;
      try {
        const data = await fetchProductById(id);
        setProduct(data);
      } catch {
        // show not found
      } finally {
        setLoading(false);
      }
    };
    loadProduct();
    window.scrollTo(0, 0);
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div className="skeleton aspect-square rounded-3xl" />
          <div className="space-y-4">
            <div className="skeleton h-4 w-32 rounded-full" />
            <div className="skeleton h-10 w-3/4 rounded-xl" />
            <div className="skeleton h-8 w-24 rounded-xl" />
            <div className="skeleton h-24 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
          <Package className="w-8 h-8 text-gray-300" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Product Not Found</h2>
        <p className="text-gray-500 text-sm mb-6">The item you're looking for has vanished.</p>
        <Link to="/" className="btn-primary">Back to Store</Link>
      </div>
    );
  }

  const images = product.imageUrls?.length ? product.imageUrls : [product.imageUrl];
  const isSoldOut = product.stock === 0;
  const isLowStock = product.stock > 0 && product.stock < 5;
  const maxQty = product.allocations?.store ?? product.stock;
  const basePrice = product.priceRange?.min ?? product.retailPrice ?? 0;
  const hasDiscount = product.discountPrice && product.discountPrice < basePrice;
  const rarity = RARITY_CONFIG[product.rarity || 'Common'] || RARITY_CONFIG['Common'];

  const handleAddToCart = () => {
    const result = addToCart(product, quantity);
    if (!result.ok) {
      setCartMessage(result.message ?? 'Could not add to cart');
      setTimeout(() => setCartMessage(null), 3000);
      return;
    }
    setAddedToCart(true);
    if (result.message) {
      setCartMessage(result.message);
      setTimeout(() => setCartMessage(null), 3000);
    }
    setTimeout(() => setAddedToCart(false), 2000);
  };

  const handleBuyNow = () => {
    const result = addToCart(product, quantity);
    if (!result.ok) {
      setCartMessage(result.message ?? 'Could not add to cart');
      setTimeout(() => setCartMessage(null), 3000);
      return;
    }
    navigate('/checkout');
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: product.name,
        text: product.description,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href).catch(() => {});
    }
  };

  return (
    <div className="hero-bg min-h-screen">
      <div className="max-w-7xl mx-auto px-4 py-6 pb-24">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-8" aria-label="Breadcrumb">
          <Link to="/" className="hover:text-gray-600 transition-colors">Store</Link>
          <ChevronRight className="w-3 h-3" />
          {product.category && (
            <>
              <Link to={`/?category=${product.category}`} className="hover:text-gray-600 transition-colors">
                {product.category}
              </Link>
              <ChevronRight className="w-3 h-3" />
            </>
          )}
          <span className="text-gray-600 font-semibold truncate max-w-[200px]">{product.name}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">
          {/* ── Image Gallery ── */}
          <div className="space-y-3">
            <div
              className="relative aspect-square bg-white rounded-3xl overflow-hidden group border border-gray-100"
              style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}
            >
              <AnimatePresence mode="wait">
                <motion.img
                  key={activeImage}
                  initial={{ opacity: 0, scale: 1.04 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  src={images[activeImage]}
                  alt={product.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </AnimatePresence>

              {/* Rarity Badge */}
              <div
                className="absolute top-4 left-4 px-3 py-1.5 rounded-full text-xs font-bold shadow-md"
                style={{ background: rarity.gradient, color: rarity.text }}
              >
                ✦ {product.rarity || 'Common'}
              </div>

              {/* Nav arrows */}
              {images.length > 1 && (
                <>
                  <button
                    onClick={() => setActiveImage(prev => prev === 0 ? images.length - 1 : prev - 1)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md transition-all hover:bg-white md:opacity-0 md:group-hover:opacity-100"
                    aria-label="Previous image"
                  >
                    <ChevronLeft className="w-5 h-5 text-gray-700" />
                  </button>
                  <button
                    onClick={() => setActiveImage(prev => prev === images.length - 1 ? 0 : prev + 1)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md transition-all hover:bg-white md:opacity-0 md:group-hover:opacity-100"
                    aria-label="Next image"
                  >
                    <ChevronRight className="w-5 h-5 text-gray-700" />
                  </button>
                </>
              )}

              {/* Sold out overlay */}
              {isSoldOut && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-sm">
                  <span className="text-sm font-bold text-gray-600 bg-white px-4 py-2 rounded-full border border-gray-200 shadow">
                    Sold Out
                  </span>
                </div>
              )}

              {/* Dot indicators */}
              {images.length > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 items-center">
                  {images.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveImage(i)}
                      className={cn(
                        'rounded-full transition-all duration-200',
                        i === activeImage ? 'w-5 h-2 bg-purple-500' : 'w-2 h-2 bg-white/70'
                      )}
                      aria-label={`View image ${i + 1}`}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Thumbnails */}
            {images.length > 1 && (
              <div className="grid grid-cols-4 gap-2.5">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImage(idx)}
                    className={cn(
                      'aspect-square rounded-2xl overflow-hidden border-2 transition-all',
                      activeImage === idx
                        ? 'border-purple-400 shadow-sm'
                        : 'border-gray-100 hover:border-gray-300'
                    )}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Product Info ── */}
          <div className="flex flex-col gap-5">
            {/* Header */}
            <div>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    {product.category && (
                      <span className="badge badge-primary text-[10px]">{product.category}</span>
                    )}
                    {product.condition && (
                      <span className="badge text-[10px]" style={{ background: '#f9fafb', color: '#6b7280', border: '1px solid #e5e7eb' }}>
                        {product.condition}
                      </span>
                    )}
                    {isLowStock && (
                      <span className="badge badge-warning text-[10px]">
                        Only {product.stock} left
                      </span>
                    )}
                  </div>
                  <h1 className="text-2xl md:text-3xl lg:text-4xl font-extrabold text-gray-900 leading-tight tracking-tight"
                    style={{ fontFamily: 'Nunito, sans-serif' }}>
                    {product.name}
                  </h1>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => setIsLiked(!isLiked)}
                    className={cn(
                      'w-10 h-10 rounded-xl border flex items-center justify-center transition-all duration-200',
                      isLiked
                        ? 'bg-pink-50 border-pink-200 text-pink-500'
                        : 'border-gray-200 text-gray-400 hover:border-pink-200 hover:text-pink-400 bg-white'
                    )}
                    aria-label={isLiked ? 'Remove from wishlist' : 'Add to wishlist'}
                  >
                    <Heart className={cn('w-4 h-4', isLiked && 'fill-current')} />
                  </button>
                  <button
                    onClick={handleShare}
                    className="w-10 h-10 rounded-xl border border-gray-200 bg-white flex items-center justify-center text-gray-400 hover:border-gray-300 hover:text-gray-600 transition-all duration-200"
                    aria-label="Share product"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Price */}
            <div className="flex items-baseline gap-3">
              {hasDiscount ? (
                <>
                  <span className="price text-3xl text-red-500">R{product.discountPrice}</span>
                  <span className="price text-lg text-gray-300 line-through">R{basePrice}</span>
                  <span className="badge badge-danger text-[10px]">
                    <Tag className="w-3 h-3" />
                    {Math.round((1 - product.discountPrice! / basePrice) * 100)}% off
                  </span>
                </>
              ) : (
                <span className="price text-3xl gradient-text">R{basePrice}</span>
              )}
            </div>

            {/* Description */}
            <p className="text-gray-600 text-sm leading-relaxed">
              {product.description}
            </p>

            {/* Stats */}
            {product.stats && (
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Quirkiness', value: product.stats.quirkiness, icon: Zap, color: '#a855f7' },
                  { label: 'Rarity Score', value: product.stats.rarity, icon: Trophy, color: '#f472b6' },
                  { label: 'Utility', value: product.stats.utility, icon: Star, color: '#fbbf24' },
                  { label: 'Hype Factor', value: product.stats.hype, icon: Zap, color: '#60a5fa' },
                ].filter(s => s.value !== undefined).slice(0, 2).map(({ label, value, icon: Icon, color }) => (
                  <div key={label} className="p-3.5 bg-white rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-2 mb-2.5">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${color}15` }}>
                        <Icon className="w-3.5 h-3.5" style={{ color }} />
                      </div>
                      <span className="text-xs font-medium text-gray-500">{label}</span>
                    </div>
                    <div className="progress-bar mb-1.5">
                      <motion.div
                        className="progress-bar-fill"
                        initial={{ width: 0 }}
                        animate={{ width: `${value}%` }}
                        transition={{ duration: 1, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
                      />
                    </div>
                    <span className="text-xs font-bold text-gray-700">{value}/100</span>
                  </div>
                ))}
              </div>
            )}

            {/* Cart message */}
            {cartMessage && (
              <div className={cn(
                'rounded-xl px-4 py-2.5 text-sm font-semibold',
                cartMessage.includes('capped') || cartMessage.includes('Max')
                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                  : 'bg-red-50 text-red-600 border border-red-200'
              )}>
                {cartMessage}
              </div>
            )}

            {/* Actions */}
            <div className="space-y-3">
              {!isSoldOut ? (
                <>
                  <div className="flex gap-3">
                    {/* Quantity */}
                    <div className="flex items-center bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                      <button
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        className="px-3.5 py-2.5 hover:bg-gray-100 transition-colors text-gray-600 font-bold text-sm"
                      >
                        −
                      </button>
                      <span className="w-10 text-center text-sm font-semibold text-gray-800">{quantity}</span>
                      <button
                        onClick={() => setQuantity(Math.min(maxQty, quantity + 1))}
                        className="px-3.5 py-2.5 hover:bg-gray-100 transition-colors text-gray-600 font-bold text-sm"
                      >
                        +
                      </button>
                    </div>
                    <button
                      onClick={handleAddToCart}
                      className={cn(
                        'btn-secondary flex-1 transition-all',
                        addedToCart && 'border-green-300 text-green-600 bg-green-50'
                      )}
                    >
                      {addedToCart ? (
                        <><ShieldCheck className="w-4 h-4" /> Added!</>
                      ) : (
                        <><ShoppingBag className="w-4 h-4" /> Add to Cart</>
                      )}
                    </button>
                  </div>
                  <button
                    onClick={handleBuyNow}
                    className="btn-primary w-full py-3.5 text-sm justify-center"
                  >
                    <Zap className="w-4 h-4" />
                    Buy Now — R{(hasDiscount ? product.discountPrice! : basePrice) * quantity}
                  </button>
                </>
              ) : (
                <button
                  disabled
                  className="w-full py-3.5 rounded-full bg-gray-100 text-gray-400 font-semibold text-sm cursor-not-allowed"
                >
                  Currently Unavailable
                </button>
              )}
            </div>

            {/* Trust badges */}
            <div className="grid grid-cols-3 gap-2 pt-4 border-t border-gray-100">
              {[
                { icon: ShieldCheck, label: 'AI Verified', color: '#a855f7' },
                { icon: Truck, label: 'Fast Delivery', color: '#22c55e' },
                { icon: RefreshCcw, label: 'Secure Pay', color: '#3b82f6' },
              ].map(({ icon: Icon, label, color }) => (
                <div key={label} className="flex flex-col items-center gap-1.5 text-center">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: `${color}12` }}
                  >
                    <Icon className="w-4 h-4" style={{ color }} />
                  </div>
                  <p className="text-[10px] font-medium text-gray-500">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
