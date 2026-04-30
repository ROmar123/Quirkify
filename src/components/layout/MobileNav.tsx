import { Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { ShoppingBag, Gavel, ClipboardList, User, LayoutDashboard, Megaphone } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useMode } from '../../context/ModeContext';
import { auth, onAuthStateChanged, type AuthUser } from '../../firebase';
import { motion } from 'motion/react';

export default function MobileNav() {
  const location = useLocation();
  const { mode, isAdmin } = useMode();
  const [user, setUser] = useState<AuthUser | null>(auth.currentUser);
  const nextParam = new URLSearchParams(location.search).get('next');
  const effectivePath =
    location.pathname === '/auth' && nextParam?.startsWith('/')
      ? nextParam
      : location.pathname;

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  const isActivePath = (itemPath: string) => {
    if (itemPath === '/') return effectivePath === '/';
    return effectivePath === itemPath || effectivePath.startsWith(`${itemPath}/`);
  };

  const customerItems = [
    { label: 'Store', path: '/', icon: ShoppingBag },
    { label: 'Auctions', path: '/auctions', icon: Gavel },
    { label: 'Orders', path: '/orders', icon: ClipboardList },
    { label: 'Account', path: '/collection', icon: User },
  ];

  const employeeItems = [
    { label: 'Dashboard', path: '/admin', icon: LayoutDashboard },
    { label: 'Inventory', path: '/admin/inventory', icon: ShoppingBag },
    { label: 'Commerce', path: '/admin/orders', icon: ClipboardList },
    { label: 'Growth', path: '/admin/campaigns', icon: Megaphone },
  ];

  const navItems = isAdmin && mode === 'employee' ? employeeItems : customerItems;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden glass border-t border-gray-100"
      style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
    >
      <div className="flex items-center justify-around px-2 py-2">
        {navItems.map((item) => {
          const isActive = isActivePath(item.path);
          return (
            <Link
              key={item.label}
              to={item.path}
              className="relative flex flex-col items-center gap-1 min-w-[56px] py-1"
            >
              <div className="relative">
                {isActive && (
                  <motion.div
                    layoutId="mobile-nav-bg"
                    className="absolute inset-0 rounded-xl"
                    style={{ background: 'linear-gradient(135deg,#f472b6,#a855f7)', inset: '-6px -10px' }}
                    transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                  />
                )}
                <item.icon
                  className={cn(
                    'relative z-10 w-5 h-5 transition-all duration-200',
                    isActive ? 'text-white' : 'text-gray-400'
                  )}
                />
              </div>
              <span className={cn(
                'text-[9px] font-semibold uppercase tracking-wide transition-colors',
                isActive ? 'text-purple-600' : 'text-gray-400'
              )}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
