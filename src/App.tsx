import { Routes, Route, Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, signIn, signOut, getRedirectResult } from './firebase';
import {
  LayoutDashboard, ShoppingBag, PlusCircle, CheckCircle, TrendingUp,
  LogIn, LogOut, Menu, X, Gavel, Sparkles, ClipboardList, User as UserIcon,
  ChevronDown, Briefcase, Megaphone, Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';

import Logo from './components/layout/Logo';
import StoreFront from './components/store/StoreFront';
import AdminDashboard from './components/admin/AdminDashboard';
import ProductIntake from './components/admin/ProductIntake';
import ReviewQueue from './components/admin/ReviewQueue';
import CampaignManager from './components/admin/CampaignManager';
import SocialIntegration from './components/admin/SocialIntegration';
import ListingManager from './components/admin/ListingManager';
import OrderManager from './components/admin/OrderManager';
import PackManager from './components/admin/PackManager';
import LiveStreamManager from './components/admin/LiveStreamManager';
import ResourceMonitor from './components/admin/ResourceMonitor';
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
import { ModeProvider, useMode } from './context/ModeContext';

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

function ModeToggle() {
  const { mode, setMode } = useMode();
  const isEmployee = mode === 'employee';

  return (
    <button
      onClick={() => setMode(isEmployee ? 'customer' : 'employee')}
      title={isEmployee ? 'Switch to Customer View' : 'Switch to Employee View'}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all border',
        isEmployee
          ? 'bg-purple-600 text-white border-purple-600'
          : 'bg-white text-purple-500 border-purple-200 hover:border-purple-400'
      )}
    >
      {isEmployee ? <ShoppingBag className="w-3.5 h-3.5" /> : <Briefcase className="w-3.5 h-3.5" />}
      <span className="hidden sm:inline">{isEmployee ? 'Customer' : 'Employee'}</span>
    </button>
  );
}

function NavDropdown({ label, items }: {
  label: string;
  items: { to: string; label: string; icon: React.ElementType }[];
}) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const isActive = items.some(item => location.pathname === item.to || location.pathname + location.search === item.to);

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        className={cn(
          'px-4 py-2 rounded-full text-sm font-bold flex items-center gap-1 transition-all',
          isActive
            ? 'text-white shadow-md'
            : 'text-purple-400 hover:text-purple-600 hover:bg-purple-50'
        )}
        style={isActive ? { background: 'linear-gradient(135deg, #F472B6, #A855F7)' } : {}}
      >
        {label}
        <ChevronDown className={cn('w-3 h-3 transition-transform', open && 'rotate-180')} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 mt-2 bg-white rounded-2xl shadow-xl border border-purple-100 p-2 min-w-[200px] z-50"
          >
            {items.map(item => {
              const Icon = item.icon;
              const active = location.pathname === item.to || location.pathname + location.search === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    'flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors',
                    active ? 'bg-purple-50 text-purple-700' : 'text-purple-600 hover:bg-purple-50'
                  )}
                >
                  <Icon className="w-4 h-4 text-purple-400" />
                  {item.label}
                </Link>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

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
          <Route path="/admin/intake" element={isAdmin ? <ProductIntake /> : <Navigate to="/" />} />
          <Route path="/admin/reviews" element={isAdmin ? <ReviewQueue /> : <Navigate to="/" />} />
          <Route path="/admin/campaigns" element={isAdmin ? <CampaignManager /> : <Navigate to="/" />} />
          <Route path="/admin/auctions" element={isAdmin ? <AuctionManager /> : <Navigate to="/" />} />
          <Route path="/admin/social" element={isAdmin ? <SocialIntegration /> : <Navigate to="/" />} />
          <Route path="/admin/listings" element={isAdmin ? <ListingManager /> : <Navigate to="/" />} />
          <Route path="/admin/orders" element={isAdmin ? <OrderManager /> : <Navigate to="/" />} />
          <Route path="/admin/packs" element={isAdmin ? <PackManager /> : <Navigate to="/" />} />
          <Route path="/admin/streams" element={isAdmin ? <LiveStreamManager /> : <Navigate to="/" />} />
          <Route path="/admin/resources" element={isAdmin ? <ResourceMonitor /> : <Navigate to="/" />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

function AppInner() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { mode, isAdmin, setIsAdmin } = useMode();

  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 8000);
    let prevUser: User | null = null;

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      clearTimeout(timeout);
      const justSignedIn = !prevUser && !!u;
      prevUser = u;
      setUser(u);
      const admin = u?.email === 'patengel85@gmail.com';
      setIsAdmin(admin);
      setLoading(false);
      // Navigate to the right landing page on fresh sign-in
      if (justSignedIn) {
        navigate(admin ? '/admin' : '/');
      }
    });

    return () => { clearTimeout(timeout); unsubscribe(); };
  }, []);

  // Desktop nav items
  const customerNav = [
    { type: 'link' as const, to: '/', label: 'Store', icon: ShoppingBag },
    { type: 'link' as const, to: '/auctions', label: 'Auctions', icon: Gavel },
    { type: 'link' as const, to: '/orders', label: 'Orders', icon: ClipboardList },
    { type: 'link' as const, to: '/collection', label: 'Account', icon: UserIcon },
  ];

  const employeeNav = [
    { type: 'link' as const, to: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    {
      type: 'dropdown' as const,
      label: 'Product Management',
      items: [
        { to: '/admin/intake', label: 'Intake', icon: PlusCircle },
        { to: '/admin/reviews', label: 'Review Queue', icon: CheckCircle },
        { to: '/admin/listings', label: 'Listings', icon: ShoppingBag },
      ],
    },
    {
      type: 'dropdown' as const,
      label: 'E-Commerce',
      items: [
        { to: '/admin/orders', label: 'Orders', icon: ClipboardList },
        { to: '/admin/auctions', label: 'Auctions', icon: Gavel },
        { to: '/admin/packs', label: 'Mystery Packs', icon: Sparkles },
      ],
    },
    {
      type: 'dropdown' as const,
      label: 'Marketing',
      items: [
        { to: '/admin/campaigns', label: 'Campaigns', icon: Megaphone },
        { to: '/admin/social', label: 'Social', icon: Zap },
        { to: '/admin/streams', label: 'Live Streams', icon: TrendingUp },
      ],
    },
  ];

  const activeNav = (isAdmin && mode === 'employee') ? employeeNav : customerNav;

  // Mobile menu flat links
  // Hamburger shows secondary links only — bottom nav already covers the main tabs
  const customerSecondary = [
    { to: '/?filter=sale', label: 'Sale Items', icon: Sparkles },
    { to: '/?filter=new', label: 'New Arrivals', icon: Zap },
    { to: '/?filter=packs', label: 'Mystery Packs', icon: ShoppingBag },
    { to: '/seller/onboarding', label: 'Become a Seller', icon: TrendingUp },
  ];
  const employeeSecondary = [
    { to: '/admin/intake', label: 'Intake', icon: PlusCircle },
    { to: '/admin/reviews', label: 'Review Queue', icon: CheckCircle },
    { to: '/admin/listings', label: 'Listings', icon: ShoppingBag },
    { to: '/admin/orders', label: 'Orders', icon: ClipboardList },
    { to: '/admin/auctions', label: 'Auctions', icon: Gavel },
    { to: '/admin/campaigns', label: 'Campaigns', icon: Megaphone },
    { to: '/admin/social', label: 'Social', icon: Zap },
  ];
  const mobileLinks = (isAdmin && mode === 'employee') ? employeeSecondary : customerSecondary;

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
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md shadow-sm border-b border-purple-100">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <Link to="/" className="flex items-center">
            <Logo />
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {activeNav.map((item, i) =>
              item.type === 'link' ? (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    'px-4 py-2 rounded-full text-sm font-bold transition-all',
                    location.pathname === item.to
                      ? 'text-white shadow-md'
                      : 'text-purple-400 hover:text-purple-600 hover:bg-purple-50'
                  )}
                  style={location.pathname === item.to ? { background: 'linear-gradient(135deg, #F472B6, #A855F7)' } : {}}
                >
                  {item.label}
                </Link>
              ) : (
                <NavDropdown key={i} label={item.label} items={item.items} />
              )
            )}
          </div>

          <div className="flex items-center gap-2">
            <CartButton />
            {isAdmin && <ModeToggle />}
            {user ? (
              <button
                onClick={signOut}
                title={`Sign out (${user.email})`}
                className="w-8 h-8 rounded-full text-white text-xs font-black flex items-center justify-center shadow-md hover:opacity-80 transition-opacity flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}
              >
                {user.email?.[0].toUpperCase()}
              </button>
            ) : (
              <button
                onClick={signIn}
                className="flex items-center justify-center gap-1.5 rounded-full font-bold text-white text-sm transition-all hover:opacity-90 flex-shrink-0 w-8 h-8 md:w-auto md:h-auto md:px-5 md:py-2"
                style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}
              >
                <LogIn className="w-4 h-4" />
                <span className="hidden md:inline">Sign In</span>
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
                {mobileLinks.map(link => {
                  const Icon = link.icon;
                  return (
                    <Link
                      key={link.to}
                      to={link.to}
                      onClick={() => setIsMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-purple-50 text-sm font-bold text-purple-600 transition-colors"
                    >
                      <Icon className="w-4 h-4" />
                      {link.label}
                    </Link>
                  );
                })}
                <div className="border-t border-purple-100 mt-2 pt-2">
                  {user ? (
                    <button
                      onClick={() => { signOut(); setIsMenuOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-red-50 text-sm font-bold text-red-400 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  ) : (
                    <button
                      onClick={() => { signIn(); setIsMenuOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold text-white transition-colors"
                      style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}
                    >
                      <LogIn className="w-4 h-4" />
                      Sign In with Google
                    </button>
                  )}
                </div>
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
