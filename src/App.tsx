import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, signIn, getRedirectResult } from './firebase';
import { Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import StoreFront from './components/store/StoreFront';
import AdminDashboard from './components/admin/AdminDashboard';
import ProductsPage from './components/admin/ProductsPage';
import CommercePage from './components/admin/CommercePage';
import GrowthPage from './components/admin/GrowthPage';
import ResourceMonitor from './components/admin/ResourceMonitor';
import InventoryHub from './components/inventory/InventoryHub';
import AuctionList from './components/store/AuctionList';
import LiveStreamRoom from './components/live/LiveStreamRoom';
import Collection from './components/profile/Collection';
import PublicProfile from './components/profile/PublicProfile';
import Orders from './components/profile/Orders';
import SellerOnboarding from './components/profile/SellerOnboarding';
import Checkout from './components/store/Checkout';
import PaymentResult from './components/store/PaymentResult';
import ProductDetails from './components/store/ProductDetails';
import MobileNav from './components/layout/MobileNav';
import PageHeader from './components/layout/PageHeader';

import { CartProvider } from './context/CartContext';
import { ModeProvider, useMode } from './context/ModeContext';

function AnimatedRoutes({ isAdmin, user }: { isAdmin: boolean; user: User | null }) {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
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
          <Route path="/admin/inventory/*" element={isAdmin ? <InventoryHub /> : <Navigate to="/" />} />
          <Route path="/admin/listings" element={isAdmin ? <InventoryHub /> : <Navigate to="/" />} />
          <Route path="/admin/intake"   element={isAdmin ? <InventoryHub /> : <Navigate to="/" />} />
          <Route path="/admin/reviews"  element={isAdmin ? <ProductsPage /> : <Navigate to="/" />} />
          <Route path="/admin/orders"   element={isAdmin ? <CommercePage /> : <Navigate to="/" />} />
          <Route path="/admin/auctions" element={isAdmin ? <CommercePage /> : <Navigate to="/" />} />
          <Route path="/admin/packs"    element={isAdmin ? <CommercePage /> : <Navigate to="/" />} />
          <Route path="/admin/campaigns" element={isAdmin ? <GrowthPage /> : <Navigate to="/" />} />
          <Route path="/admin/social"   element={isAdmin ? <GrowthPage /> : <Navigate to="/" />} />
          <Route path="/admin/streams"  element={isAdmin ? <GrowthPage /> : <Navigate to="/" />} />
          <Route path="/admin/resources" element={isAdmin ? <ResourceMonitor /> : <Navigate to="/" />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

function AppInner() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { isAdmin, setIsAdmin } = useMode();

  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 8000);
    let prevUser: User | null = null;

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      clearTimeout(timeout);
      const isFirstLoad = !prevUser;
      prevUser = u;
      setUser(u);
      const admin = u?.email === 'patengel85@gmail.com';
      setIsAdmin(admin);
      setLoading(false);
      // On page load or sign-in: send admin to dashboard, new customer sign-in to store
      if (isFirstLoad && u && admin) {
        navigate('/admin');
      } else if (isFirstLoad && u && !admin) {
        navigate('/');
      }
    });

    return () => { clearTimeout(timeout); unsubscribe(); };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#FDF4FF' }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-10 h-10 border-4 border-t-transparent rounded-full"
          style={{ borderColor: '#A855F7', borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen font-sans" style={{ background: '#FDF4FF', color: '#2D1B69' }}>
      {/* Single sticky header — never re-mounts on navigation */}
      <PageHeader />

      <main className="pb-20">
        {!user && (
          <div className="max-w-7xl mx-auto px-4 py-12">
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
  );
}

export default function App() {
  return (
    <ModeProvider>
      <CartProvider>
        <AppInner />
      </CartProvider>
    </ModeProvider>
  );
}
