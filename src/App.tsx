import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, firebaseInitialized } from './firebase';
import { syncProfile } from './services/profileService';
import { Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import StoreFront from './components/store/StoreFront';
import AdminDashboard from './components/admin/AdminDashboard';
import ProductsPage from './components/admin/ProductsPage';
import CommercePage from './components/admin/CommercePage';
import GrowthPage from './components/admin/GrowthPage';
import ResourceMonitor from './components/admin/ResourceMonitor';
import Inventory from './components/inventory/Inventory';
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
import { ModeProvider } from './context/ModeContext';

console.log('[Quirkify] App mounted, firebaseInitialized:', firebaseInitialized);

function AnimatedRoutes({ isAdmin, user }: { isAdmin: boolean; user: any }) {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <motion.div key={location.pathname} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3, ease: 'easeOut' }}>
        <Routes location={location}>
          <Route path="/" element={<StoreFront />} />
          <Route path="/auctions" element={<AuctionList />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/product/:id" element={<ProductDetails />} />
          <Route path="/payment/success" element={<PaymentResult type="success" />} />
          <Route path="/payment/cancel" element={<PaymentResult type="cancel" />} />
          <Route path="/live/:sessionId" element={<LiveStreamRoom />} />
          <Route path="/collection" element={<Collection />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/profile/:username" element={<PublicProfile />} />
          <Route path="/seller/onboard" element={<SellerOnboarding />} />
          {user && <Route path="/seller/onboard" element={<SellerOnboarding />} />}
          {isAdmin && (
            <>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/products" element={<ProductsPage />} />
              <Route path="/admin/commerce" element={<CommercePage />} />
              <Route path="/admin/growth" element={<GrowthPage />} />
              <Route path="/admin/resources" element={<ResourceMonitor />} />
              <Route path="/admin/inventory" element={<Inventory />} />
            </>
          )}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

export default function App() {
  console.log('[App] Rendering, firebaseInitialized:', firebaseInitialized);
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    console.log('[App] useEffect running, firebaseInitialized:', firebaseInitialized);
    const hardTimeout = setTimeout(() => {
      console.warn('[Auth] Hard timeout fired - rendering without auth');
      setLoading(false);
    }, 6000);

    if (firebaseInitialized && auth) {
      console.log('[Auth] Subscribing to auth state...');
      onAuthStateChanged(auth, async (u) => {
        console.log('[Auth] State changed:', u ? u.uid : 'null');
        clearTimeout(hardTimeout);
        setUser(u);
        if (u) {
          try {
            const profile = await syncProfile(u);
            setIsAdmin(profile.role === 'admin');
          } catch { setIsAdmin(false); }
        }
        setLoading(false);
      }, (err) => {
        console.error('[Auth] Observer error:', err);
        clearTimeout(hardTimeout);
        setLoading(false);
      });
    } else {
      console.warn('[App] Firebase not initialized, skipping auth');
      clearTimeout(hardTimeout);
      setLoading(false);
    }

    return () => clearTimeout(hardTimeout);
  }, []);

  console.log('[App] render, loading:', loading);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: '#FDF4FF' }}>
        <Sparkles className="w-12 h-12 text-purple-500 mb-4" />
        <h1 className="text-2xl font-bold text-purple-600 mb-2">Quirkify</h1>
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-10 h-10 border-4 border-t-transparent rounded-full"
          style={{ borderColor: '#A855F7', borderTopColor: 'transparent' }} />
        <p className="text-gray-500 mt-3 text-sm">Loading your experience...</p>
      </div>
    );
  }

  return (
    <CartProvider>
      <ModeProvider>
        <div className="min-h-screen bg-gradient-to-br from-purple-50 to-white">
          <AnimatedRoutes isAdmin={isAdmin} user={user} />
          <MobileNav />
          <PageHeader />
        </div>
      </ModeProvider>
    </CartProvider>
  );
}
