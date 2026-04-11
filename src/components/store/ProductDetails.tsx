import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { fetchProduct as fetchProductById } from '../../services/productService';
import { Product } from '../../types';
import { useCart } from '../../context/CartContext';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShoppingBag,
  ShieldCheck,
  Truck,
  RefreshCcw,
  Zap,
  Trophy,
  ChevronRight,
  ChevronLeft,
  Share2,
  Heart
} from 'lucide-react';
import { cn } from '../../lib/utils';
export default function ProductDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [isLiked, setIsLiked] = useState(false);

  useEffect(() => {
    const loadProduct = async () => {
      if (!id) return;
      try {
        const data = await fetchProductById(id);
        setProduct(data);
      } catch (error) {
        // Silently fail - will show "Product not found" in UI
      } finally {
        setLoading(false);
      }
    };
    loadProduct();
    window.scrollTo(0, 0);
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#FDF4FF' }}>
        <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#A855F7', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center" style={{ background: '#FDF4FF' }}>
        <h2 className="text-4xl font-black mb-4 gradient-text">Product Not Found</h2>
        <p className="text-purple-300 text-sm font-semibold mb-8">The quirkiness you're looking for has vanished.</p>
        <Link to="/" className="btn-primary px-8 py-3">Back to Store</Link>
      </div>
    );
  }

  const images = product.imageUrls || [product.imageUrl];
  const isSoldOut = (product as any).stock === 0;

  const handleBuyNow = () => {
    addToCart(product, quantity);
    navigate('/checkout');
  };

  const rarityStyle = (rarity: string) => {
    if (rarity === 'Unique') return { background: 'linear-gradient(135deg, #FBBF24, #FB923C)', color: 'white' };
    if (rarity === 'Super Rare') return { background: 'linear-gradient(135deg, #F43F5E, #FB923C)', color: 'white' };
    if (rarity === 'Rare') return { background: 'linear-gradient(135deg, #A855F7, #6366F1)', color: 'white' };
    return { background: '#F3F0FF', color: '#7C3AED' };
  };

  return (
    <div className="min-h-screen" style={{ background: '#FDF4FF' }}>
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-2 text-xs font-semibold text-purple-300 mb-10">
          <Link to="/" className="hover:text-purple-500 transition-colors">Store</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-purple-200">{product.category}</span>
          <ChevronRight className="w-3 h-3" />
          <span className="text-purple-600 font-bold">{product.name}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20">
          {/* Image Gallery */}
          <div className="space-y-4">
            <div className="aspect-square bg-white rounded-3xl relative overflow-hidden group shadow-sm border border-purple-100">
              <AnimatePresence mode="wait">
                <motion.img
                  key={activeImage}
                  initial={{ opacity: 0, scale: 1.05 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  src={images[activeImage]}
                  alt={product.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </AnimatePresence>

              {/* Rarity Badge */}
              <div
                className="absolute top-4 left-4 px-3 py-1.5 rounded-full text-xs font-bold shadow-lg"
                style={rarityStyle(product.rarity || 'Common')}
              >
                ✦ {product.rarity}
              </div>

              {/* Navigation Arrows */}
              {images.length > 1 && (
                <>
                  <button
                    onClick={() => setActiveImage((prev) => (prev === 0 ? images.length - 1 : prev - 1))}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <ChevronLeft className="w-5 h-5 text-purple-600" />
                  </button>
                  <button
                    onClick={() => setActiveImage((prev) => (prev === images.length - 1 ? 0 : prev + 1))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <ChevronRight className="w-5 h-5 text-purple-600" />
                  </button>
                </>
              )}
            </div>

            {/* Thumbnails */}
            {images.length > 1 && (
              <div className="grid grid-cols-4 gap-3">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImage(idx)}
                    className={cn(
                      "aspect-square rounded-2xl overflow-hidden border-2 transition-all",
                      activeImage === idx ? "border-purple-400 shadow-md" : "border-transparent hover:border-purple-200"
                    )}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="flex flex-col">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm font-bold text-purple-400 mb-2">
                  {product.category}{product.condition && ` · ${product.condition}`}
                </p>
                <h1 className="text-4xl md:text-5xl font-black leading-tight text-purple-900">
                  {product.name}
                </h1>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsLiked(!isLiked)}
                  className={cn(
                    "w-11 h-11 rounded-full border-2 flex items-center justify-center transition-all",
                    isLiked ? "bg-pink-500 border-pink-500 text-white" : "border-purple-200 text-purple-300 hover:border-pink-400 hover:text-pink-400"
                  )}
                >
                  <Heart className={cn("w-5 h-5", isLiked && "fill-current")} />
                </button>
                <button className="w-11 h-11 rounded-full border-2 border-purple-200 flex items-center justify-center text-purple-300 hover:border-purple-400 hover:text-purple-500 transition-all">
                  <Share2 className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex items-baseline gap-4 mb-8">
              <span className="text-4xl font-black text-purple-900">R{product.priceRange.min}</span>
              {product.discountPrice && (
                <span className="text-xl text-purple-200 line-through font-bold">R{product.priceRange.max}</span>
              )}
              {isSoldOut && (
                <span className="badge-pill bg-purple-100 text-purple-400 text-xs">Sold Out</span>
              )}
            </div>

            <p className="text-purple-500 text-sm leading-relaxed mb-8">
              {product.description}
            </p>

            {/* Stats Grid */}
            {product.stats && (
              <div className="grid grid-cols-2 gap-3 mb-8">
                <div className="p-4 bg-white rounded-2xl border border-purple-100 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #A855F7, #6366F1)' }}>
                      <Zap className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-xs font-bold text-purple-400">Quirkiness</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-purple-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${product.stats.quirkiness}%`, background: 'linear-gradient(90deg, #A855F7, #F472B6)' }} />
                    </div>
                    <span className="text-xs font-bold text-purple-600">{product.stats.quirkiness}</span>
                  </div>
                </div>
                <div className="p-4 bg-white rounded-2xl border border-purple-100 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #F43F5E, #FB923C)' }}>
                      <Trophy className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-xs font-bold text-purple-400">Rarity Score</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-pink-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${product.stats.rarity}%`, background: 'linear-gradient(90deg, #F43F5E, #FBBF24)' }} />
                    </div>
                    <span className="text-xs font-bold text-pink-600">{product.stats.rarity}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-3 mt-auto">
              {!isSoldOut ? (
                <>
                  <div className="flex gap-3">
                    <div className="flex items-center bg-white rounded-2xl border-2 border-purple-200 overflow-hidden">
                      <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="px-4 py-3 hover:bg-purple-50 transition-colors font-bold text-purple-500">-</button>
                      <span className="w-10 text-center text-sm font-bold text-purple-700">{quantity}</span>
                      <button onClick={() => setQuantity(quantity + 1)} className="px-4 py-3 hover:bg-purple-50 transition-colors font-bold text-purple-500">+</button>
                    </div>
                    <button
                      onClick={() => addToCart(product, quantity)}
                      className="btn-secondary flex-1"
                    >
                      <ShoppingBag className="w-4 h-4" />
                      Add to Cart
                    </button>
                  </div>
                  <button onClick={handleBuyNow} className="btn-primary w-full py-4 text-base justify-center">
                    <Zap className="w-5 h-5" />
                    {product.condition === 'New' ? 'Quick Checkout' : 'Buy It Now'}
                  </button>
                </>
              ) : (
                <button disabled className="w-full bg-purple-100 text-purple-400 py-4 rounded-full font-bold cursor-not-allowed">
                  Currently Unavailable
                </button>
              )}
            </div>

            {/* Trust Badges */}
            <div className="grid grid-cols-3 gap-3 mt-8 pt-8 border-t border-purple-100">
              {[
                { icon: ShieldCheck, label: 'AI Verified', color: '#A855F7' },
                { icon: Truck, label: 'Nationwide Delivery', color: '#4ADE80' },
                { icon: RefreshCcw, label: 'Secure Checkout', color: '#60A5FA' },
              ].map(({ icon: Icon, label, color }) => (
                <div key={label} className="text-center">
                  <div className="w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center" style={{ background: `${color}20` }}>
                    <Icon className="w-5 h-5" style={{ color }} />
                  </div>
                  <p className="text-xs font-semibold text-purple-400">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
