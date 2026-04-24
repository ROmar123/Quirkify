import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-[#0b1017] px-4 py-10 text-white/60">
      <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.35em] text-white/35">Quirkify</p>
          <p className="mt-3 max-w-sm text-sm leading-6">
            A gamified social commerce platform for store drops, auctions, live selling, and AI-assisted operations.
          </p>
        </div>
        <div className="grid gap-2 text-sm">
          <Link to="/" className="hover:text-white">Store</Link>
          <Link to="/auctions" className="hover:text-white">Auctions</Link>
          <Link to="/orders" className="hover:text-white">Orders</Link>
          <Link to="/profile" className="hover:text-white">Profile</Link>
        </div>
        <div className="grid gap-2 text-sm">
          <Link to="/terms" className="hover:text-white">Terms</Link>
          <Link to="/privacy" className="hover:text-white">Privacy</Link>
          <Link to="/returns" className="hover:text-white">Returns</Link>
        </div>
      </div>
    </footer>
  );
}
