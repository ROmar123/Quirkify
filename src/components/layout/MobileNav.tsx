import { Link, useLocation } from 'react-router-dom';
import { Boxes, Gavel, LayoutDashboard, ShoppingBag, Sparkles, User2 } from 'lucide-react';
import { useMode } from '../../context/ModeContext';
import { useSession } from '../../hooks/useSession';

const customerNav = [
  { label: 'Store', path: '/', icon: ShoppingBag },
  { label: 'Auctions', path: '/auctions', icon: Gavel },
  { label: 'Orders', path: '/orders', icon: Boxes },
  { label: 'Profile', path: '/profile', icon: User2 },
];

const adminNav = [
  { label: 'Dash', path: '/admin', icon: LayoutDashboard },
  { label: 'Stock', path: '/admin/inventory', icon: Boxes },
  { label: 'Ops', path: '/admin/commerce', icon: ShoppingBag },
  { label: 'Growth', path: '/admin/growth', icon: Sparkles },
];

export default function MobileNav() {
  const location = useLocation();
  const { mode } = useMode();
  const { isAdmin } = useSession();
  const nav = isAdmin && mode === 'employee' ? adminNav : customerNav;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[rgba(8,13,21,0.92)] px-2 py-2 backdrop-blur-xl md:hidden">
      <div className="grid grid-cols-4 gap-1">
        {nav.map((item) => {
          const active = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-semibold ${
                active ? 'bg-[#f6c971] text-[#10151e]' : 'text-white/60'
              }`}
            >
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
