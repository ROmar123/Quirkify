import { Link } from 'react-router-dom';
import Logo from './Logo';

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-purple-100 bg-white/80 pb-24 pt-10 md:pb-10">
      <div className="mx-auto max-w-7xl px-4">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Logo />
            <p className="mt-3 text-xs font-semibold leading-6 text-purple-400 max-w-[200px]">
              South Africa's home for verified collectibles, limited drops, and pre-loved finds.
            </p>
          </div>

          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-purple-300 mb-4">Shop</p>
            <ul className="space-y-2">
              {[
                { label: 'All Products', to: '/' },
                { label: 'Auctions', to: '/auctions' },
                { label: 'My Orders', to: '/orders' },
                { label: 'My Collection', to: '/collection' },
              ].map(({ label, to }) => (
                <li key={to}>
                  <Link to={to} className="text-sm font-semibold text-purple-500 hover:text-purple-700 transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-purple-300 mb-4">Support</p>
            <ul className="space-y-2">
              {[
                { label: 'Returns & Refunds', to: '/returns' },
                { label: 'Shipping Info', to: '/returns' },
              ].map(({ label, to }) => (
                <li key={label}>
                  <Link to={to} className="text-sm font-semibold text-purple-500 hover:text-purple-700 transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-purple-300 mb-4">Legal</p>
            <ul className="space-y-2">
              {[
                { label: 'Terms of Service', to: '/terms' },
                { label: 'Privacy Policy', to: '/privacy' },
                { label: 'Returns Policy', to: '/returns' },
              ].map(({ label, to }) => (
                <li key={to}>
                  <Link to={to} className="text-sm font-semibold text-purple-500 hover:text-purple-700 transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-purple-50 pt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-semibold text-purple-300">
            &copy; {year} Quirkify. All rights reserved. Registered in South Africa.
          </p>
          <p className="text-xs font-semibold text-purple-300">
            Payments powered by <span className="font-black text-purple-400">Yoco</span> &middot; Delivery by <span className="font-black text-purple-400">The Courier Guy</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
