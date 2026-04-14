import { useState, useEffect, useMemo } from 'react';
import { auth } from '../../firebase';
import { fetchProducts } from '../../services/productService';
import { fetchOrders, Order } from '../../services/orderService';
import { Product } from '../../types';
import {
  TrendingUp, ShoppingBag, Zap, ClipboardList, ArrowUpRight,
  Package, DollarSign, Activity, AlertTriangle, CheckCircle2,
  Clock, Truck, BarChart3
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { motion } from 'motion/react';

export default function AdminDashboard() {
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [prods, ords] = await Promise.all([
          fetchProducts(),
          fetchOrders({ excludeSourceRef: 'wallet_topup' }),
        ]);
        setProducts(prods);
        setOrders(ords);
      } catch (err) {
        setError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const metrics = useMemo(() => {
    const approved = products.filter(p => p.status === 'approved');
    const pending = products.filter(p => p.status === 'pending');
    const paidOrders = orders.filter(o => ['paid', 'processing', 'shipped', 'delivered'].includes(o.status));
    const totalRevenue = paidOrders.reduce((s, o) => s + o.total, 0);
    const avgOrderValue = paidOrders.length > 0 ? totalRevenue / paidOrders.length : 0;
    const lowStock = approved.filter(p => (p.stock ?? 0) < 5).length;

    return {
      approvedProducts: approved.length,
      pendingProducts: pending.length,
      totalProducts: products.length,
      totalOrders: orders.length,
      paidOrders: paidOrders.length,
      totalRevenue,
      avgOrderValue,
      lowStock,
      pipeline: {
        pending: orders.filter(o => o.status === 'pending').length,
        paid: orders.filter(o => o.status === 'paid').length,
        processing: orders.filter(o => o.status === 'processing').length,
        shipped: orders.filter(o => o.status === 'shipped').length,
        delivered: orders.filter(o => o.status === 'delivered').length,
        cancelled: orders.filter(o => o.status === 'cancelled').length,
      },
    };
  }, [products, orders]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map(i => <div key={i} className="skeleton h-28 rounded-2xl" />)}
        </div>
        <div className="skeleton h-32 rounded-2xl mb-4" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="skeleton h-64 rounded-2xl" />
          <div className="skeleton h-64 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center">
        <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
        <p className="text-gray-600 font-medium mb-4">{error}</p>
        <button onClick={() => window.location.reload()} className="btn-primary px-5 py-2.5 text-sm">
          Retry
        </button>
      </div>
    );
  }

  const stats = [
    {
      label: 'Total Revenue',
      value: `R${metrics.totalRevenue.toLocaleString()}`,
      sub: `${metrics.paidOrders} paid orders`,
      icon: DollarSign,
      iconBg: '#dcfce7',
      iconColor: '#16a34a',
      accentColor: '#22c55e',
    },
    {
      label: 'Active Products',
      value: metrics.approvedProducts,
      sub: metrics.lowStock > 0 ? `${metrics.lowStock} low stock` : 'All stocked',
      subColor: metrics.lowStock > 0 ? '#d97706' : '#16a34a',
      icon: ShoppingBag,
      iconBg: '#f5f3ff',
      iconColor: '#7c3aed',
      accentColor: '#a855f7',
    },
    {
      label: 'Pending Review',
      value: metrics.pendingProducts,
      sub: 'Awaiting approval',
      icon: Zap,
      iconBg: '#fffbeb',
      iconColor: '#d97706',
      accentColor: '#fbbf24',
    },
    {
      label: 'Avg Order Value',
      value: `R${Math.round(metrics.avgOrderValue).toLocaleString()}`,
      sub: 'Per transaction',
      icon: Activity,
      iconBg: '#faf5ff',
      iconColor: '#9333ea',
      accentColor: '#c084fc',
    },
  ];

  const pipelineStages = [
    { label: 'Pending', count: metrics.pipeline.pending, icon: Clock, color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
    { label: 'Paid', count: metrics.pipeline.paid, icon: CheckCircle2, color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
    { label: 'Processing', count: metrics.pipeline.processing, icon: Zap, color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
    { label: 'Shipped', count: metrics.pipeline.shipped, icon: Truck, color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc' },
    { label: 'Delivered', count: metrics.pipeline.delivered, icon: CheckCircle2, color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  ];

  const quickLinks = [
    { to: '/admin/inventory', label: 'Inventory', desc: 'Manage products & stock', icon: ShoppingBag, gradient: 'linear-gradient(135deg,#f472b6,#a855f7)' },
    { to: '/admin/orders', label: 'Orders', desc: 'Process & fulfill orders', icon: ClipboardList, gradient: 'linear-gradient(135deg,#22d3ee,#3b82f6)' },
    { to: '/admin/campaigns', label: 'Growth', desc: 'Campaigns & analytics', icon: TrendingUp, gradient: 'linear-gradient(135deg,#fbbf24,#f97316)' },
    { to: '/admin/reviews', label: 'Review Queue', desc: 'Approve pending products', icon: Zap, gradient: 'linear-gradient(135deg,#a855f7,#6366f1)' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 pb-24">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-7 flex items-start justify-between"
      >
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900" style={{ fontFamily: 'Nunito, sans-serif' }}>
            Dashboard
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Welcome back, <span className="font-semibold text-gray-700">{auth.currentUser?.email?.split('@')[0]}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2">
          <BarChart3 className="w-4 h-4 text-gray-500" />
          <span className="text-xs font-medium text-gray-600">{metrics.totalOrders} total orders</span>
        </div>
      </motion.div>

      {/* Key Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="admin-card relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl" style={{ background: s.accentColor }} />
            <div className="flex items-start justify-between mb-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: s.iconBg }}
              >
                <s.icon className="w-4 h-4" style={{ color: s.iconColor }} />
              </div>
            </div>
            <p className="section-label mb-1">{s.label}</p>
            <p className="text-xl font-bold text-gray-900 stat-number">{s.value}</p>
            {s.sub && (
              <p className="text-xs font-medium mt-0.5" style={{ color: s.subColor || '#9ca3af' }}>
                {s.sub}
              </p>
            )}
          </motion.div>
        ))}
      </div>

      {/* Order Pipeline */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="admin-card mb-5"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-800">Order Pipeline</h2>
          <Link to="/admin/orders" className="flex items-center gap-1 text-xs font-medium text-purple-600 hover:text-purple-700 transition-colors">
            View all <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="grid grid-cols-5 gap-2">
          {pipelineStages.map((stage, i) => (
            <div key={stage.label} className="relative">
              <div
                className="rounded-xl p-3 text-center border"
                style={{ background: stage.bg, borderColor: stage.border }}
              >
                <p className="text-xl font-bold stat-number" style={{ color: stage.color }}>{stage.count}</p>
                <p className="text-[9px] font-semibold uppercase tracking-wide mt-0.5" style={{ color: stage.color }}>
                  {stage.label}
                </p>
              </div>
              {i < pipelineStages.length - 1 && (
                <div className="hidden lg:block absolute top-1/2 -right-1.5 w-3 h-px bg-gray-200" />
              )}
            </div>
          ))}
        </div>

        {/* Mini progress bar */}
        {metrics.totalOrders > 0 && (
          <div className="mt-4 flex h-2 rounded-full overflow-hidden">
            {[
              { count: metrics.pipeline.pending, color: '#fbbf24' },
              { count: metrics.pipeline.paid, color: '#60a5fa' },
              { count: metrics.pipeline.processing, color: '#a855f7' },
              { count: metrics.pipeline.shipped, color: '#22d3ee' },
              { count: metrics.pipeline.delivered, color: '#4ade80' },
            ].map((s, i) => s.count > 0 ? (
              <div
                key={i}
                className="h-full transition-all duration-500"
                style={{
                  width: `${(s.count / metrics.totalOrders) * 100}%`,
                  background: s.color,
                }}
              />
            ) : null)}
          </div>
        )}
      </motion.div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {quickLinks.map((l, i) => (
          <motion.div
            key={l.to}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 + i * 0.05 }}
          >
            <Link
              to={l.to}
              className="admin-card flex flex-col group hover:-translate-y-0.5 transition-all"
            >
              <div
                className="w-10 h-10 rounded-xl mb-3 flex items-center justify-center text-white group-hover:scale-105 transition-transform"
                style={{ background: l.gradient }}
              >
                <l.icon className="w-4 h-4" />
              </div>
              <p className="text-sm font-semibold text-gray-800">{l.label}</p>
              <p className="text-[11px] text-gray-500 mt-0.5">{l.desc}</p>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Recent Data */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Orders */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="admin-card"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-800">Recent Orders</h2>
            <Link to="/admin/orders" className="flex items-center gap-1 text-xs font-medium text-purple-600 hover:text-purple-700 transition-colors">
              View all <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          {orders.length === 0 ? (
            <div className="py-8 text-center">
              <ClipboardList className="w-7 h-7 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No orders yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {orders.slice(0, 5).map(o => {
                const statusColors: Record<string, string> = {
                  delivered: '#16a34a', paid: '#2563eb', shipped: '#0891b2',
                  processing: '#7c3aed', pending: '#d97706',
                  cancelled: '#dc2626', payment_failed: '#dc2626',
                };
                return (
                  <div key={o.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center border border-gray-100 flex-shrink-0">
                      <ClipboardList className="w-3.5 h-3.5 text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-900 truncate">{o.orderNumber}</p>
                      <p className="text-[10px] text-gray-500 truncate">{o.customerEmail}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-bold text-gray-900">R{o.total.toLocaleString()}</p>
                      <p className="text-[10px] font-medium" style={{ color: statusColors[o.status] || '#9ca3af' }}>
                        {o.status}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Stock table */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="admin-card"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-800">Stock Levels</h2>
            <Link to="/admin/inventory" className="flex items-center gap-1 text-xs font-medium text-purple-600 hover:text-purple-700 transition-colors">
              Manage <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          {products.filter(p => p.status === 'approved').length === 0 ? (
            <div className="py-8 text-center">
              <Package className="w-7 h-7 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No products yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {products.filter(p => p.status === 'approved').slice(0, 6).map(p => {
                const total = p.stock ?? 0;
                const isLow = total < 5;
                return (
                  <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                    <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
                      {p.imageUrl
                        ? <img src={p.imageUrl} className="w-full h-full object-cover" alt="" />
                        : <Package className="w-4 h-4 text-gray-300 m-2" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-xs font-medium truncate', isLow ? 'text-amber-700' : 'text-gray-800')}>
                        {p.name}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.min(100, (total / 20) * 100)}%`,
                              background: isLow ? '#f97316' : '#a855f7',
                            }}
                          />
                        </div>
                        <span className={cn('text-[10px] font-semibold flex-shrink-0', isLow ? 'text-amber-600' : 'text-gray-500')}>
                          {total}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>

      {/* Low stock alert */}
      {metrics.lowStock > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="mt-4 flex items-center gap-3 p-4 rounded-2xl border border-amber-100 bg-amber-50"
        >
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800">
              {metrics.lowStock} product{metrics.lowStock > 1 ? 's' : ''} running low on stock
            </p>
            <p className="text-xs text-amber-600 mt-0.5">Items with less than 5 units remaining</p>
          </div>
          <Link to="/admin/inventory" className="btn-secondary text-xs px-3 py-2 border-amber-200 text-amber-700 hover:border-amber-400">
            Review
          </Link>
        </motion.div>
      )}
    </div>
  );
}
