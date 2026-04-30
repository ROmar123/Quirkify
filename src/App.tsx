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
const ProfileHub = lazy(() => import('./components/profile/ProfileHub'));
const PublicProfile = lazy(() => import('./components/profile/PublicProfile'));
const SellerOnboarding = lazy(() => import('./components/profile/SellerOnboarding'));
const AdminDashboard = lazy(() => import('./components/admin/AdminDashboard'));
const Inventory = lazy(() => import('./components/inventory/Inventory'));
const CommercePage = lazy(() => import('./components/admin/CommercePage'));
const OrderManager = lazy(() => import('./components/admin/OrderManager'));
const GrowthPage = lazy(() => import('./components/admin/GrowthPage'));
const LiveStreamManager = lazy(() => import('./components/admin/LiveStreamManager'));
const ResourceMonitor = lazy(() => import('./components/admin/ResourceMonitor'));
const SocialIntegration = lazy(() => import('./components/admin/SocialIntegration'));
const LiveStreamRoom = lazy(() => import('./components/live/LiveStreamRoom'));
const TermsOfService = lazy(() => import('./components/legal/TermsOfService'));
const PrivacyPolicy = lazy(() => import('./components/legal/PrivacyPolicy'));
const ReturnsPolicy = lazy(() => import('./components/legal/ReturnsPolicy'));

function Guard({
  allow,
  loading,
  redirectTo,
  children,
}: {
  allow: boolean;
  loading: boolean;
  redirectTo: string;
  children: ReactNode;
}) {
  const location = useLocation();
  // While auth state is resolving, render nothing rather than redirect.
  if (loading) return null;
  if (!allow) {
    return <Navigate to={`${redirectTo}?next=${encodeURIComponent(location.pathname)}`} replace />;
  }
  return <>{children}</>;
}

function AppRoutes() {
  const { loading, isAuthenticated, isAdmin } = useSession();

  return (
    <>
      <PageHeader />
      <main className="min-h-screen pb-24 md:pb-10">
        <Suspense
          fallback={
            <div className="flex min-h-[50dvh] items-center justify-center">
              <div className="w-7 h-7 border-2 border-purple-200 border-t-purple-500 rounded-full animate-spin" />
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<StoreFront />} />
            <Route path="/product/:productId" element={<ProductDetails />} />
            <Route path="/auctions" element={<AuctionList />} />
            <Route path="/live/:sessionId" element={<LiveStreamRoom />} />
            <Route path="/checkout" element={<Guard allow={isAuthenticated} loading={loading} redirectTo="/auth"><Checkout /></Guard>} />
            <Route path="/orders" element={<Guard allow={isAuthenticated} loading={loading} redirectTo="/auth"><Orders /></Guard>} />
            <Route path="/profile" element={<Guard allow={isAuthenticated} loading={loading} redirectTo="/auth"><ProfileHub /></Guard>} />
            <Route path="/collection" element={<Guard allow={isAuthenticated} loading={loading} redirectTo="/auth"><Collection /></Guard>} />
            <Route path="/profile/:uid" element={<PublicProfile />} />
            <Route path="/seller/onboarding" element={<Guard allow={isAuthenticated} loading={loading} redirectTo="/auth"><SellerOnboarding /></Guard>} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/payment/success" element={<Guard allow={isAuthenticated} loading={loading} redirectTo="/auth"><PaymentResult type="success" /></Guard>} />
            <Route path="/payment/cancel" element={<Guard allow={isAuthenticated} loading={loading} redirectTo="/auth"><PaymentResult type="cancel" /></Guard>} />
            <Route path="/admin" element={<Guard allow={isAdmin} loading={loading} redirectTo="/auth"><AdminDashboard /></Guard>} />
            <Route path="/admin/orders" element={<Guard allow={isAdmin} loading={loading} redirectTo="/auth"><OrderManager /></Guard>} />
            <Route path="/admin/inventory" element={<Guard allow={isAdmin} loading={loading} redirectTo="/auth"><Inventory /></Guard>} />
            <Route path="/admin/commerce" element={<Guard allow={isAdmin} loading={loading} redirectTo="/auth"><CommercePage /></Guard>} />
            <Route path="/admin/campaigns" element={<Guard allow={isAdmin} loading={loading} redirectTo="/auth"><Navigate to="/admin/growth" replace /></Guard>} />
            <Route path="/admin/growth" element={<Guard allow={isAdmin} loading={loading} redirectTo="/auth"><GrowthPage /></Guard>} />
            <Route path="/admin/live" element={<Guard allow={isAdmin} loading={loading} redirectTo="/auth"><LiveStreamManager /></Guard>} />
            <Route path="/admin/monitor" element={<Guard allow={isAdmin} loading={loading} redirectTo="/auth"><ResourceMonitor /></Guard>} />
            <Route path="/admin/social" element={<Guard allow={isAdmin} loading={loading} redirectTo="/auth"><SocialIntegration /></Guard>} />
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
