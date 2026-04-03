import { Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, signIn, signOut } from './firebase';
import { LayoutDashboard, ShoppingBag, PlusCircle, CheckCircle, TrendingUp, LogIn, LogOut, Menu, X, Zap, Gavel, Sparkles, ClipboardList, User as UserIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';

import Logo from './components/layout/Logo';
import StoreFront from './components/store/StoreFront';
import AdminDashboard from './components/admin/AdminDashboard';
import ProductIntake from './components/admin/ProductIntake';
import ReviewQueue from './components/admin/ReviewQueue';
import CampaignManager from './components/admin/CampaignManager';
import SocialIntegration from './components/admin/SocialIntegration';
import AuctionList from './components/store/AuctionList';
import AuctionManager from './components/admin/AuctionManager';
import LiveStreamRoom from './components/live/LiveStreamRoom';
import Collection from './components/profile/Collection';
import PublicProfile from './components/profile/PublicProfile';
import Orders from './components/profile/Orders';
import SellerOnboarding from './components/profile/SellerOnboarding';
import Checkout from './components/store/Checkout';
import PaymentResult from './components/store/PaymentResult';
import ProductDetails from './components/store/ProductDetails';
import MobileNav from './components/layout/MobileNav';

import { CartProvider, useCart } from './context/CartContext';

function CartButton() {
  const { items } = useCart();
  const count = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <Link to="/checkout" className="relative p-2 hover:bg-zinc-100 rounded-none transition-colors">
      <ShoppingBag className="w-5 h-5" />
      {count > 0 && (
        <span className="absolute top-0 right-0 w-4 h-4 bg-quirky text-white text-[8px] font-bold flex items-center justify-center rounded-full">
          {count}
        </span>
      )}
    </Link>
  );
}

function AnimatedRoutes({ isAdmin, user }: { isAdmin: boolean, user: User | null }) {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        <Routes location={location}>
          <Route path="/" element={<StoreFront />} />
          <Route path="/auctions" element={<AuctionList />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/product/:id" element={<ProductDetails />} />
          <Route path="/payment/success" element={<PaymentResult type="success" />} />
          <Route path="/payment/cancel" element={<PaymentResult type="cancel" />} />
          <Route path="/live/:sessionId" element={<LiveStreamRoom />} />
          <Route path="/collection" element={<Collection />} />
          <Route path="/profile/:uid" element={<PublicProfile />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/seller/onboarding" element={<SellerOnboarding />} />
          <Route path="/admin" element={isAdmin ? <AdminDashboard /> : <Navigate to="/" />} />
          <Route path="/admin/intake" element={isAdmin ? <ProductIntake /> : <Navigate to="/" />} />
          <Route path="/admin/reviews" element={isAdmin ? <ReviewQueue /> : <Navigate to="/" />} />
          <Route path="/admin/campaigns" element={isAdmin ? <CampaignManager /> : <Navigate to="/" />} />
          <Route path="/admin/auctions" element={isAdmin ? <AuctionManager /> : <Navigate to="/" />} />
          <Route path="/admin/social" element={isAdmin ? <SocialIntegration /> : <Navigate to="/" />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);

  const location = useLocation();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAdmin(u?.email === 'patengel85@gmail.com');
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const navLinks = useMemo(() => [
    { to: '/?filter=sale', label: 'Sales', icon: ShoppingBag },
    { to: '/auctions', label: 'Auctions', icon: Gavel },
    { to: '/orders', label: 'Orders', icon: ClipboardList },
    { to: '/collection', label: 'My Account', icon: UserIcon },
    ...(isAdmin ? [
      { to: '/admin', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/admin/intake', label: 'Intake', icon: PlusCircle },
      { to: '/admin/reviews', label: 'Reviews', icon: CheckCircle },
      { to: '/admin/campaigns', label: 'Campaigns', icon: TrendingUp },
      { to: '/admin/auctions', label: 'Manage Auctions', icon: Gavel },
      { to: '/admin/social', label: 'Social', icon: Zap },
    ] : []),
  ], [isAdmin]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-black">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-2 border-quirky border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <CartProvider>
      <div className="min-h-screen bg-white text-black font-sans selection:bg-quirky selection:text-white">
        <nav className="fixed top-0 left-0 right-0 z-50 border-b border-zinc-100 bg-white/80 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <Link to="/" className="flex items-center">
              <Logo />
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-8">
              {navLinks.map(link => {
                const isActive = location.pathname + location.search === link.to;
                return (
                  <Link 
                    key={link.to} 
                    to={link.to} 
                    className={cn(
                      "text-[10px] font-bold uppercase tracking-widest transition-colors",
                      isActive ? "text-quirky" : "text-zinc-500 hover:text-quirky"
                    )}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <CartButton />
              {user ? (
                <div className="flex items-center gap-2">
                  <span className="text-[8px] font-bold text-zinc-400 hidden sm:inline uppercase tracking-widest">{user.email}</span>
                  <button 
                    onClick={signOut}
                    className="p-2 hover:bg-zinc-100 rounded-none transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button 
                  onClick={signIn}
                  className="flex items-center gap-2 px-6 py-2 bg-black text-white rounded-none text-[10px] font-bold uppercase tracking-widest hover:bg-quirky transition-colors"
                >
                  <LogIn className="w-4 h-4" />
                  Sign In
                </button>
              )}
              
              {/* Mobile Menu Toggle */}
              <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="md:hidden p-2 hover:bg-zinc-100 rounded-none transition-colors"
              >
                {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>

          {/* Mobile Navigation Menu */}
          <AnimatePresence>
            {isMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="md:hidden absolute top-16 left-0 right-0 bg-white border-b border-zinc-100 p-4 shadow-xl"
              >
                <div className="flex flex-col gap-4">
                  {navLinks.map(link => (
                    <Link 
                      key={link.to} 
                      to={link.to} 
                      onClick={() => setIsMenuOpen(false)}
                      className="flex items-center gap-3 p-3 rounded-none hover:bg-zinc-50 text-[10px] font-bold uppercase tracking-widest"
                    >
                      <link.icon className="w-4 h-4" />
                      {link.label}
                    </Link>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </nav>

        <main className="pt-16 pb-20">
          {!user && (
            <div className="max-w-7xl mx-auto px-4 pt-24">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-zinc-50 border border-zinc-100 p-20 text-center shadow-2xl shadow-zinc-100/50 relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-20 opacity-5">
                  <ShoppingBag className="w-64 h-64" />
                </div>
                <div className="relative z-10 max-w-2xl mx-auto">
                  <h2 className="text-6xl md:text-9xl font-bold mb-8 tracking-tighter uppercase leading-[0.8] font-display">QUIRK<br /><span className="text-quirky">IFY.</span></h2>
                  <p className="text-zinc-500 mb-12 text-[10px] font-bold uppercase tracking-[0.4em] leading-relaxed">
                    The next generation of social commerce. <br />
                    AI-curated, live-streamed, and community-driven.
                  </p>
                  <button 
                    onClick={signIn}
                    className="px-16 py-5 bg-black text-white rounded-none font-bold uppercase tracking-[0.3em] text-[10px] hover:bg-quirky transition-all shadow-xl shadow-black/10"
                  >
                    Enter Ecosystem
                  </button>
                </div>
              </motion.div>
            </div>
          )}
          <AnimatedRoutes isAdmin={isAdmin} user={user} />
        </main>
        <MobileNav />
      </div>
    </CartProvider>
  );
}



