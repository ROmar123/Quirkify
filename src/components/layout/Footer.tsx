import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Twitter, Instagram, CheckCircle2, Mail } from 'lucide-react';
import Logo from './Logo';

export default function Footer() {
  const year = new Date().getFullYear();
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || subscribed) return;
    setSubscribing(true);
    // Simulate subscription — hook into real email service when ready
    await new Promise(r => setTimeout(r, 800));
    setSubscribed(true);
    setSubscribing(false);
    setEmail('');
  };

  return (
    <footer className="border-t border-gray-100 bg-white pb-24 pt-12 md:pb-12">
      <div className="mx-auto max-w-7xl px-4">

        {/* Newsletter */}
        <div
          className="rounded-3xl p-6 md:p-8 mb-10 relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #4c1d95 60%, #9d174d 100%)' }}
        >
          <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full opacity-10 pointer-events-none"
            style={{ background: 'radial-gradient(circle, #f472b6, transparent)' }} />
          <div className="relative flex flex-col md:flex-row md:items-center gap-5 md:gap-10">
            <div className="flex-1">
              <h3 className="text-lg font-bold text-white mb-1">Stay in the loop</h3>
              <p className="text-sm text-white/65">New drops, limited releases, and exclusive deals — straight to your inbox.</p>
            </div>
            {subscribed ? (
              <div className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-white/15 border border-white/25 text-white text-sm font-semibold flex-shrink-0">
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                You're subscribed!
              </div>
            ) : (
              <form onSubmit={handleSubscribe} className="flex items-center gap-2 flex-shrink-0 w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/15 border border-white/25 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-white/50 focus:bg-white/20 transition-all"
                  />
                </div>
                <button
                  type="submit"
                  disabled={subscribing}
                  className="px-4 py-2.5 rounded-xl bg-white text-gray-900 text-sm font-bold hover:bg-white/90 transition-colors disabled:opacity-70 flex-shrink-0"
                >
                  {subscribing ? '…' : 'Subscribe'}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Links grid */}
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4 mb-10">
          {/* Brand */}
          <div>
            <Logo />
            <p className="mt-3 text-sm text-gray-500 leading-relaxed max-w-[220px]">
              South Africa's home for AI-verified collectibles, limited drops, and pre-loved finds.
            </p>
            <div className="flex gap-3 mt-4">
              <a
                href="https://twitter.com/quirkify"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-xl border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:border-gray-400 transition-colors"
                aria-label="Twitter"
              >
                <Twitter className="w-3.5 h-3.5" />
              </a>
              <a
                href="https://instagram.com/quirkify"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-xl border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:border-gray-400 transition-colors"
                aria-label="Instagram"
              >
                <Instagram className="w-3.5 h-3.5" />
              </a>
              {/* TikTok (no Lucide icon — use text) */}
              <a
                href="https://tiktok.com/@quirkify"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-xl border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:border-gray-400 transition-colors text-[10px] font-bold"
                aria-label="TikTok"
              >
                TT
              </a>
            </div>
          </div>

          {/* Shop */}
          <div>
            <p className="section-label mb-4">Shop</p>
            <ul className="space-y-2.5">
              {[
                { label: 'All Products', to: '/' },
                { label: 'Live Auctions', to: '/auctions' },
                { label: 'My Orders', to: '/orders' },
                { label: 'My Collection', to: '/collection' },
              ].map(({ label, to }) => (
                <li key={to}>
                  <Link to={to} className="text-sm text-gray-500 hover:text-gray-800 transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support */}
          <div>
            <p className="section-label mb-4">Support</p>
            <ul className="space-y-2.5">
              <li>
                <Link to="/returns" className="text-sm text-gray-500 hover:text-gray-800 transition-colors">
                  Returns &amp; Refunds
                </Link>
              </li>
              <li>
                <Link to="/returns" className="text-sm text-gray-500 hover:text-gray-800 transition-colors">
                  Shipping Info
                </Link>
              </li>
              <li>
                <a href="mailto:support@quirkify.co.za" className="text-sm text-gray-500 hover:text-gray-800 transition-colors">
                  Contact Us
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <p className="section-label mb-4">Legal</p>
            <ul className="space-y-2.5">
              {[
                { label: 'Terms of Service', to: '/terms' },
                { label: 'Privacy Policy', to: '/privacy' },
                { label: 'Returns Policy', to: '/returns' },
              ].map(({ label, to }) => (
                <li key={to}>
                  <Link to={to} className="text-sm text-gray-500 hover:text-gray-800 transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-gray-100 pt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-gray-400">
            &copy; {year} Quirkify (Pty) Ltd. All rights reserved. Registered in South Africa.
          </p>

          <div className="flex flex-wrap items-center gap-2">
            {/* Payment trust badges */}
            {['Yoco', 'Visa', 'Mastercard'].map(brand => (
              <span
                key={brand}
                className="px-2.5 py-1 rounded-lg border border-gray-200 text-[10px] font-bold text-gray-500 bg-gray-50"
              >
                {brand}
              </span>
            ))}
            <span className="text-xs text-gray-300 hidden sm:inline mx-1">·</span>
            <span className="flex items-center gap-1 text-xs text-gray-400">
              Made with <Heart className="w-3 h-3 text-pink-400 fill-current" /> in SA
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
