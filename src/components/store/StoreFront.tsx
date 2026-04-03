import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot, limit } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../../firebase';
import { useLocation } from 'react-router-dom';

import { Product, LiveSession, Pack, UserProgress } from '../../types';
import { motion } from 'motion/react';
import { ShoppingBag, Sparkles, Zap, Play, Users, ArrowRight, Box, Trophy, Star, Tag, ShieldCheck, TrendingUp, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ensureUserProgress, RARITY_COLORS, RARITY_BG } from '../../services/gamificationService';
import { cn } from '../../lib/utils';
import { getPersonalizedRecommendations } from '../../services/personalizationService';

import { useCart } from '../../context/CartContext';

export default function StoreFront() {
  const { addToCart } = useCart();
  const location = useLocation();
  const [products, setProducts] = useState<Product[]>([]);
  const [recommendations, setRecommendations] = useState<Product[]>([]);
  const [liveSessions, setLiveSessions] = useState<LiveSession[]>([]);
  const [packs, setPacks] = useState<Pack[]>([]);
  const [userProgress, setUserProgress] = useState<UserProgress | null>(null);
  const [loading, setLoading] = useState(true);

  const searchParams = new URLSearchParams(location.search);
  const filterType = searchParams.get('filter');

  useEffect(() => {
    // Products
    let q = query(collection(db, 'products'), where('status', '==', 'approved'));
    
    const unsubscribeProducts = onSnapshot(q, async (snapshot) => {
      let allProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      
      // Filter by sale or condition if requested
      if (filterType === 'sale') {
        allProducts = allProducts.filter(p => p.discountPrice && p.discountPrice < p.priceRange.min);
      } else if (filterType) {
        allProducts = allProducts.filter(p => p.condition === filterType);
      }

      setProducts(allProducts.slice(0, 12));
      
      // Get personalized recommendations
      if (allProducts.length > 0) {
        try {
          const result = await getPersonalizedRecommendations(allProducts, ['vintage', 'tech', 'minimalism']);
          const recommended = allProducts.filter(p => result.recommendedIds.includes(p.id));
          setRecommendations(recommended);
        } catch (err) {
          console.error('Failed to get recommendations:', err);
        }
      }
      
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'products');
      setLoading(false);
    });

    // Live Sessions
    const qLive = query(collection(db, 'live_sessions'), where('status', '==', 'live'), limit(3));
    const unsubscribeLive = onSnapshot(qLive, (snapshot) => {
      setLiveSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LiveSession)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'live_sessions');
    });

    // Packs
    const qPacks = query(collection(db, 'packs'), where('status', '==', 'available'), limit(4));
    const unsubscribePacks = onSnapshot(qPacks, (snapshot) => {
      setPacks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Pack)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'packs');
    });

    // User Progress
    if (auth.currentUser) {
      ensureUserProgress(auth.currentUser.uid).then(setUserProgress);
    }

    return () => {
      unsubscribeProducts();
      unsubscribeLive();
      unsubscribePacks();
    };
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      {userProgress && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12 flex items-center justify-between bg-white border border-purple-100 p-4 rounded-3xl shadow-sm"
        >
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full text-white flex items-center justify-center font-black text-xs shadow-md" style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}>
                {userProgress.level}
              </div>
              <div>
                <p className="text-[8px] font-bold text-purple-400 uppercase tracking-widest">XP Progress</p>
                <div className="w-32 h-2 bg-purple-100 rounded-full mt-1 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-1000"
                    style={{ width: `${(userProgress.xp % 100)}%`, background: 'linear-gradient(90deg, #F472B6, #A855F7)' }}
                  />
                </div>
              </div>
            </div>
            <div className="h-8 w-px bg-zinc-200" />
            <div className="flex items-center gap-3">
              <Trophy className="w-4 h-4 text-cyber" />
              <div>
                <p className="text-[8px] font-bold text-purple-400 uppercase tracking-widest">Collection</p>
                <p className="text-xs font-bold">{userProgress.collectionCount} Items</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-[8px] font-bold text-purple-400 uppercase tracking-widest">Balance</p>
              <p className="text-xs font-bold">R{userProgress.balance}</p>
            </div>
            <Link 
              to="/collection"
              className="btn-primary px-4 py-2 text-xs"
            >
              My Vault
            </Link>
          </div>
        </motion.div>
      )}

      <header className="mb-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-end justify-between gap-8"
        >
          <div>
            <h1 className="text-7xl md:text-[8rem] font-black mb-4 leading-tight gradient-text">
              Quirky<br />Essentials
            </h1>
            <p className="text-purple-400 max-w-md text-base font-semibold mt-6">
              AI-curated drops for the modern eccentric. 🎉
            </p>
          </div>
          <div className="hidden lg:block w-64 h-64 p-8 rounded-3xl rotate-3 hover:rotate-0 transition-transform duration-500 shadow-xl" style={{ background: 'linear-gradient(135deg, #A855F7, #F472B6)' }}>
            <Sparkles className="w-8 h-8 text-white mb-4 animate-float" />
            <p className="text-sm font-bold text-white/90 leading-relaxed">
              Aura AI detected a 42% rise in demand for "Quirky Vintage" in Cape Town 🔥
            </p>
          </div>
        </motion.div>
      </header>

      {/* Trust Bar */}
      <div className="mb-32 grid grid-cols-1 md:grid-cols-3 gap-8 border-y border-purple-100 py-12">
        <div className="flex flex-col items-center text-center px-8">
          <ShieldCheck className="w-8 h-8 text-black mb-4" />
          <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] mb-2">Secure Payments</h3>
          <p className="text-purple-400 text-[8px] font-bold uppercase tracking-widest leading-relaxed">
            Integrated with Yoco for enterprise-grade transaction security.
          </p>
        </div>
        <div className="flex flex-col items-center text-center px-8 border-x border-purple-100">
          <Sparkles className="w-8 h-8 text-cyber mb-4" />
          <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] mb-2">AI-Verified Drops</h3>
          <h4 className="text-quirky text-[8px] font-bold uppercase tracking-widest mb-2">Aura AI Certified</h4>
          <p className="text-purple-400 text-[8px] font-bold uppercase tracking-widest leading-relaxed">
            Every item is analyzed by Aura AI for authenticity and market value.
          </p>
        </div>
        <div className="flex flex-col items-center text-center px-8">
          <Zap className="w-8 h-8 text-black mb-4" />
          <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] mb-2">Express Logistics</h3>
          <p className="text-purple-400 text-[8px] font-bold uppercase tracking-widest leading-relaxed">
            Powered by The Courier Guy for reliable nationwide delivery.
          </p>
        </div>
      </div>

      {/* Featured Hero Section */}
      <section className="mb-32 relative group cursor-pointer overflow-hidden border border-purple-100">
        <div className="aspect-[21/9] relative">
          <img 
            src="https://picsum.photos/seed/featured-drop/1920/1080" 
            className="w-full h-full object-cover transition-all duration-1000 group-hover:scale-105"
            alt="Featured Drop"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/40 to-transparent p-12 flex flex-col justify-center">
            <div className="max-w-xl">
              <div className="flex items-center gap-3 mb-6">
                <span className="px-3 py-1 bg-cyber text-black text-[8px] font-bold uppercase tracking-widest">Featured Drop</span>
                <span className="text-white/60 text-[8px] font-bold uppercase tracking-widest">Limited Edition • 1 of 10</span>
              </div>
              <h2 className="text-6xl font-bold text-white uppercase tracking-tighter mb-6 font-display leading-none">The Obsidian<br />Monolith.</h2>
              <p className="text-white/60 text-xs font-medium mb-8 leading-relaxed max-w-sm">
                A masterpiece of brutalist design, curated by Quirkify AI for the boldest collectors.
              </p>
              <div className="flex items-center gap-4">
                <button className="px-8 py-4 bg-white text-black text-[10px] font-bold uppercase tracking-widest hover:bg-quirky hover:text-white transition-all">
                  Bid Now
                </button>
                <div className="text-white">
                  <p className="text-[8px] font-bold uppercase tracking-widest opacity-60">Current Bid</p>
                  <p className="text-xl font-bold">R12,450</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Recommended Section */}
      {recommendations.length > 0 && (
        <section className="mb-32">
          <div className="flex items-center justify-between mb-12">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-black rounded-3xl flex items-center justify-center text-white">
                <Sparkles className="w-5 h-5" />
              </div>
              <h2 className="text-3xl font-bold uppercase tracking-tighter font-display">Recommended for You</h2>
            </div>
            <span className="text-[8px] font-bold uppercase tracking-[0.3em] text-purple-400">Based on your Aura</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {recommendations.map((product) => (
              <div key={`rec-${product.id}`} className="group border border-purple-100 p-6 hover:shadow-2xl transition-all duration-500">
                <div className="aspect-square bg-purple-50 mb-6 overflow-hidden relative">
                  <img src={product.imageUrl} className="w-full h-full object-cover transition-all duration-700" alt="" />
                  <div className="absolute top-4 right-4 px-2 py-1 bg-cyber text-black text-[8px] font-bold uppercase tracking-widest">AI Match</div>
                </div>
                <h3 className="font-bold text-sm uppercase tracking-tight mb-1">{product.name}</h3>
                <p className="text-[10px] font-bold text-quirky uppercase tracking-widest">R{product.priceRange.min}</p>
              </div>
            ))}
          </div>
        </section>
      )}
      {/* Live Now Section */}
      {liveSessions.length > 0 && (
        <section className="mb-32">
          <div className="flex items-center justify-between mb-12">
            <div className="flex items-center gap-4">
              <div className="px-3 py-1 bg-hot text-white text-[8px] font-bold uppercase tracking-widest animate-pulse">LIVE NOW</div>
              <h2 className="text-3xl font-bold uppercase tracking-tighter font-display">Live Auctions</h2>
            </div>
            <Link to="/auctions" className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 hover:text-quirky transition-colors">
              View All <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {liveSessions.map((session) => (
              <Link 
                key={session.id} 
                to={`/live/${session.id}`}
                className="group relative aspect-[9/16] bg-zinc-900 overflow-hidden border border-zinc-800"
              >
                <img 
                  src={session.thumbnailUrl || `https://picsum.photos/seed/${session.id}/600/1000`} 
                  className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-all duration-700 grayscale group-hover:grayscale-0 group-hover:scale-105"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 p-8 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
                      <Users className="w-3 h-3 text-white" />
                      <span className="text-[10px] font-bold text-white">{session.viewerCount}</span>
                    </div>
                    <div className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10">
                      <Play className="w-4 h-4 text-white fill-current" />
                    </div>
                  </div>
                  <div>
                    <p className="text-[8px] font-bold text-quirky uppercase tracking-widest mb-2">{session.hostName} is live</p>
                    <h3 className="text-xl font-bold text-white uppercase tracking-tight leading-tight group-hover:text-cyber transition-colors">{session.title}</h3>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Recently Sold Ticker */}
      <section className="mb-32">
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-hot rounded-3xl flex items-center justify-center text-white">
              <TrendingUp className="w-5 h-5" />
            </div>
            <h2 className="text-3xl font-bold uppercase tracking-tighter font-display">Recently Sold</h2>
          </div>
          <span className="text-[8px] font-bold uppercase tracking-[0.3em] text-purple-400">Real-time Activity</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={`sold-${i}`} className="bg-purple-50 p-4 border border-purple-100 flex flex-col items-center text-center group">
              <div className="w-16 h-16 bg-white mb-4 overflow-hidden border border-purple-100">
                <img 
                  src={`https://picsum.photos/seed/sold-${i}/200/200`} 
                  className="w-full h-full object-cover transition-all" 
                  alt="Sold Item"
                  referrerPolicy="no-referrer"
                />
              </div>
              <p className="text-[8px] font-bold uppercase tracking-widest text-purple-400 mb-1">Sold for</p>
              <p className="text-xs font-bold text-hot">R{(Math.random() * 5000 + 500).toFixed(0)}</p>
              <div className="mt-2 flex items-center gap-1">
                <CheckCircle className="w-2 h-2 text-green-500" />
                <span className="text-[6px] font-bold uppercase tracking-widest text-zinc-300">Verified</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Mystery Packs Section */}
      {packs.length > 0 && (
        <section className="mb-32">
          <div className="flex items-center justify-between mb-12">
            <div className="flex items-center gap-4">
              <Box className="w-6 h-6 text-quirky" />
              <h2 className="text-3xl font-bold uppercase tracking-tighter font-display">Mystery Drops</h2>
            </div>
            <span className="text-[8px] font-bold uppercase tracking-[0.3em] text-purple-400">Limited Availability</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {packs.map((pack) => (
              <motion.div 
                key={pack.id}
                whileHover={{ y: -10 }}
                className="bg-purple-50 border border-purple-100 p-8 text-center group cursor-pointer"
              >
                <div className="aspect-square bg-white mb-8 flex items-center justify-center relative overflow-hidden">
                  <img src={pack.imageUrl} className="w-32 h-32 object-contain group-hover:scale-110 transition-transform duration-500" alt="" />
                  <div className="absolute inset-0 bg-quirky/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <h3 className="text-sm font-bold uppercase tracking-tight mb-2">{pack.name}</h3>
                <p className="text-[8px] text-purple-400 font-bold uppercase tracking-widest mb-6">{pack.description}</p>
                <button className="w-full py-3 bg-black text-white text-[10px] font-bold uppercase tracking-widest hover:bg-quirky transition-all">
                  OPEN PACK • R{pack.price}
                </button>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      <div className="mb-32 overflow-hidden border-y border-purple-100 py-8">
        <div className="flex animate-marquee whitespace-nowrap gap-12">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={`marquee-${i}`} className="flex items-center gap-4">
              <Zap className="w-4 h-4 text-quirky" />
              <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-purple-400">QUIRKIFY AI: Real-time market analysis active • Trending: Neon Minimalism • Next Drop in 4h 22m</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-32">
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-4">
            <Sparkles className="w-6 h-6 text-cyber animate-pulse-glow" />
            <h2 className="text-3xl font-bold uppercase tracking-tighter font-display">The AI Edit</h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-cyber rounded-full animate-pulse" />
            <span className="text-[8px] font-bold uppercase tracking-[0.3em] text-purple-400">Analyzing Market Trends...</span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div className="aspect-[16/10] bg-purple-50 relative overflow-hidden group cursor-pointer border border-purple-100">
            <img 
              src="https://picsum.photos/seed/curated1/1200/800" 
              className="w-full h-full object-cover transition-all duration-1000 group-hover:scale-105" 
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-12">
              <div className="flex items-center gap-2 mb-4">
                <div className="px-2 py-0.5 bg-white/10 backdrop-blur-md border border-white/20 text-white text-[6px] font-bold uppercase tracking-widest">98% Match</div>
              </div>
              <h3 className="text-5xl font-bold text-white uppercase tracking-tighter mb-4">Cyber<br />Minimalism</h3>
              <p className="text-quirky text-[10px] font-bold uppercase tracking-[0.3em]">Curated by Quirkify AI</p>
            </div>
          </div>
          <div className="aspect-[16/10] bg-purple-50 relative overflow-hidden group cursor-pointer border border-purple-100">
            <img 
              src="https://picsum.photos/seed/curated2/1200/800" 
              className="w-full h-full object-cover transition-all duration-1000 group-hover:scale-105" 
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-12">
              <div className="flex items-center gap-2 mb-4">
                <div className="px-2 py-0.5 bg-white/10 backdrop-blur-md border border-white/20 text-white text-[6px] font-bold uppercase tracking-widest">Trending Now</div>
              </div>
              <h3 className="text-5xl font-bold text-white uppercase tracking-tighter mb-4">Vintage<br />Futurism</h3>
              <p className="text-cyber text-[10px] font-bold uppercase tracking-[0.3em]">Trending in Cape Town</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-4">
          <h2 className="text-3xl font-black gradient-text">
            {filterType === 'sale' ? '🔥 Flash Sales' :
             filterType === 'New' ? '✨ New Arrivals' :
             filterType === 'Pre-owned' ? '💎 Pre-owned Gems' : 'All Products'}
          </h2>
          <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
            {[
              { to: '/', label: 'All', active: !filterType, bg: 'linear-gradient(135deg, #F472B6, #A855F7)' },
              { to: '/?filter=sale', label: '🔥 Sale', active: filterType === 'sale', bg: 'linear-gradient(135deg, #F43F5E, #FB923C)' },
              { to: '/?filter=New', label: '✨ New', active: filterType === 'New', bg: 'linear-gradient(135deg, #4ADE80, #60A5FA)' },
              { to: '/?filter=Pre-owned', label: '💎 Pre-owned', active: filterType === 'Pre-owned', bg: 'linear-gradient(135deg, #A855F7, #6366F1)' },
            ].map(({ to, label, active, bg }) => (
              <Link
                key={to}
                to={to}
                className="px-5 py-2 rounded-full text-sm font-bold transition-all whitespace-nowrap border-2"
                style={active ? { background: bg, color: 'white', borderColor: 'transparent' } : { background: 'white', color: '#A78BFA', borderColor: '#EDE9FE' }}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-12">
            {[1, 2, 3, 4].map(i => (
              <div key={`skeleton-${i}`} className="aspect-[3/4] bg-purple-50 animate-pulse rounded-3xl" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-32 border border-purple-100 rounded-3xl bg-purple-50">
            <ShoppingBag className="w-12 h-12 mx-auto mb-4 text-zinc-300" />
            <p className="text-purple-400 font-bold uppercase tracking-widest text-xs">No products available yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-x-12 gap-y-16">
            {products.map((product, idx) => {
              const isSoldOut = product.stock === 0;
              const isLowStock = product.stock !== undefined && product.stock > 0 && product.stock < 5;

              return (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.05 }}
                  className="group"
                >
                  <div className="aspect-[3/4] overflow-hidden bg-purple-50 mb-4 relative rounded-3xl border border-purple-100">
                    <Link to={`/product/${product.id}`} className="block w-full h-full">
                      <img 
                        src={product.imageUrl} 
                        alt={product.name}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 grayscale group-hover:grayscale-0"
                        referrerPolicy="no-referrer"
                      />
                    </Link>
                    <div className="absolute top-4 left-4 flex flex-col gap-2 pointer-events-none">
                      <div className={cn(
                        "text-white text-[8px] font-bold px-2 py-1 uppercase tracking-widest",
                        product.rarity === 'Unique' ? 'bg-cyber text-black' : 
                        product.rarity === 'Super Rare' ? 'bg-hot' : 
                        product.rarity === 'Rare' ? 'bg-quirky' : 'bg-black'
                      )}>
                        {product.rarity}
                      </div>
                      {product.condition && (
                        <div className="bg-white/90 backdrop-blur-sm text-black text-[8px] font-bold px-2 py-1 uppercase tracking-widest border border-purple-100">
                          {product.condition}
                        </div>
                      )}
                      {product.discountPrice && product.discountPrice < product.priceRange.min && (
                        <div className="bg-hot text-white text-[8px] font-bold px-2 py-1 uppercase tracking-widest flex items-center gap-1">
                          <Tag className="w-2 h-2" /> SALE
                        </div>
                      )}
                      {isSoldOut && (
                        <div className="bg-zinc-100 text-purple-400 text-[8px] font-bold px-2 py-1 uppercase tracking-widest border border-zinc-200">
                          SOLD OUT
                        </div>
                      )}
                      {isLowStock && (
                        <div className="bg-quirky text-white text-[8px] font-bold px-2 py-1 uppercase tracking-widest animate-pulse">
                          LAST {product.stock} LEFT
                        </div>
                      )}
                    </div>
                    
                    {product.serialNumber && (
                      <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm text-black text-[8px] font-bold px-2 py-1 uppercase tracking-widest border border-purple-100 pointer-events-none">
                        #{product.serialNumber}
                      </div>
                    )}

                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-500 flex flex-col items-center justify-center gap-3 opacity-0 group-hover:opacity-100 lg:flex hidden backdrop-blur-[2px]">
                      {!isSoldOut ? (
                        <>
                          <motion.button 
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={(e) => {
                              e.preventDefault();
                              addToCart(product);
                            }}
                            className="btn-primary w-40 py-3 text-xs justify-center rounded-full"
                          >
                            <ShoppingBag className="w-3 h-3" />
                            Add to Cart
                          </motion.button>
                          <motion.button 
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={(e) => {
                              e.preventDefault();
                              addToCart(product);
                              window.location.href = '/checkout';
                            }}
                            className="btn-secondary w-40 py-3 text-xs justify-center"
                          >
                            <Zap className="w-3 h-3" />
                            Quick Buy
                          </motion.button>
                        </>
                      ) : (
                        <Link 
                          to={`/product/${product.id}`}
                          className="w-40 py-4 bg-zinc-100 text-purple-400 text-[10px] font-bold uppercase tracking-[0.2em] shadow-2xl border border-zinc-200 transition-all text-center"
                        >
                          View Details
                        </Link>
                      )}
                    </div>

                    {/* Mobile Add to Cart */}
                    <div className="lg:hidden absolute bottom-2 right-2">
                      {!isSoldOut && (
                        <button 
                          onClick={(e) => {
                            e.preventDefault();
                            addToCart(product);
                          }}
                          className="p-3 bg-black text-white shadow-xl hover:bg-quirky transition-all"
                        >
                          <ShoppingBag className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  <Link to={`/product/${product.id}`} className="space-y-4 block">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-xs uppercase tracking-tight">{product.name}</h3>
                      <div className="text-right">
                        {product.discountPrice && product.discountPrice < product.priceRange.min ? (
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-purple-400 text-[10px] line-through">R{product.priceRange.min}</p>
                            <p className="font-bold text-hot text-xs">R{product.discountPrice}</p>
                          </div>
                        ) : (
                          <p className="font-bold text-black text-xs">R{product.priceRange.min}</p>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-1">
                      {Object.entries(product.stats || {}).map(([key, val]) => (
                        <div key={key} className="bg-purple-50 p-1 text-center border border-purple-100">
                          <p className="text-[6px] text-purple-400 uppercase font-bold">{key[0]}</p>
                          <p className="text-[8px] font-bold">{val}</p>
                        </div>
                      ))}
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

