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
import TermsOfService from './components/legal/TermsOfService';
import PrivacyPolicy from './components/legal/PrivacyPolicy';
import ReturnsPolicy from './components/legal/ReturnsPolicy';
import Footer from './components/layout/Footer';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Announcer, SkipLink } from './components/ui/Announcer';

import { CartProvider } from './context/CartContext';
import { ModeProvider, useMode } from './context/ModeContext';

const ADMIN_EMAILS = new Set(
  (import.meta.env.VITE_ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
);

function RequireAuth({ user, children }: { user: AuthUser | null; children: ReactNode }) {
  const location = useLocation();

  if (!user) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/auth?next=${next}`} replace />;
  }

  return <>{children}</>;
}

function RequireAdmin({
  user,
  isAdmin,
  children,
}: {
  user: AuthUser | null;
  isAdmin: boolean;
  children: ReactNode;
}) {
  const location = useLocation();

  if (!user) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/auth?next=${next}`} replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function AnimatedRoutes({ isAdmin, user }: { isAdmin: boolean; user: AuthUser | null }) {
  const location = useLocation();

  return (
    <motion.div
      key={location.pathname}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
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
        <Route path="/admin" element={<RequireAdmin user={user} isAdmin={isAdmin}><AdminDashboard /></RequireAdmin>} />
        <Route path="/admin/inventory" element={<RequireAdmin user={user} isAdmin={isAdmin}><Inventory /></RequireAdmin>} />
        <Route path="/admin/reviews"  element={<RequireAdmin user={user} isAdmin={isAdmin}><ProductsPage /></RequireAdmin>} />
        <Route path="/admin/orders"   element={<RequireAdmin user={user} isAdmin={isAdmin}><CommercePage /></RequireAdmin>} />
        <Route path="/admin/campaigns" element={<RequireAdmin user={user} isAdmin={isAdmin}><GrowthPage /></RequireAdmin>} />
        <Route path="/admin/social"   element={<RequireAdmin user={user} isAdmin={isAdmin}><GrowthPage /></RequireAdmin>} />
        <Route path="/admin/streams"  element={<RequireAdmin user={user} isAdmin={isAdmin}><GrowthPage /></RequireAdmin>} />
        <Route path="/admin/resources" element={<RequireAdmin user={user} isAdmin={isAdmin}><ResourceMonitor /></RequireAdmin>} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/returns" element={<ReturnsPolicy />} />
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
      setIsAdmin(false);

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
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col items-center gap-4"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
            className="w-8 h-8 rounded-full"
            style={{ border: '2.5px solid #e9d5ff', borderTopColor: '#a855f7' }}
          />
          <p className="text-sm font-medium text-gray-400">Loading Quirkify…</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen font-sans bg-gray-50 text-gray-900">
      <Announcer />
      <SkipLink />
      <PageHeader />

      <main id="main-content" className="pb-20" role="main">
        <ErrorBoundary>
          <AnimatedRoutes isAdmin={isAdmin} user={user} />
        </ErrorBoundary>
      </main>
      <Footer />
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
