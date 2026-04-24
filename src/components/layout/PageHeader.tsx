import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Boxes, Gavel, LayoutDashboard, LogOut, ShoppingBag, Sparkles, User2 } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useMode } from '../../context/ModeContext';
import { useSession } from '../../hooks/useSession';
import { signOut } from '../../firebase';

const customerNav = [
  { label: 'Store', path: '/', icon: ShoppingBag },
  { label: 'Auctions', path: '/auctions', icon: Gavel },
  { label: 'Orders', path: '/orders', icon: Boxes },
  { label: 'Profile', path: '/profile', icon: User2 },
];

const adminNav = [
  { label: 'Dashboard', path: '/admin', icon: LayoutDashboard },
  { label: 'Inventory', path: '/admin/inventory', icon: Boxes },
  { label: 'Commerce', path: '/admin/commerce', icon: ShoppingBag },
  { label: 'Growth', path: '/admin/growth', icon: Sparkles },
];

export default function PageHeader() {
  const { items } = useCart();
  const { mode, setMode } = useMode();
  const { user, profile, isAdmin } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const adminView = isAdmin && mode === 'employee';
  const nav = adminView ? adminNav : customerNav;
  const cartCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[rgba(8,13,21,0.88)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
        <Link to={adminView ? '/admin' : '/'} className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top,#f6c971,#9fd3c7_55%,#10151e)] text-[#10151e] shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
            <span className="text-lg font-black">Q</span>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.35em] text-white/45">Quirkify</p>
            <p className="text-sm font-semibold text-white/90">
              {adminView ? 'Admin Operating System' : 'Social Commerce'}
            </p>
          </div>
        </Link>

        <nav className="ml-4 hidden items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1 md:flex">
          {nav.map((item) => {
            const active = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  active ? 'bg-[#f6c971] text-[#10151e]' : 'text-white/65 hover:bg-white/8 hover:text-white'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {!adminView && (
            <Link
              to="/checkout"
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/85"
            >
              Cart {cartCount > 0 ? `· ${cartCount}` : ''}
            </Link>
          )}
          {isAdmin && (
            <button
              onClick={() => {
                const nextMode = adminView ? 'customer' : 'employee';
                setMode(nextMode);
                navigate(nextMode === 'employee' ? '/admin' : '/');
              }}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/85"
            >
              {adminView ? 'Customer View' : 'Admin View'}
            </button>
          )}
          {user ? (
            <>
              <div className="hidden rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 md:block">
                {profile?.displayName || user.displayName || user.email}
              </div>
              <button
                onClick={() => void signOut().then(() => navigate('/'))}
                className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/5 text-white/80"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          ) : (
            <Link to="/auth" className="rounded-full bg-[#f6c971] px-4 py-2 text-sm font-bold text-[#10151e]">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
