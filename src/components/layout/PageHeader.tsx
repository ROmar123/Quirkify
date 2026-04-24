import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LogIn, Bell, ShoppingBag, ArrowRightLeft, Gavel,
  ClipboardList, User, LayoutDashboard, Boxes, Megaphone, X,
  Package, LogOut, ChevronDown
} from 'lucide-react';
import { auth, onAuthStateChanged, signOut, type AuthUser } from '../../firebase';
import { useCart } from '../../context/CartContext';
import { useMode } from '../../context/ModeContext';
import { subscribeToNotifications, markAsRead, Notification } from '../../services/notificationService';
import { cn } from '../../lib/utils';
import Logo from './Logo';
import { motion, AnimatePresence } from 'motion/react';

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
    </div>
  );
}

function UserMenu({ user }: { user: NonNullable<ReturnType<typeof auth.currentUser>> }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const menuItems = [
    { label: 'My Orders', icon: ClipboardList, path: '/orders' },
    { label: 'My Collection', icon: Package, path: '/collection' },
    { label: 'View Profile', icon: User, path: `/profile/${user.uid}` },
  ];

  return (
    <div className="relative ml-1">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 group"
        aria-label="User menu"
        aria-expanded={open}
      >
        <span
          className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm transition-opacity group-hover:opacity-90 flex-shrink-0"
          style={{ background: 'var(--gradient-primary)' }}
        >
          {(user.displayName?.[0] || user.email?.[0] || 'U').toUpperCase()}
        </span>
        <ChevronDown className={cn('w-3 h-3 text-gray-400 transition-transform duration-200 hidden sm:block', open && 'rotate-180')} />
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
              className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden"
            >
              {/* User info */}
              <div className="px-4 py-3 border-b border-gray-50">
                <p className="text-xs font-bold text-gray-800 truncate">
                  {user.displayName || 'My Account'}
                </p>
                <p className="text-[11px] text-gray-400 truncate mt-0.5">{user.email}</p>
              </div>

              {/* Nav links */}
              <div className="p-1.5">
                {menuItems.map(({ label, icon: Icon, path }) => (
                  <button
                    key={path}
                    onClick={() => { setOpen(false); navigate(path); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-gray-700 font-medium hover:bg-gray-50 transition-colors text-left"
                  >
                    <Icon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    {label}
                  </button>
                ))}
              </div>

              {/* Sign out */}
              <div className="p-1.5 border-t border-gray-50">
                <button
                  onClick={() => { setOpen(false); signOut(); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-red-600 font-medium hover:bg-red-50 transition-colors text-left"
                >
                  <LogOut className="w-4 h-4 flex-shrink-0" />
                  Sign Out
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function PageHeader() {
  const [user, setUser] = useState<AuthUser | null>(auth.currentUser);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

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
    if (path === '/') return effectivePath === '/';
    if (path === '/admin') return effectivePath === '/admin';
    return effectivePath === path || effectivePath.startsWith(`${path}/`);
  };

  return (
    <header
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
        <Link to={isEmployee ? '/admin' : '/'} className="flex-shrink-0">
          <Logo />
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden flex-1 items-center justify-center lg:flex" aria-label="Main navigation">
          <div className="flex items-center gap-1 rounded-2xl bg-gray-100/80 p-1">
            {navItems.map(({ label, path, icon: Icon }) => {
              const active = isActivePath(path);
              return (
                <Link
                  key={path}
                  to={path}
                  className={cn(
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
                </Link>
              );
            })}
          </div>
        </nav>

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
          {isAdmin && (
            <button
              onClick={() => {
                const next = isEmployee ? 'customer' : 'employee';
                setMode(next);
                navigate(next === 'employee' ? '/admin' : '/');
              }}
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
          {user ? (
            <UserMenu user={user} />
          ) : (
            <button
              onClick={() => navigate(`/auth?next=${encodeURIComponent(`${location.pathname}${location.search}`)}`)}
              className="btn-primary ml-1 px-4 py-2 text-xs"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
