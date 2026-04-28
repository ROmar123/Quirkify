import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import { ModeProvider } from './context/ModeContext';
import { useSession } from './hooks/useSession';
import PageHeader from './components/layout/PageHeader';
import MobileNav from './components/layout/MobileNav';
import Footer from './components/layout/Footer';

const AuthPage = lazy(() => import('./components/auth/AuthPage'));
const StoreFront = lazy(() => import('./components/store/StoreFront'));
const ProductDetails = lazy(() => import('./components/store/ProductDetails'));
const AuctionList = lazy(() => import('./components/store/AuctionList'));
const Checkout = lazy(() => import('./components/store/Checkout'));
const PaymentResult = lazy(() => import('./components/store/PaymentResult'));
const Orders = lazy(() => import('./components/profile/Orders'));
const Collection = lazy(() => import('./components/profile/Collection'));
const PublicProfile = lazy(() => import('./components/profile/PublicProfile'));
const SellerOnboarding = lazy(() => import('./components/profile/SellerOnboarding'));
const AdminDashboard = lazy(() => import('./components/admin/AdminDashboard'));
const Inventory = lazy(() => import('./components/inventory/Inventory'));
const CommercePage = lazy(() => import('./components/admin/CommercePage'));
const GrowthPage = lazy(() => import('./components/admin/GrowthPage'));
const LiveStreamRoom = lazy(() => import('./components/live/LiveStreamRoom'));
const TermsOfService = lazy(() => import('./components/legal/TermsOfService'));
const PrivacyPolicy = lazy(() => import('./components/legal/PrivacyPolicy'));
const ReturnsPolicy = lazy(() => import('./components/legal/ReturnsPolicy'));

function Guard({
  allow,
  redirectTo,
  children,
}: {
  allow: boolean;
  redirectTo: string;
  children: ReactNode;
}) {
  const location = useLocation();
  if (!allow) {
    return <Navigate to={`${redirectTo}?next=${encodeURIComponent(location.pathname)}`} replace />;
  }
  return <>{children}</>;
}

function AppRoutes() {
  const { loading, isAuthenticated, isAdmin } = useSession();

  if (loading) {
    return (
      // Delayed fade-in prevents flash for fast (<150ms) localStorage auth reads
      <div
        className="min-h-screen flex items-center justify-center"
        style={{
          background: 'linear-gradient(135deg,#F472B6,#A855F7)',
          animation: 'fadeInSlow 0ms ease 150ms both',
        }}
      >
        <style>{`@keyframes fadeInSlow{from{opacity:0}to{opacity:1}}`}</style>
        <div className="text-center text-white">
          <p className="text-xs uppercase tracking-[0.4em] text-white/70">Quirkify</p>
          <div className="mt-4 w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHeader />
      <main className="min-h-screen pb-24 md:pb-10">
        <Suspense
          fallback={
            <div className="flex min-h-[50dvh] items-center justify-center px-4 text-center text-gray-800">
              <div>
                <p className="text-[11px] uppercase tracking-[0.35em] text-purple-400">Quirkify</p>
                <p className="mt-3 text-lg font-bold">Loading page…</p>
              </div>
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<StoreFront />} />
            <Route path="/product/:productId" element={<ProductDetails />} />
            <Route path="/auctions" element={<AuctionList />} />
            <Route path="/live/:sessionId" element={<LiveStreamRoom />} />
            <Route path="/checkout" element={<Guard allow={isAuthenticated} redirectTo="/auth"><Checkout /></Guard>} />
            <Route path="/orders" element={<Guard allow={isAuthenticated} redirectTo="/auth"><Orders /></Guard>} />
            <Route path="/profile" element={<Guard allow={isAuthenticated} redirectTo="/auth"><Collection /></Guard>} />
            <Route path="/collection" element={<Guard allow={isAuthenticated} redirectTo="/auth"><Collection /></Guard>} />
            <Route path="/profile/:uid" element={<PublicProfile />} />
            <Route path="/seller/onboarding" element={<Guard allow={isAuthenticated} redirectTo="/auth"><SellerOnboarding /></Guard>} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/payment/success" element={<Guard allow={isAuthenticated} redirectTo="/auth"><PaymentResult type="success" /></Guard>} />
            <Route path="/payment/cancel" element={<Guard allow={isAuthenticated} redirectTo="/auth"><PaymentResult type="cancel" /></Guard>} />
            <Route path="/admin" element={<Guard allow={isAdmin} redirectTo="/auth"><AdminDashboard /></Guard>} />
            <Route path="/admin/orders" element={<Guard allow={isAdmin} redirectTo="/auth"><Navigate to="/admin/commerce" replace /></Guard>} />
            <Route path="/admin/inventory" element={<Guard allow={isAdmin} redirectTo="/auth"><Inventory /></Guard>} />
            <Route path="/admin/commerce" element={<Guard allow={isAdmin} redirectTo="/auth"><CommercePage /></Guard>} />
            <Route path="/admin/campaigns" element={<Guard allow={isAdmin} redirectTo="/auth"><Navigate to="/admin/growth" replace /></Guard>} />
            <Route path="/admin/growth" element={<Guard allow={isAdmin} redirectTo="/auth"><GrowthPage /></Guard>} />
            <Route path="/terms" element={<TermsOfService />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/returns" element={<ReturnsPolicy />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
      <MobileNav />
    </>
  );
}

export default function App() {
  return (
    <ModeProvider>
      <CartProvider>
        <AppRoutes />
      </CartProvider>
    </ModeProvider>
  );
}
