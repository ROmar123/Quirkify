import { Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { ShoppingBag, Gavel, ClipboardList, User, LayoutDashboard, Megaphone } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useMode } from '../../context/ModeContext';
import { auth, onAuthStateChanged } from '../../firebase';

export default function MobileNav() {
  const location = useLocation();
  const { mode, isAdmin } = useMode();
  const [user, setUser] = useState(auth.currentUser);
  const nextParam = new URLSearchParams(location.search).get('next');
  const effectivePath =
    location.pathname === '/auth' && nextParam?.startsWith('/')
      ? nextParam
      : location.pathname;

  useEffect(() => onAuthStateChanged(auth, setUser), []);

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
  const isInInventory = location.pathname.includes('/admin/inventory');

  if (isInInventory) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-purple-100 px-6 py-2 pb-8 flex items-center justify-between z-50 md:hidden">
      {navItems.map((item) => {
        const isActive = effectivePath === item.path || (item.path !== '/admin' && effectivePath.startsWith(item.path));

        return (
          <Link
            key={item.label}
            to={item.path}
            className={cn(
              'flex flex-col items-center gap-1 transition-colors',
              isActive ? 'text-purple-500' : 'text-purple-300 hover:text-purple-400'
            )}
          >
            <div className={cn('p-1.5 rounded-xl transition-all', isActive && 'bg-purple-50')}>
              <item.icon className="w-5 h-5" />
            </div>
            <span className="text-[8px] font-bold uppercase tracking-widest">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
