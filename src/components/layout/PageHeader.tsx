import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
<<<<<<< HEAD
import { LogIn, Bell, ShoppingBag, ArrowRightLeft, Gavel, ClipboardList, User, LayoutDashboard, Boxes, Megaphone } from 'lucide-react';
=======
import {
  LogIn, Bell, ShoppingBag, ArrowRightLeft, Gavel,
  ClipboardList, User, LayoutDashboard, Boxes, Megaphone, X
} from 'lucide-react';
>>>>>>> origin/main
import { auth, onAuthStateChanged, signOut, type AuthUser } from '../../firebase';
import { useCart } from '../../context/CartContext';
import { useMode } from '../../context/ModeContext';
import { subscribeToNotifications, markAsRead, Notification } from '../../services/notificationService';
import { cn } from '../../lib/utils';
import Logo from './Logo';
<<<<<<< HEAD
=======
import { motion, AnimatePresence } from 'motion/react';
>>>>>>> origin/main

function BellDropdown({ user }: { user: AuthUser | null }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    return subscribeToNotifications(user.uid, setNotifications);
  }, [user]);

  const unread = notifications.filter(n => !n.read).length;
  if (!user) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
<<<<<<< HEAD
        className="relative p-2 hover:bg-purple-50 rounded-full transition-colors"
      >
        <Bell className="w-5 h-5 text-purple-500" />
        {unread > 0 && (
          <span
            className="absolute -top-1 -right-1 w-4 h-4 text-white text-[8px] font-bold flex items-center justify-center rounded-full"
            style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}
          >
            {unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-3xl shadow-2xl border border-purple-100 z-50 overflow-hidden">
            <div className="px-4 py-3 border-b border-purple-50 flex items-center justify-between">
              <span className="text-sm font-black text-purple-900">Alerts</span>
              {unread > 0 && (
                <button
                  onClick={() => notifications.filter(n => !n.read).forEach(n => markAsRead(n.id))}
                  className="text-xs font-bold text-purple-400 hover:text-purple-600"
                >
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-64 overflow-y-auto">
              {notifications.length === 0
                ? <p className="text-xs text-purple-300 font-semibold text-center py-8">No alerts yet</p>
                : notifications.map(n => (
                  <div
                    key={n.id}
                    onClick={() => markAsRead(n.id)}
                    className={cn('px-4 py-3 border-b border-purple-50 cursor-pointer hover:bg-purple-50 transition-colors', !n.read && 'bg-purple-50/60')}
                  >
                    {!n.read && <div className="w-1.5 h-1.5 rounded-full mb-1" style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }} />}
                    <p className="text-xs font-bold text-purple-900">{n.title}</p>
                    <p className="text-[10px] text-purple-400 font-semibold mt-0.5">{n.message}</p>
                  </div>
                ))}
            </div>
          </div>
        </>
      )}
=======
        className="relative flex h-9 w-9 items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-all duration-150"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4" />
        <AnimatePresence>
          {unread > 0 && (
            <motion.span
              key="badge"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full text-[9px] font-bold text-white px-1"
              style={{ background: 'var(--gradient-primary)' }}
            >
              {unread > 9 ? '9+' : unread}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.97 }}
              transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
              className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-800">Notifications</span>
                <div className="flex items-center gap-2">
                  {unread > 0 && (
                    <button
                      onClick={() => notifications.filter(n => !n.read).forEach(n => markAsRead(n.id))}
                      className="text-xs font-medium text-purple-600 hover:text-purple-700 transition-colors"
                    >
                      Mark all read
                    </button>
                  )}
                  <button
                    onClick={() => setOpen(false)}
                    className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <X className="w-3.5 h-3.5 text-gray-400" />
                  </button>
                </div>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="py-10 text-center">
                    <Bell className="w-7 h-7 mx-auto mb-2 text-gray-200" />
                    <p className="text-sm font-medium text-gray-400">No notifications yet</p>
                  </div>
                ) : notifications.map(n => (
                  <button
                    key={n.id}
                    onClick={() => markAsRead(n.id)}
                    className={cn(
                      'w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors',
                      !n.read && 'bg-purple-50/40'
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      {!n.read && (
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-purple-500 flex-shrink-0" />
                      )}
                      <div className={!n.read ? '' : 'ml-4'}>
                        <p className="text-sm font-semibold text-gray-800">{n.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
>>>>>>> origin/main
    </div>
  );
}

export default function PageHeader() {
  const [user, setUser] = useState<AuthUser | null>(auth.currentUser);
<<<<<<< HEAD
  useEffect(() => onAuthStateChanged(auth, setUser), []);
=======
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
>>>>>>> origin/main

  const { items } = useCart();
  const { isAdmin, mode, setMode } = useMode();
  const navigate = useNavigate();
  const location = useLocation();
  const cartCount = items.reduce((s, i) => s + i.quantity, 0);
  const isEmployee = mode === 'employee';
  const nextParam = new URLSearchParams(location.search).get('next');
  const effectivePath =
    location.pathname === '/auth' && nextParam?.startsWith('/')
      ? nextParam
      : location.pathname;

  const customerItems = [
    { label: 'Store', path: '/', icon: ShoppingBag },
    { label: 'Auctions', path: '/auctions', icon: Gavel },
    { label: 'Orders', path: '/orders', icon: ClipboardList },
    { label: 'Collection', path: '/collection', icon: User },
  ];

  const employeeItems = [
    { label: 'Dashboard', path: '/admin', icon: LayoutDashboard },
    { label: 'Inventory', path: '/admin/inventory', icon: Boxes },
    { label: 'Commerce', path: '/admin/orders', icon: ClipboardList },
    { label: 'Growth', path: '/admin/campaigns', icon: Megaphone },
  ];

  const navItems = isEmployee ? employeeItems : customerItems;

  const isActivePath = (path: string) => {
<<<<<<< HEAD
    if (path === '/') {
      return effectivePath === '/';
    }
    if (path === '/admin') {
      return effectivePath === '/admin';
    }
=======
    if (path === '/') return effectivePath === '/';
    if (path === '/admin') return effectivePath === '/admin';
>>>>>>> origin/main
    return effectivePath === path || effectivePath.startsWith(`${path}/`);
  };

  return (
    <header
<<<<<<< HEAD
      className="sticky top-0 z-30 border-b border-purple-50"
      style={{ background: 'rgba(253,244,255,0.95)', backdropFilter: 'blur(12px)' }}
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
=======
      className={cn(
        'sticky top-0 z-30 transition-all duration-300',
        scrolled
          ? 'border-b border-gray-100 shadow-sm'
          : 'border-b border-transparent'
      )}
      style={{
        background: scrolled
          ? 'rgba(255,255,255,0.92)'
          : 'rgba(250,250,250,0.85)',
        backdropFilter: 'blur(20px) saturate(160%)',
        WebkitBackdropFilter: 'blur(20px) saturate(160%)',
      }}
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
        {/* Logo */}
>>>>>>> origin/main
        <Link to={isEmployee ? '/admin' : '/'} className="flex-shrink-0">
          <Logo />
        </Link>

<<<<<<< HEAD
        <nav className="hidden flex-1 items-center justify-center lg:flex">
          <div className="flex items-center gap-1 rounded-full border border-purple-100 bg-white/80 p-1 shadow-sm shadow-purple-100/70">
=======
        {/* Desktop Nav */}
        <nav className="hidden flex-1 items-center justify-center lg:flex" aria-label="Main navigation">
          <div className="flex items-center gap-1 rounded-2xl bg-gray-100/80 p-1">
>>>>>>> origin/main
            {navItems.map(({ label, path, icon: Icon }) => {
              const active = isActivePath(path);
              return (
                <Link
                  key={path}
                  to={path}
                  className={cn(
<<<<<<< HEAD
                    'flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-all',
                    active
                      ? 'bg-purple-600 text-white shadow-md shadow-purple-200'
                      : 'text-purple-400 hover:bg-purple-50 hover:text-purple-700'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
=======
                    'relative flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200',
                    active
                      ? 'text-white shadow-sm'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-white/70'
                  )}
                >
                  {active && (
                    <motion.div
                      layoutId="nav-pill"
                      className="absolute inset-0 rounded-xl"
                      style={{ background: 'var(--gradient-primary)' }}
                      transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                    />
                  )}
                  <Icon className="relative z-10 h-4 w-4" />
                  <span className="relative z-10">{label}</span>
>>>>>>> origin/main
                </Link>
              );
            })}
          </div>
        </nav>

<<<<<<< HEAD
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <BellDropdown user={user} />

          {!isEmployee && (
            <Link to="/checkout" className="relative rounded-full p-2 transition-colors hover:bg-purple-50">
              <ShoppingBag className="h-5 w-5 text-purple-500" />
              {cartCount > 0 && (
                <span
                  className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}
                >
                  {cartCount}
                </span>
              )}
            </Link>
          )}

=======
        {/* Right actions */}
        <div className="ml-auto flex items-center gap-1">
          <BellDropdown user={user} />

          {/* Cart */}
          {!isEmployee && (
            <Link
              to="/checkout"
              className="relative flex h-9 w-9 items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-all duration-150"
              aria-label={`Cart (${cartCount} items)`}
            >
              <ShoppingBag className="h-4 w-4" />
              <AnimatePresence>
                {cartCount > 0 && (
                  <motion.span
                    key="cart-badge"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full text-[9px] font-bold text-white px-1"
                    style={{ background: 'var(--gradient-primary)' }}
                  >
                    {cartCount > 9 ? '9+' : cartCount}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          )}

          {/* Admin toggle */}
>>>>>>> origin/main
          {isAdmin && (
            <button
              onClick={() => {
                const next = isEmployee ? 'customer' : 'employee';
                setMode(next);
                navigate(next === 'employee' ? '/admin' : '/');
              }}
<<<<<<< HEAD
              title={isEmployee ? 'Switch to Customer View' : 'Switch to Employee View'}
              className={cn(
                'flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-black uppercase tracking-[0.18em] transition-all',
                isEmployee
                  ? 'border-purple-600 bg-purple-600 text-white'
                  : 'border-purple-200 bg-white text-purple-600 hover:border-purple-400'
              )}
            >
              <ArrowRightLeft className="h-4 w-4" />
              <span className="hidden xl:inline">{isEmployee ? 'Store View' : 'Admin View'}</span>
            </button>
          )}

=======
              title={isEmployee ? 'Switch to Store View' : 'Switch to Admin View'}
              className={cn(
                'flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-all duration-200',
                isEmployee
                  ? 'border-purple-600 bg-purple-600 text-white'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-purple-300 hover:text-purple-600'
              )}
            >
              <ArrowRightLeft className="h-3.5 w-3.5" />
              <span className="hidden xl:inline">
                {isEmployee ? 'Store View' : 'Admin'}
              </span>
            </button>
          )}

          {/* User */}
>>>>>>> origin/main
          {user ? (
            <button
              onClick={() => signOut()}
              title={`Sign out (${user.email})`}
<<<<<<< HEAD
              className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-black text-white shadow-md transition-opacity hover:opacity-80"
              style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}
            >
              {user.email?.[0].toUpperCase()}
=======
              className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm hover:opacity-90 transition-opacity ml-1 flex-shrink-0"
              style={{ background: 'var(--gradient-primary)' }}
            >
              {(user.displayName?.[0] || user.email?.[0] || 'U').toUpperCase()}
>>>>>>> origin/main
            </button>
          ) : (
            <button
              onClick={() => navigate(`/auth?next=${encodeURIComponent(`${location.pathname}${location.search}`)}`)}
<<<<<<< HEAD
              className="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold text-white hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}
            >
              <LogIn className="h-4 w-4" />
=======
              className="btn-primary ml-1 px-4 py-2 text-xs"
            >
              <LogIn className="h-3.5 w-3.5" />
>>>>>>> origin/main
              <span className="hidden sm:inline">Sign In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
