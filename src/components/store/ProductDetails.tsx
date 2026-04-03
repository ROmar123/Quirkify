import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Product } from '../../types';
import { useCart } from '../../context/CartContext';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShoppingBag, 
  ArrowLeft, 
  ShieldCheck, 
  Truck, 
  RefreshCcw, 
  Star, 
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
    const fetchProduct = async () => {
      if (!id) return;
      try {
        const docRef = doc(db, 'products', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setProduct({ id: docSnap.id, ...docSnap.data() } as Product);
        }
      } catch (error) {
        console.error('Error fetching product:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
    window.scrollTo(0, 0);
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-12 h-12 border-4 border-quirky border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white px-4 text-center">
        <h2 className="text-4xl font-bold tracking-tighter uppercase mb-4">Product Not Found</h2>
        <p className="text-zinc-400 text-xs uppercase tracking-widest mb-8">The quirkiness you're looking for has vanished.</p>
        <Link to="/" className="px-8 py-4 bg-black text-white text-[10px] font-bold uppercase tracking-widest hover:bg-quirky transition-all">
          Back to Store
        </Link>
      </div>
    );
  }

  const images = product.imageUrls || [product.imageUrl];
  const isSoldOut = (product as any).stock === 0;

  const handleBuyNow = () => {
    addToCart(product, quantity);
    navigate('/checkout');
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-2 text-[8px] font-bold uppercase tracking-widest text-zinc-400 mb-12">
          <Link to="/" className="hover:text-black transition-colors">Store</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-zinc-300">{product.category}</span>
          <ChevronRight className="w-3 h-3" />
          <span className="text-black">{product.name}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24">
          {/* Image Gallery */}
          <div className="space-y-6">
            <div className="aspect-square bg-zinc-50 relative overflow-hidden group border border-zinc-100">
              <AnimatePresence mode="wait">
                <motion.img
                  key={activeImage}
                  initial={{ opacity: 0, scale: 1.1 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  src={images[activeImage]}
                  alt={product.name}
                  className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700"
                  referrerPolicy="no-referrer"
                />
              </AnimatePresence>
              
              {/* Rarity Badge */}
              <div className={cn(
                "absolute top-6 left-6 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-white shadow-2xl",
                product.rarity === 'Unique' ? 'bg-cyber' : 
                product.rarity === 'Super Rare' ? 'bg-hot' : 
                product.rarity === 'Rare' ? 'bg-quirky' : 'bg-black'
              )}>
                {product.rarity}
              </div>

              {/* Navigation Arrows */}
              {images.length > 1 && (
                <>
                  <button 
                    onClick={() => setActiveImage((prev) => (prev === 0 ? images.length - 1 : prev - 1))}
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 backdrop-blur-sm flex items-center justify-center hover:bg-black hover:text-white transition-all opacity-0 group-hover:opacity-100"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => setActiveImage((prev) => (prev === images.length - 1 ? 0 : prev + 1))}
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 backdrop-blur-sm flex items-center justify-center hover:bg-black hover:text-white transition-all opacity-0 group-hover:opacity-100"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>

            {/* Thumbnails */}
            {images.length > 1 && (
              <div className="grid grid-cols-4 gap-4">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImage(idx)}
                    className={cn(
                      "aspect-square border-2 transition-all overflow-hidden bg-zinc-50",
                      activeImage === idx ? "border-black" : "border-transparent hover:border-zinc-200"
                    )}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all" referrerPolicy="no-referrer" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="flex flex-col">
            <div className="flex items-start justify-between mb-6">
              <div>
                <p className="text-[10px] font-bold text-quirky uppercase tracking-[0.3em] mb-2">
                  {product.category} {product.condition && `• ${product.condition}`}
                </p>
                <h1 className="text-5xl md:text-7xl font-bold tracking-tighter uppercase leading-[0.9] font-display">
                  {product.name}
                </h1>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setIsLiked(!isLiked)}
                  className={cn(
                    "w-12 h-12 border border-zinc-100 flex items-center justify-center transition-all",
                    isLiked ? "bg-hot text-white border-hot" : "bg-white text-zinc-400 hover:text-black hover:border-black"
                  )}
                >
                  <Heart className={cn("w-5 h-5", isLiked && "fill-current")} />
                </button>
                <button className="w-12 h-12 border border-zinc-100 flex items-center justify-center text-zinc-400 hover:text-black hover:border-black transition-all">
                  <Share2 className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex items-baseline gap-4 mb-12">
              <span className="text-4xl font-bold font-display">R{product.priceRange.min}</span>
              {product.discountPrice && (
                <span className="text-xl text-zinc-300 line-through font-display">R{product.priceRange.max}</span>
              )}
              {isSoldOut && (
                <span className="px-3 py-1 bg-zinc-100 text-zinc-400 text-[8px] font-bold uppercase tracking-widest border border-zinc-200">
                  Sold Out
                </span>
              )}
            </div>

            <div className="prose prose-zinc mb-12">
              <p className="text-zinc-500 text-sm leading-relaxed uppercase tracking-tight">
                {product.description}
              </p>
            </div>

            {/* Stats Grid */}
            {product.stats && (
              <div className="grid grid-cols-2 gap-4 mb-12">
                <div className="p-4 bg-zinc-50 border border-zinc-100">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="w-3 h-3 text-quirky" />
                    <span className="text-[8px] font-bold uppercase tracking-widest text-zinc-400">Quirkiness</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1 bg-zinc-200 rounded-full overflow-hidden">
                      <div className="h-full bg-quirky" style={{ width: `${product.stats.quirkiness}%` }} />
                    </div>
                    <span className="text-[10px] font-bold">{product.stats.quirkiness}</span>
                  </div>
                </div>
                <div className="p-4 bg-zinc-50 border border-zinc-100">
                  <div className="flex items-center gap-2 mb-2">
                    <Trophy className="w-3 h-3 text-hot" />
                    <span className="text-[8px] font-bold uppercase tracking-widest text-zinc-400">Rarity Score</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1 bg-zinc-200 rounded-full overflow-hidden">
                      <div className="h-full bg-hot" style={{ width: `${product.stats.rarity}%` }} />
                    </div>
                    <span className="text-[10px] font-bold">{product.stats.rarity}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-4 mt-auto">
              {!isSoldOut ? (
                <>
                  <div className="flex gap-4">
                    <div className="flex items-center border border-zinc-100 bg-zinc-50">
                      <button 
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        className="px-4 py-4 hover:bg-zinc-100 transition-colors"
                      >
                        -
                      </button>
                      <span className="w-12 text-center text-xs font-bold">{quantity}</span>
                      <button 
                        onClick={() => setQuantity(quantity + 1)}
                        className="px-4 py-4 hover:bg-zinc-100 transition-colors"
                      >
                        +
                      </button>
                    </div>
                    <button 
                      onClick={() => addToCart(product, quantity)}
                      className="flex-1 bg-white border-2 border-black text-black py-4 text-[10px] font-bold uppercase tracking-widest hover:bg-black hover:text-white transition-all flex items-center justify-center gap-2"
                    >
                      <ShoppingBag className="w-4 h-4" />
                      Add to Cart
                    </button>
                  </div>
                  <button 
                    onClick={handleBuyNow}
                    className="w-full bg-black text-white py-5 text-[10px] font-bold uppercase tracking-widest hover:bg-quirky transition-all shadow-2xl shadow-black/10"
                  >
                    {product.condition === 'New' ? 'Quick Checkout' : 'Buy It Now'}
                  </button>
                </>
              ) : (
                <button 
                  disabled
                  className="w-full bg-zinc-100 text-zinc-400 py-5 text-[10px] font-bold uppercase tracking-widest cursor-not-allowed border border-zinc-200"
                >
                  Currently Unavailable
                </button>
              )}
            </div>

            {/* Trust Badges */}
            <div className="grid grid-cols-3 gap-4 mt-12 pt-12 border-t border-zinc-100">
              <div className="text-center">
                <ShieldCheck className="w-5 h-5 mx-auto mb-2 text-zinc-300" />
                <p className="text-[6px] font-bold uppercase tracking-widest text-zinc-400">Authentic Only</p>
              </div>
              <div className="text-center">
                <Truck className="w-5 h-5 mx-auto mb-2 text-zinc-300" />
                <p className="text-[6px] font-bold uppercase tracking-widest text-zinc-400">Free Shipping</p>
              </div>
              <div className="text-center">
                <RefreshCcw className="w-5 h-5 mx-auto mb-2 text-zinc-300" />
                <p className="text-[6px] font-bold uppercase tracking-widest text-zinc-400">30 Day Returns</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
