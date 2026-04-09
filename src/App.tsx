import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { onAuthStateChange, getCurrentUser } from './services/authService';
import { supabase } from './supabase';
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

console.log('[Quirkify] App mounted');

function AnimatedRoutes({ isAdmin, user }: { isAdmin: boolean; user: any }) {
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
  console.log('[App] Rendering');
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let settled = false;

    async function syncProfile(userId: string) {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('uid', userId)
          .single();
        if (!settled) {
          setIsAdmin(data?.role === 'admin');
        }
      } catch (err) {
        console.warn('[Auth] Profile sync failed:', err);
        if (!settled) setIsAdmin(false);
      }
    }

    // Safety timeout — if auth doesn't resolve in 5s, show the app anyway
    const timeout = setTimeout(() => {
      console.warn('[Auth] Timeout — proceeding without auth');
      settled = true;
      setLoading(false);
    }, 5000);

    const { data: { subscription } } = onAuthStateChange(async (u) => {
      clearTimeout(timeout);
      settled = true;
      setUser(u);
      if (u?.uid) {
        await syncProfile(u.uid);
      }
      setLoading(false);
    });

    return () => {
      clearTimeout(timeout);
      settled = true;
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: '#FDF4FF' }}>
        <Sparkles className="w-12 h-12 text-purple-500 mb-4" />
        <h1 className="text-2xl font-bold text-purple-600 mb-2">Quirkify</h1>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-10 h-10 border-4 border-t-transparent rounded-full"
          style={{ borderColor: '#A855F7', borderTopColor: 'transparent' }}
        />
        <p className="text-gray-500 mt-3 text-sm">Loading your experience...</p>
      </div>
    );
  }

  return (
    <CartProvider>
      <ModeProvider>
        <div className="min-h-screen bg-gradient-to-br from-purple-50 to-white">
          <PageHeader user={user} />
          <AnimatedRoutes isAdmin={isAdmin} user={user} />
          <MobileNav />
        </div>
      </ModeProvider>
    </CartProvider>
  );
}
