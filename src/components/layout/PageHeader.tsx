import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LogIn, Bell, ShoppingBag, ArrowRightLeft, Gavel, ClipboardList, User, LayoutDashboard, Boxes, Megaphone } from 'lucide-react';
import { auth, onAuthStateChanged, signOut, type AuthUser } from '../../firebase';
import { useCart } from '../../context/CartContext';
import { useMode } from '../../context/ModeContext';
import { subscribeToNotifications, markAsRead, Notification } from '../../services/notificationService';
import { cn } from '../../lib/utils';
import Logo from './Logo';

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
    </div>
  );
}

export default function PageHeader() {
  const [user, setUser] = useState<AuthUser | null>(auth.currentUser);
  useEffect(() => onAuthStateChanged(auth, setUser), []);

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
    if (path === '/') {
      return effectivePath === '/';
    }
    if (path === '/admin') {
      return effectivePath === '/admin';
    }
    return effectivePath === path || effectivePath.startsWith(`${path}/`);
  };

  return (
    <header
      className="sticky top-0 z-30 border-b border-purple-50"
      style={{ background: 'rgba(253,244,255,0.95)', backdropFilter: 'blur(12px)' }}
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
        <Link to={isEmployee ? '/admin' : '/'} className="flex-shrink-0">
          <Logo />
        </Link>

        <nav className="hidden flex-1 items-center justify-center lg:flex">
          <div className="flex items-center gap-1 rounded-full border border-purple-100 bg-white/80 p-1 shadow-sm shadow-purple-100/70">
            {navItems.map(({ label, path, icon: Icon }) => {
              const active = isActivePath(path);
              return (
                <Link
                  key={path}
                  to={path}
                  className={cn(
                    'flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-all',
                    active
                      ? 'bg-purple-600 text-white shadow-md shadow-purple-200'
                      : 'text-purple-400 hover:bg-purple-50 hover:text-purple-700'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

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

          {isAdmin && (
            <button
              onClick={() => {
                const next = isEmployee ? 'customer' : 'employee';
                setMode(next);
                navigate(next === 'employee' ? '/admin' : '/');
              }}
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

          {user ? (
            <button
              onClick={() => signOut()}
              title={`Sign out (${user.email})`}
              className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-black text-white shadow-md transition-opacity hover:opacity-80"
              style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}
            >
              {user.email?.[0].toUpperCase()}
            </button>
          ) : (
            <button
              onClick={() => navigate(`/auth?next=${encodeURIComponent(`${location.pathname}${location.search}`)}`)}
              className="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold text-white hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}
            >
              <LogIn className="h-4 w-4" />
              <span className="hidden sm:inline">Sign In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
