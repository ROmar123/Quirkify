import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Boxes, Gavel, ShoppingBag, Sparkles, Radio, Package,
  ArrowRight, ClipboardList, Megaphone, AlertCircle,
  TrendingUp, LayoutGrid,
} from 'lucide-react';
import { motion } from 'motion/react';
import { listActiveProducts, listPacks, subscribeToReviewQueue } from '../../services/catalogService';
import { fetchOrdersForAdmin } from '../../services/commerceService';
import { listAuctions, listLiveSessions } from '../../services/auctionService';

const WEEKDAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function now() {
  const d = new Date();
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ElementType;
  accent: string;
  bg: string;
  urgent?: boolean;
  delay?: number;
}

function StatCard({ label, value, icon: Icon, accent, bg, urgent, delay = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="relative bg-white rounded-2xl border border-gray-100 p-5 shadow-sm overflow-hidden"
    >
      {urgent && value > 0 && (
        <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
      )}
      <div className="flex items-start justify-between">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: bg }}
        >
          <Icon className="w-5 h-5" style={{ color: accent }} />
        </div>
      </div>
      <p className="mt-4 text-3xl font-black text-gray-900 tracking-tight tabular-nums">{value}</p>
      <p className="mt-1 text-xs font-semibold text-gray-400 uppercase tracking-widest">{label}</p>
      <div
        className="absolute bottom-0 left-0 right-0 h-0.5"
        style={{ background: `linear-gradient(90deg, ${accent}40, transparent)` }}
      />
    </motion.div>
  );
}

interface NavCardProps {
  title: string;
  description: string;
  path: string;
  icon: React.ElementType;
  gradient: string;
  delay?: number;
}

function NavCard({ title, description, path, icon: Icon, gradient, delay = 0 }: NavCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <Link
        to={path}
        className="group relative flex flex-col h-full min-h-[140px] rounded-2xl overflow-hidden border border-transparent transition-all duration-300 hover:-translate-y-1"
        style={{
          background: gradient,
          boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
        }}
      >
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{ background: 'rgba(255,255,255,0.08)' }} />
        <div className="relative flex flex-col flex-1 p-5">
          <div className="w-9 h-9 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center mb-auto">
            <Icon className="w-4.5 h-4.5 text-white" />
          </div>
          <div className="mt-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">{title}</p>
            <p className="mt-1 text-sm font-bold text-white leading-snug">{description}</p>
          </div>
        </div>
        <div className="relative px-5 py-3 border-t border-white/10 flex items-center justify-between">
          <span className="text-[11px] font-semibold text-white/70 group-hover:text-white transition-colors">Open</span>
          <ArrowRight className="w-3.5 h-3.5 text-white/60 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
        </div>
      </Link>
    </motion.div>
  );
}

export default function AdminDashboard() {
  const [counts, setCounts] = useState({
    products: 0, packs: 0, auctions: 0,
    liveSessions: 0, orders: 0, reviews: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubReview = subscribeToReviewQueue((items) => {
      setCounts(c => ({ ...c, reviews: items.filter(i => i.status === 'pending').length }));
    });

    void Promise.all([
      listActiveProducts(),
      listPacks(),
      listAuctions(),
      listLiveSessions(),
      fetchOrdersForAdmin(),
    ])
      .then(([products, packs, auctions, sessions, orders]) => {
        setCounts(c => ({
          ...c,
          products: products.length,
          packs: packs.length,
          auctions: auctions.length,
          liveSessions: sessions.length,
          orders: orders.length,
        }));
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load dashboard'))
      .finally(() => setLoading(false));

    return unsubReview;
  }, []);

  const urgentStats: StatCardProps[] = [
    { label: 'Pending review', value: counts.reviews, icon: Sparkles, accent: '#f59e0b', bg: '#fffbeb', urgent: true, delay: 0.05 },
    { label: 'Open orders',    value: counts.orders,  icon: ClipboardList, accent: '#6366f1', bg: '#eef2ff', urgent: true, delay: 0.1 },
    { label: 'Live auctions',  value: counts.auctions, icon: Gavel, accent: '#ec4899', bg: '#fdf2f8', urgent: counts.auctions > 0, delay: 0.15 },
  ];

  const inventoryStats: StatCardProps[] = [
    { label: 'Active products', value: counts.products, icon: Boxes,    accent: '#a855f7', bg: '#faf5ff', delay: 0.2 },
    { label: 'Pack offers',     value: counts.packs,    icon: Package,  accent: '#14b8a6', bg: '#f0fdfa', delay: 0.25 },
    { label: 'Live sessions',   value: counts.liveSessions, icon: Radio, accent: '#ef4444', bg: '#fef2f2', delay: 0.3 },
  ];

  const navCards: NavCardProps[] = [
    {
      title: 'Inventory',
      description: 'AI intake, review queue, stock & channel management',
      path: '/admin/inventory',
      icon: LayoutGrid,
      gradient: 'linear-gradient(135deg, #4c1d95 0%, #7c3aed 100%)',
      delay: 0.35,
    },
    {
      title: 'Commerce',
      description: 'Orders, payments, shipping and fulfilment tracking',
      path: '/admin/commerce',
      icon: ShoppingBag,
      gradient: 'linear-gradient(135deg, #1e40af 0%, #4f46e5 100%)',
      delay: 0.4,
    },
    {
      title: 'Growth',
      description: 'Gemini-powered campaigns with operator approval',
      path: '/admin/growth',
      icon: Megaphone,
      gradient: 'linear-gradient(135deg, #065f46 0%, #059669 100%)',
      delay: 0.45,
    },
    {
      title: 'Auctions',
      description: 'Customer auction feed and live bidding room',
      path: '/auctions',
      icon: TrendingUp,
      gradient: 'linear-gradient(135deg, #92400e 0%, #f59e0b 100%)',
      delay: 0.5,
    },
  ];

  return (
    <div className="hero-bg min-h-screen">
      <div className="max-w-7xl mx-auto px-4 pt-8 pb-24">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-10"
        >
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-purple-400 mb-2">{now()}</p>
          <h1
            className="text-4xl font-black text-gray-900 tracking-tight leading-tight"
            style={{ fontFamily: 'Nunito, sans-serif' }}
          >
            Operating dashboard
          </h1>
          <p className="mt-1.5 text-sm text-gray-400 font-medium">
            Everything you need to run the business — in one place.
          </p>
        </motion.div>

        {error && (
          <div className="mb-6 flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl text-sm text-red-700 font-medium">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Attention stats */}
        <div className="mb-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Needs attention</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {urgentStats.map(s => <StatCard key={s.label} {...s} />)}
          </div>
        </div>

        {/* Divider */}
        <div className="my-6 border-t border-gray-100" />

        {/* Inventory stats */}
        <div className="mb-8">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Inventory &amp; channels</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {inventoryStats.map(s => <StatCard key={s.label} {...s} />)}
          </div>
        </div>

        {/* Navigation cards */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Quick access</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {navCards.map(c => <NavCard key={c.path} {...c} />)}
          </div>
        </div>

        {/* Loading skeleton overlay */}
        {loading && (
          <div className="absolute inset-0 pointer-events-none" />
        )}
      </div>
    </div>
  );
}
