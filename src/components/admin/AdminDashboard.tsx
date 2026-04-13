import { useState, useEffect, useMemo } from 'react';
import { auth } from '../../firebase';
import { fetchProducts } from '../../services/productService';
import { fetchOrders, Order } from '../../services/orderService';
import { Product } from '../../types';
import { TrendingUp, ShoppingBag, Zap, ClipboardList, ArrowUpRight, ArrowDownRight, Package, DollarSign, Users, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';

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
        console.error('Dashboard load error:', err);
        setError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Calculate real metrics
  const metrics = useMemo(() => {
    const approvedProducts = products.filter(p => p.status === 'approved');
    const pendingProducts = products.filter(p => p.status === 'pending');
    const paidOrders = orders.filter(o => ['paid', 'processing', 'shipped', 'delivered'].includes(o.status));
    const totalRevenue = paidOrders.reduce((sum, o) => sum + o.total, 0);
    const avgOrderValue = paidOrders.length > 0 ? totalRevenue / paidOrders.length : 0;
    const lowStock = approvedProducts.filter(p => (p.stock ?? 0) < 5).length;
    
    // Orders by status
    const ordersByStatus = {
      pending: orders.filter(o => o.status === 'pending').length,
      paid: orders.filter(o => o.status === 'paid').length,
      processing: orders.filter(o => o.status === 'processing').length,
      shipped: orders.filter(o => o.status === 'shipped').length,
      delivered: orders.filter(o => o.status === 'delivered').length,
    };

    return {
      approvedProducts: approvedProducts.length,
      pendingProducts: pendingProducts.length,
      totalProducts: products.length,
      totalOrders: orders.length,
      totalRevenue,
      avgOrderValue,
      lowStock,
      ordersByStatus,
    };
  }, [products, orders]);

  const stats = [
    { 
      label: 'Total Revenue', 
      value: `R${metrics.totalRevenue.toLocaleString()}`, 
      subtext: `${metrics.totalOrders} orders`,
      icon: DollarSign, 
      gradient: 'linear-gradient(135deg, #10B981, #3B82F6)' 
    },
    { 
      label: 'Active Products', 
      value: metrics.approvedProducts, 
      subtext: metrics.lowStock > 0 ? `${metrics.lowStock} low stock` : 'All good',
      subtextColor: metrics.lowStock > 0 ? 'text-amber-600' : 'text-green-600',
      icon: ShoppingBag, 
      gradient: 'linear-gradient(135deg, #F472B6, #A855F7)' 
    },
    { 
      label: 'Pending Review', 
      value: metrics.pendingProducts, 
      subtext: 'Awaiting approval',
      icon: Zap, 
      gradient: 'linear-gradient(135deg, #FBBF24, #FB923C)' 
    },
    { 
      label: 'Avg Order Value', 
      value: `R${Math.round(metrics.avgOrderValue).toLocaleString()}`, 
      subtext: 'Per transaction',
      icon: Activity, 
      gradient: 'linear-gradient(135deg, #A855F7, #6366F1)' 
    },
  ];

  const quickLinks = [
    { to: '/admin/inventory', label: 'Inventory', desc: 'Manage products & stock', icon: ShoppingBag, gradient: 'linear-gradient(135deg, #F472B6, #A855F7)' },
    { to: '/admin/orders', label: 'Orders', desc: 'Process & fulfill orders', icon: ClipboardList, gradient: 'linear-gradient(135deg, #4ADE80, #3B82F6)' },
    { to: '/admin/campaigns', label: 'Growth', desc: 'Campaigns & analytics', icon: TrendingUp, gradient: 'linear-gradient(135deg, #FBBF24, #FB923C)' },
  ];

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 bg-purple-50 animate-pulse rounded-3xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center">
        <p className="text-red-500 font-bold">{error}</p>
        <button onClick={() => window.location.reload()} className="mt-4 btn-primary px-6 py-2 text-sm">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="px-4 py-4">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-black gradient-text">Dashboard</h1>
          <p className="text-purple-400 text-xs font-semibold mt-1">
            Welcome back, {auth.currentUser?.email?.split('@')[0]}
          </p>
        </div>

        {/* Key Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {stats.map(s => (
            <div key={s.label} className="bg-white rounded-3xl border border-purple-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
              <div className="h-1.5" style={{ background: s.gradient }} />
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 bg-purple-50 rounded-xl">
                    <s.icon className="w-4 h-4 text-purple-500" />
                  </div>
                </div>
                <p className="text-[10px] text-purple-400 font-bold uppercase tracking-wide">{s.label}</p>
                <p className="text-xl font-black text-purple-900 mt-1">{s.value}</p>
                {s.subtext && (
                  <p className={cn('text-[10px] font-semibold mt-1', s.subtextColor || 'text-purple-400')}>
                    {s.subtext}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Order Pipeline */}
        <div className="bg-white rounded-3xl border border-purple-100 p-5 shadow-sm mb-6">
          <h2 className="text-sm font-black text-purple-900 mb-4">Order Pipeline</h2>
          <div className="grid grid-cols-5 gap-2">
            {[
              { label: 'Pending', count: metrics.ordersByStatus.pending, color: 'bg-amber-100 text-amber-700' },
              { label: 'Paid', count: metrics.ordersByStatus.paid, color: 'bg-blue-100 text-blue-700' },
              { label: 'Processing', count: metrics.ordersByStatus.processing, color: 'bg-purple-100 text-purple-700' },
              { label: 'Shipped', count: metrics.ordersByStatus.shipped, color: 'bg-indigo-100 text-indigo-700' },
              { label: 'Delivered', count: metrics.ordersByStatus.delivered, color: 'bg-green-100 text-green-700' },
            ].map((stage, i, arr) => (
              <div key={stage.label} className="relative">
                <div className={cn('rounded-2xl p-3 text-center', stage.color)}>
                  <p className="text-lg font-black">{stage.count}</p>
                  <p className="text-[9px] font-bold uppercase tracking-wide mt-1">{stage.label}</p>
                </div>
                {i < arr.length - 1 && (
                  <div className="hidden lg:block absolute top-1/2 -right-2 w-4 h-0.5 bg-purple-200" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
          {quickLinks.map(l => (
            <Link key={l.to} to={l.to}
              className="bg-white rounded-3xl border border-purple-100 p-4 hover:shadow-md transition-all group">
              <div className="w-10 h-10 rounded-2xl mb-3 flex items-center justify-center text-white group-hover:scale-110 transition-transform"
                style={{ background: l.gradient }}>
                <l.icon className="w-5 h-5" />
              </div>
              <p className="text-sm font-black text-purple-900">{l.label}</p>
              <p className="text-[10px] text-purple-400 font-semibold mt-0.5">{l.desc}</p>
            </Link>
          ))}
        </div>

        {/* Stock Levels */}
        <div className="bg-white rounded-3xl border border-purple-100 p-5 shadow-sm mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-black text-purple-900">Stock Levels by Channel</h2>
            <Link to="/admin/inventory" className="text-xs font-bold text-purple-500 hover:text-purple-700">Manage →</Link>
          </div>
          {products.length === 0 ? (
            <p className="text-xs text-purple-300 font-semibold text-center py-6">No products yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-purple-100">
                    <th className="text-left py-2 px-3 font-bold text-purple-600">Product</th>
                    <th className="text-center py-2 px-3 font-bold text-purple-600">Total</th>
                    <th className="text-center py-2 px-3 font-bold text-blue-600">Store</th>
                    <th className="text-center py-2 px-3 font-bold text-amber-600">Auction</th>
                    <th className="text-center py-2 px-3 font-bold text-pink-600">Packs</th>
                  </tr>
                </thead>
                <tbody>
                  {products.filter(p => p.status === 'approved').slice(0, 10).map(p => {
                    const total = p.stock ?? 0;
                    const store = p.allocations?.store ?? 0;
                    const auction = p.allocations?.auction ?? 0;
                    const packs = p.allocations?.packs ?? 0;
                    const isLowStock = total < 5;
                    return (
                      <tr key={p.id} className="border-b border-purple-50 hover:bg-purple-50 transition-colors">
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            {p.imageUrl && (
                              <img src={p.imageUrl} className="w-8 h-8 rounded-xl object-cover" alt="" />
                            )}
                            <span className={cn('truncate max-w-xs', isLowStock && 'text-amber-600 font-bold')}>{p.name}</span>
                          </div>
                        </td>
                        <td className={cn('text-center py-3 px-3 font-bold', isLowStock && 'text-amber-600')}>{total}</td>
                        <td className="text-center py-3 px-3"><span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-full">{store}</span></td>
                        <td className="text-center py-3 px-3"><span className="bg-amber-50 text-amber-700 px-2 py-1 rounded-full">{auction}</span></td>
                        <td className="text-center py-3 px-3"><span className="bg-pink-50 text-pink-700 px-2 py-1 rounded-full">{packs}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {products.filter(p => p.status === 'approved').length > 10 && (
                <p className="text-center text-xs text-purple-400 mt-3">
                  +{products.filter(p => p.status === 'approved').length - 10} more products
                </p>
              )}
            </div>
          )}
        </div>

        {/* Recent activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-3xl border border-purple-100 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-black text-purple-900">Recent Orders</h2>
              <Link to="/admin/orders" className="text-xs font-bold text-purple-500 hover:text-purple-700">View all →</Link>
            </div>
            {orders.slice(0, 5).length === 0 ? (
              <p className="text-xs text-purple-300 font-semibold text-center py-6">No orders yet</p>
            ) : (
              <div className="space-y-2">
                {orders.slice(0, 5).map(o => (
                  <div key={o.id} className="flex items-center gap-3 p-3 rounded-2xl bg-purple-50">
                    <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center border border-purple-100">
                      <ClipboardList className="w-3.5 h-3.5 text-purple-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-purple-900 truncate">{o.orderNumber}</p>
                      <p className="text-[10px] text-purple-400 font-semibold truncate">{o.customerEmail}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black text-purple-900">R{o.total.toLocaleString()}</p>
                      <p className={cn('text-[10px] font-bold', 
                        o.status === 'delivered' ? 'text-green-600' : 
                        o.status === 'cancelled' ? 'text-red-600' :
                        'text-amber-600'
                      )}>{o.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-3xl border border-purple-100 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-black text-purple-900">Recent Products</h2>
              <Link to="/admin/inventory" className="text-xs font-bold text-purple-500 hover:text-purple-700">View all →</Link>
            </div>
            {products.slice(0, 5).length === 0 ? (
              <p className="text-xs text-purple-300 font-semibold text-center py-6">No products yet</p>
            ) : (
              <div className="space-y-2">
                {products.slice(0, 5).map(p => (
                  <div key={p.id} className="flex items-center gap-3 p-3 rounded-2xl bg-purple-50">
                    {p.imageUrl ? (
                      <img src={p.imageUrl} className="w-8 h-8 rounded-xl object-cover flex-shrink-0" alt="" />
                    ) : (
                      <div className="w-8 h-8 rounded-xl bg-purple-200 flex items-center justify-center flex-shrink-0">
                        <Package className="w-3.5 h-3.5 text-purple-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-purple-900 truncate">{p.name}</p>
                      <p className="text-[10px] text-purple-400 font-semibold">{p.category} · {p.condition}</p>
                    </div>
                    <span className={cn('px-2 py-1 rounded-full text-[10px] font-bold',
                      p.status === 'approved' ? 'bg-green-50 text-green-700' :
                      p.status === 'pending'  ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-600'
                    )}>{p.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
