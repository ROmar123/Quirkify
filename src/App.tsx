import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect, type ReactNode } from 'react';
import { auth, onAuthStateChanged, type AuthUser } from './firebase';
import { syncProfile } from './services/profileService';
import { motion } from 'motion/react';

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
import AuthPage from './components/auth/AuthPage';
import { ErrorBoundary } from './components/ErrorBoundary';

import { CartProvider } from './context/CartContext';
import { ModeProvider, useMode } from './context/ModeContext';

const ADMIN_EMAILS = new Set(['patengel85@gmail.com']);

function RequireAuth({ user, children }: { user: AuthUser | null; children: ReactNode }) {
  const location = useLocation();

  if (!user) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/auth?next=${next}`} replace />;
  }

  return <>{children}</>;
}

function AnimatedRoutes({ isAdmin, user }: { isAdmin: boolean; user: AuthUser | null }) {
  const location = useLocation();

  return (
    <motion.div
      key={location.pathname}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <Routes location={location}>
        <Route path="/" element={<StoreFront />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/auctions" element={<AuctionList />} />
        <Route path="/checkout" element={<RequireAuth user={user}><Checkout /></RequireAuth>} />
        <Route path="/product/:id" element={<ProductDetails />} />
        <Route path="/payment/success" element={<PaymentResult type="success" />} />
        <Route path="/payment/cancel" element={<PaymentResult type="cancel" />} />
        <Route path="/live/:sessionId" element={<LiveStreamRoom />} />
        <Route path="/collection" element={<RequireAuth user={user}><Collection /></RequireAuth>} />
        <Route path="/profile/:uid" element={<PublicProfile />} />
        <Route path="/orders" element={<RequireAuth user={user}><Orders /></RequireAuth>} />
        <Route path="/seller/onboarding" element={<RequireAuth user={user}><SellerOnboarding /></RequireAuth>} />
        <Route path="/admin" element={isAdmin ? <AdminDashboard /> : <Navigate to="/" />} />
        <Route path="/admin/inventory" element={isAdmin ? <Inventory /> : <Navigate to="/" />} />
        <Route path="/admin/reviews"  element={isAdmin ? <ProductsPage /> : <Navigate to="/" />} />
        <Route path="/admin/orders"   element={isAdmin ? <CommercePage /> : <Navigate to="/" />} />
        <Route path="/admin/campaigns" element={isAdmin ? <GrowthPage /> : <Navigate to="/" />} />
        <Route path="/admin/social"   element={isAdmin ? <GrowthPage /> : <Navigate to="/" />} />
        <Route path="/admin/streams"  element={isAdmin ? <GrowthPage /> : <Navigate to="/" />} />
        <Route path="/admin/resources" element={isAdmin ? <ResourceMonitor /> : <Navigate to="/" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </motion.div>
  );
}

function AppInner() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { isAdmin, setIsAdmin } = useMode();

  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 8000);
    let prevUser: AuthUser | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      clearTimeout(timeout);
      const isFirstLoad = !prevUser;
      prevUser = u;
      setUser(u);

      if (u) {
        try {
          const profile = await syncProfile(u);
          const admin = profile.role === 'admin' || ADMIN_EMAILS.has((u.email ?? '').toLowerCase());
          setIsAdmin(admin);
          setLoading(false);

          if (isFirstLoad && admin) {
            navigate('/admin');
          } else if (isFirstLoad) {
            navigate('/');
          }
        } catch (err) {
          console.error('Profile sync failed:', err);
          setIsAdmin(ADMIN_EMAILS.has((u.email ?? '').toLowerCase()));
          setLoading(false);
        }
      } else {
        setIsAdmin(false);
        setLoading(false);
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
      <PageHeader />

      <main className="pb-20">
        <ErrorBoundary>
          <AnimatedRoutes isAdmin={isAdmin} user={user} />
        </ErrorBoundary>
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
