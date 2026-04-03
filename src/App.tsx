import { Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, signIn, signOut, getRedirectResult } from './firebase';
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
    <Link to="/checkout" className="relative p-2 hover:bg-purple-50 rounded-full transition-colors">
      <ShoppingBag className="w-5 h-5 text-purple-400" />
      {count > 0 && (
        <span className="absolute -top-1 -right-1 w-5 h-5 text-white text-[9px] font-bold flex items-center justify-center rounded-full shadow-md" style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}>
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
    const timeout = setTimeout(() => setLoading(false), 8000);

    // Must call getRedirectResult first — this completes the redirect sign-in
    // flow and triggers onAuthStateChanged with the signed-in user.
    getRedirectResult(auth).catch(() => {}).finally(() => {
      const unsubscribe = onAuthStateChanged(auth, (u) => {
        clearTimeout(timeout);
        setUser(u);
        setIsAdmin(u?.email === 'patengel85@gmail.com');
        setLoading(false);
        unsubscribe();
      });
    });

    // Also subscribe immediately for desktop popup flow
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      clearTimeout(timeout);
      setUser(u);
      setIsAdmin(u?.email === 'patengel85@gmail.com');
      setLoading(false);
    });

    return () => { clearTimeout(timeout); unsubscribe(); };
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
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#FDF4FF' }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-10 h-10 border-4 border-t-transparent rounded-full"
          style={{ borderColor: '#A855F7', borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  return (
    <CartProvider>
      <div className="min-h-screen font-sans" style={{ background: '#FDF4FF', color: '#2D1B69' }}>
        <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md shadow-sm border-b border-purple-100">
          <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
            <Link to="/" className="flex items-center">
              <Logo />
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-2">
              {navLinks.map(link => {
                const isActive = location.pathname + location.search === link.to;
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={cn(
                      "px-4 py-2 rounded-full text-sm font-bold transition-all",
                      isActive
                        ? "text-white shadow-md"
                        : "text-purple-400 hover:text-purple-600 hover:bg-purple-50"
                    )}
                    style={isActive ? { background: 'linear-gradient(135deg, #F472B6, #A855F7)' } : {}}
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
                  <span className="text-xs font-bold text-purple-300 hidden sm:inline truncate max-w-[120px]">{user.email}</span>
                  <button
                    onClick={signOut}
                    className="p-2 hover:bg-purple-50 rounded-full transition-colors"
                  >
                    <LogOut className="w-4 h-4 text-purple-400" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={signIn}
                  className="btn-primary text-sm px-5 py-2"
                >
                  <LogIn className="w-4 h-4" />
                  Sign In
                </button>
              )}

              {/* Mobile Menu Toggle */}
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="md:hidden p-2 hover:bg-purple-50 rounded-full transition-colors"
              >
                {isMenuOpen ? <X className="w-6 h-6 text-purple-500" /> : <Menu className="w-6 h-6 text-purple-500" />}
              </button>
            </div>
          </div>

          {/* Mobile Navigation Menu */}
          <AnimatePresence>
            {isMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="md:hidden absolute top-20 left-4 right-4 bg-white rounded-3xl shadow-2xl border border-purple-100 p-4 overflow-hidden"
              >
                <div className="flex flex-col gap-1">
                  {navLinks.map(link => (
                    <Link
                      key={link.to}
                      to={link.to}
                      onClick={() => setIsMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-purple-50 text-sm font-bold text-purple-600 transition-colors"
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

        <main className="pt-20 pb-20">
          {!user && (
            <div className="max-w-7xl mx-auto px-4 pt-24">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-3xl p-12 md:p-20 text-center relative overflow-hidden"
                style={{ background: 'linear-gradient(135deg, #fdf4ff 0%, #fce7f3 50%, #ede9fe 100%)' }}
              >
                <div className="absolute top-8 left-8 w-24 h-24 rounded-full opacity-20 animate-float" style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }} />
                <div className="absolute bottom-8 right-8 w-16 h-16 rounded-full opacity-20 animate-float" style={{ background: 'linear-gradient(135deg, #FBBF24, #FB923C)', animationDelay: '1s' }} />
                <div className="absolute top-1/2 left-4 w-10 h-10 rounded-full opacity-15 animate-float" style={{ background: '#4ADE80', animationDelay: '0.5s' }} />
                <div className="relative z-10 max-w-2xl mx-auto">
                  <h2 className="text-6xl md:text-8xl font-black mb-6 leading-tight gradient-text">
                    Quirkify
                  </h2>
                  <p className="text-purple-400 mb-10 text-base font-semibold leading-relaxed">
                    The next generation of social commerce.<br />
                    AI-curated, live-streamed, and community-driven.
                  </p>
                  <button onClick={signIn} className="btn-primary text-base px-10 py-4">
                    <Sparkles className="w-5 h-5" />
                    Enter the Fun
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



