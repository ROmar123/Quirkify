import { Link } from 'react-router-dom';
import Logo from './Logo';
<<<<<<< HEAD
=======
import { Heart } from 'lucide-react';
>>>>>>> origin/main

export default function Footer() {
  const year = new Date().getFullYear();

  return (
<<<<<<< HEAD
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
=======
    <footer className="border-t border-gray-100 bg-white pb-24 pt-12 md:pb-12">
      <div className="mx-auto max-w-7xl px-4">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4 mb-10">
          {/* Brand */}
          <div>
            <Logo />
            <p className="mt-3 text-sm text-gray-500 leading-relaxed max-w-[220px]">
              South Africa's home for AI-verified collectibles, limited drops, and pre-loved finds.
            </p>
          </div>

          {/* Shop */}
          <div>
            <p className="section-label mb-4">Shop</p>
            <ul className="space-y-2.5">
              {[
                { label: 'All Products', to: '/' },
                { label: 'Live Auctions', to: '/auctions' },
>>>>>>> origin/main
                { label: 'My Orders', to: '/orders' },
                { label: 'My Collection', to: '/collection' },
              ].map(({ label, to }) => (
                <li key={to}>
<<<<<<< HEAD
                  <Link to={to} className="text-sm font-semibold text-purple-500 hover:text-purple-700 transition-colors">
=======
                  <Link
                    to={to}
                    className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
                  >
>>>>>>> origin/main
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

<<<<<<< HEAD
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-purple-300 mb-4">Support</p>
            <ul className="space-y-2">
              {[
                { label: 'Returns & Refunds', to: '/returns' },
                { label: 'Shipping Info', to: '/returns' },
              ].map(({ label, to }) => (
                <li key={label}>
                  <Link to={to} className="text-sm font-semibold text-purple-500 hover:text-purple-700 transition-colors">
=======
          {/* Support */}
          <div>
            <p className="section-label mb-4">Support</p>
            <ul className="space-y-2.5">
              {[
                { label: 'Returns & Refunds', to: '/returns' },
                { label: 'Shipping Info', to: '/returns' },
                { label: 'Contact Us', to: '/terms' },
              ].map(({ label, to }) => (
                <li key={label}>
                  <Link
                    to={to}
                    className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
                  >
>>>>>>> origin/main
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

<<<<<<< HEAD
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-purple-300 mb-4">Legal</p>
            <ul className="space-y-2">
=======
          {/* Legal */}
          <div>
            <p className="section-label mb-4">Legal</p>
            <ul className="space-y-2.5">
>>>>>>> origin/main
              {[
                { label: 'Terms of Service', to: '/terms' },
                { label: 'Privacy Policy', to: '/privacy' },
                { label: 'Returns Policy', to: '/returns' },
              ].map(({ label, to }) => (
                <li key={to}>
<<<<<<< HEAD
                  <Link to={to} className="text-sm font-semibold text-purple-500 hover:text-purple-700 transition-colors">
=======
                  <Link
                    to={to}
                    className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
                  >
>>>>>>> origin/main
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

<<<<<<< HEAD
        <div className="mt-8 border-t border-purple-50 pt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-semibold text-purple-300">
            &copy; {year} Quirkify. All rights reserved. Registered in South Africa.
          </p>
          <p className="text-xs font-semibold text-purple-300">
            Payments powered by <span className="font-black text-purple-400">Yoco</span> &middot; Delivery by <span className="font-black text-purple-400">The Courier Guy</span>
          </p>
=======
        <div className="border-t border-gray-100 pt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-gray-400">
            &copy; {year} Quirkify (Pty) Ltd. All rights reserved.
          </p>
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
            <span>Registered in South Africa</span>
            <span className="hidden sm:inline">·</span>
            <span>
              Payments by <span className="font-semibold text-gray-600">Yoco</span>
            </span>
            <span>·</span>
            <span>
              Delivery by <span className="font-semibold text-gray-600">The Courier Guy</span>
            </span>
            <span>·</span>
            <span className="flex items-center gap-1">
              Made with <Heart className="w-3 h-3 text-pink-400 fill-current" /> in SA
            </span>
          </div>
>>>>>>> origin/main
        </div>
      </div>
    </footer>
  );
}
