import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogIn, Bell, ShoppingBag, Briefcase } from 'lucide-react';
import { auth, signIn, signOut } from '../../firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useCart } from '../../context/CartContext';
import { useMode } from '../../context/ModeContext';
import { subscribeToNotifications, markAsRead, Notification } from '../../services/notificationService';
import { cn } from '../../lib/utils';
import Logo from './Logo';

function BellDropdown({ user }: { user: User | null }) {
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
  const [user, setUser] = useState<User | null>(auth.currentUser);
  useEffect(() => onAuthStateChanged(auth, setUser), []);

  const { items } = useCart();
  const { isAdmin, mode, setMode } = useMode();
  const navigate = useNavigate();
  const cartCount = items.reduce((s, i) => s + i.quantity, 0);
  const isEmployee = mode === 'employee';

  return (
    <header
      className="sticky top-0 z-30 h-14 px-4 flex items-center justify-between border-b border-purple-50"
      style={{ background: 'rgba(253,244,255,0.95)', backdropFilter: 'blur(12px)' }}
    >
      <Link to={isEmployee ? '/admin' : '/'} className="flex-shrink-0">
        <Logo />
      </Link>

      <div className="flex items-center gap-1">
        <BellDropdown user={user} />

        {/* Cart — customer mode only */}
        {!isEmployee && (
          <Link to="/checkout" className="relative p-2 hover:bg-purple-50 rounded-full transition-colors">
            <ShoppingBag className="w-5 h-5 text-purple-500" />
            {cartCount > 0 && (
              <span
                className="absolute -top-1 -right-1 w-4 h-4 text-white text-[8px] font-bold flex items-center justify-center rounded-full"
                style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}
              >
                {cartCount}
              </span>
            )}
          </Link>
        )}

        {/* Mode toggle — icon only, admin only */}
        {isAdmin && (
          <button
            onClick={() => {
              const next = isEmployee ? 'customer' : 'employee';
              setMode(next);
              navigate(next === 'employee' ? '/admin' : '/');
            }}
            title={isEmployee ? 'Switch to Customer View' : 'Switch to Employee View'}
            className={cn(
              'p-2 rounded-full border transition-all',
              isEmployee
                ? 'bg-purple-600 text-white border-purple-600'
                : 'bg-white text-purple-500 border-purple-200 hover:border-purple-400'
            )}
          >
            {isEmployee ? <ShoppingBag className="w-4 h-4" /> : <Briefcase className="w-4 h-4" />}
          </button>
        )}

        {/* User avatar / sign in */}
        {user ? (
          <button
            onClick={() => signOut()}
            title={`Sign out (${user.email})`}
            className="w-8 h-8 rounded-full text-white text-xs font-black flex items-center justify-center shadow-md hover:opacity-80 transition-opacity"
            style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}
          >
            {user.email?.[0].toUpperCase()}
          </button>
        ) : (
          <button
            onClick={() => signIn()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full font-bold text-white text-sm hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}
          >
            <LogIn className="w-4 h-4" />
            <span className="hidden sm:inline">Sign In</span>
          </button>
        )}
      </div>
    </header>
  );
}
