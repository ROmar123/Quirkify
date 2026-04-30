import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Boxes, Gavel, ShoppingBag, Sparkles } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { listActiveProducts, listPacks, subscribeToReviewQueue } from '../../services/catalogService';
import { fetchOrdersForAdmin } from '../../services/commerceService';
import { listAuctions, listLiveSessions } from '../../services/auctionService';

export default function AdminDashboard() {
  const [counts, setCounts] = useState({
    products: 0,
    packs: 0,
    auctions: 0,
    liveSessions: 0,
    orders: 0,
    reviews: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const statCards: Array<{ label: string; value: number; icon: LucideIcon }> = [
    { label: 'Active products', value: counts.products, icon: Boxes },
    { label: 'Pending reviews', value: counts.reviews, icon: Sparkles },
    { label: 'Open orders', value: counts.orders, icon: ShoppingBag },
    { label: 'Auction lots', value: counts.auctions, icon: Gavel },
    { label: 'Packs', value: counts.packs, icon: Boxes },
    { label: 'Live sessions', value: counts.liveSessions, icon: Gavel },
  ];

  useEffect(() => {
    const unsubscribe = subscribeToReviewQueue((items) => {
      setCounts((current) => ({ ...current, reviews: items.filter((item) => item.status === 'pending').length }));
    });
    void Promise.all([listActiveProducts(), listPacks(), listAuctions(), listLiveSessions(), fetchOrdersForAdmin()])
      .then(([products, packs, auctions, sessions, orders]) =>
        setCounts((current) => ({
          ...current,
          products: products.length,
          packs: packs.length,
          auctions: auctions.length,
          liveSessions: sessions.length,
          orders: orders.length,
        }))
      )
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load admin dashboard');
      });
    return unsubscribe;
  }, []);

  return (
    <section className="hero-bg px-4 py-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 text-white">
          <p className="text-[11px] uppercase tracking-[0.35em] text-purple-400">Admin View</p>
          <h1 className="mt-4 text-5xl font-black">Daily operating dashboard</h1>
          <p className="mt-4 max-w-2xl text-white/65">
            Inventory, review queue, orders, auctions, live sessions, and AI-assisted growth decisions are managed from here.
          </p>
        </div>
        {error ? (
          <div className="mb-6 rounded-[1.5rem] border border-red-300/20 bg-red-500/10 px-5 py-4 text-sm text-red-100">
            {error}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {statCards.map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-[1.75rem] border border-black/8 bg-white p-6 shadow-[0_10px_40px_rgba(15,21,30,0.08)]">
              <Icon className="h-5 w-5 text-purple-600" />
              <p className="mt-4 text-[11px] uppercase tracking-[0.25em] text-purple-600">{label}</p>
              <p className="mt-2 text-4xl font-black">{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            ['Inventory', '/admin/inventory', 'Manual intake, AI intake, review queue, pack setup, and auction creation.'],
            ['Commerce', '/admin/commerce', 'Order lifecycle, payment states, shipping states, and manual fulfilment notes.'],
            ['Orders', '/admin/orders', 'Detailed order management with search, filters, event history and quick status actions.'],
            ['Growth', '/admin/growth', 'Gemini campaign planning with human approval and stored recommendations.'],
            ['Live Sessions', '/admin/live', 'Create and manage live auction sessions, queues, and host scripts.'],
            ['Social Commerce', '/admin/social', 'TikTok and WhatsApp commerce flow preview with webhook endpoint status.'],
            ['Resource Monitor', '/admin/monitor', 'Real-time database stats, service health checks, and feature status.'],
            ['Auction feed', '/auctions', 'Customer auction feed and live-room entry points for testing the public auction experience.'],
          ].map(([title, path, copy]) => (
            <Link key={path as string} to={path as string} className="rounded-[1.75rem] border border-black/8 bg-purple-900 p-6 text-white">
              <p className="text-[11px] uppercase tracking-[0.25em] text-purple-300">{title}</p>
              <p className="mt-3 text-lg font-black">{copy}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
