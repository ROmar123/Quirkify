import { Link, useLocation } from 'react-router-dom';
import { ShoppingBag, Gavel, ClipboardList, User } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function MobileNav() {
  const location = useLocation();

  const navItems = [
    { label: 'Sales', path: '/?filter=sale', icon: ShoppingBag },
    { label: 'Auctions', path: '/auctions', icon: Gavel },
    { label: 'Orders', path: '/orders', icon: ClipboardList },
    { label: 'Account', path: '/collection', icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-zinc-100 px-6 py-2 pb-8 flex items-center justify-between z-50 md:hidden">
      {navItems.map((item) => {
        const isActive = location.pathname + location.search === item.path;
        return (
          <Link
            key={item.label}
            to={item.path}
            className={cn(
              "flex flex-col items-center gap-1 transition-colors",
              isActive ? "text-quirky" : "text-zinc-400 hover:text-black"
            )}
          >
            <item.icon className="w-5 h-5" />
            <span className="text-[8px] font-bold uppercase tracking-widest">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
