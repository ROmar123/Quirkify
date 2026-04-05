import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../../firebase';
import { Product } from '../../types';
import { TrendingUp, ShoppingBag, Zap, ClipboardList, ArrowUpRight, ArrowDownRight, Package, PlusCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';
export default function AdminDashboard() {
  const [products, setProducts] = useState<Product[]>([]);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubProducts = onSnapshot(
      query(collection(db, 'products'), orderBy('createdAt', 'desc'), limit(5)),
      snap => setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Product))),
      err => handleFirestoreError(err, OperationType.GET, 'products')
    );
    const unsubOrders = onSnapshot(
      query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(5)),
      snap => { setRecentOrders(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); },
      err => { handleFirestoreError(err, OperationType.GET, 'orders'); setLoading(false); }
    );
    return () => { unsubProducts(); unsubOrders(); };
  }, []);

  const stats = [
    { label: 'Active Products', value: products.filter(p => p.status === 'approved').length, trend: '+3', up: true, icon: ShoppingBag, gradient: 'linear-gradient(135deg, #F472B6, #A855F7)' },
    { label: 'Pending Review', value: products.filter(p => p.status === 'pending').length, trend: '', up: false, icon: Zap, gradient: 'linear-gradient(135deg, #FBBF24, #FB923C)' },
    { label: 'Recent Orders', value: recentOrders.length, trend: '+8.4%', up: true, icon: ClipboardList, gradient: 'linear-gradient(135deg, #4ADE80, #60A5FA)' },
    { label: 'Total Products', value: products.length, trend: '', up: true, icon: Package, gradient: 'linear-gradient(135deg, #A855F7, #6366F1)' },
  ];

  const quickLinks = [
    { to: '/admin/intake',   label: 'AI Intake',     desc: 'Add product via photo',  icon: PlusCircle,   gradient: 'linear-gradient(135deg, #F472B6, #A855F7)' },
    { to: '/admin/listings', label: 'Products',      desc: 'Manage all listings',    icon: ShoppingBag,  gradient: 'linear-gradient(135deg, #A855F7, #6366F1)' },
    { to: '/admin/orders',   label: 'Commerce',      desc: 'Orders, auctions, packs', icon: ClipboardList, gradient: 'linear-gradient(135deg, #4ADE80, #60A5FA)' },
    { to: '/admin/campaigns',label: 'Growth',        desc: 'Campaigns & social',     icon: TrendingUp,   gradient: 'linear-gradient(135deg, #FBBF24, #FB923C)' },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      <div className="px-4 py-4">
      <div className="mb-6">
        <h1 className="text-2xl font-black gradient-text">Dashboard</h1>
        <p className="text-purple-400 text-xs font-semibold mt-1">
          Welcome back, {auth.currentUser?.email?.split('@')[0]}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {stats.map(s => (
          <div key={s.label} className="bg-white rounded-3xl border border-purple-100 shadow-sm overflow-hidden">
            <div className="h-1.5" style={{ background: s.gradient }} />
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-purple-50 rounded-xl">
                  <s.icon className="w-4 h-4 text-purple-500" />
                </div>
                {s.trend && (
                  <span className={cn('text-[10px] font-bold flex items-center gap-0.5', s.up ? 'text-green-600' : 'text-red-500')}>
                    {s.trend}
                    {s.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-purple-400 font-bold uppercase tracking-wide">{s.label}</p>
              <p className="text-2xl font-black text-purple-900">{loading ? '—' : s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
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
          <Link to="/admin/listings" className="text-xs font-bold text-purple-500 hover:text-purple-700">Manage →</Link>
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
                {products.filter(p => p.status === 'approved').map(p => {
                  const total = p.stock ?? 0;
                  const store = p.allocations?.store ?? 0;
                  const auction = p.allocations?.auction ?? 0;
                  const packs = p.allocations?.packs ?? 0;
                  const allocated = store + auction + packs;
                  return (
                    <tr key={p.id} className="border-b border-purple-50 hover:bg-purple-50 transition-colors">
                      <td className="py-3 px-3 truncate max-w-xs">{p.name}</td>
                      <td className="text-center py-3 px-3 font-bold">{total}</td>
                      <td className="text-center py-3 px-3"><span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-full">{store}</span></td>
                      <td className="text-center py-3 px-3"><span className="bg-amber-50 text-amber-700 px-2 py-1 rounded-full">{auction}</span></td>
                      <td className="text-center py-3 px-3"><span className="bg-pink-50 text-pink-700 px-2 py-1 rounded-full">{packs}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
          {recentOrders.length === 0 ? (
            <p className="text-xs text-purple-300 font-semibold text-center py-6">No orders yet</p>
          ) : (
            <div className="space-y-2">
              {recentOrders.map(o => (
                <div key={o.id} className="flex items-center gap-3 p-3 rounded-2xl bg-purple-50">
                  <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center border border-purple-100">
                    <ClipboardList className="w-3.5 h-3.5 text-purple-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-purple-900 truncate">#{o.id.slice(-8)}</p>
                    <p className="text-[10px] text-purple-400 font-semibold truncate">{o.userEmail}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-purple-900">R{o.total}</p>
                    <p className={cn('text-[10px] font-bold', o.status === 'delivered' ? 'text-green-600' : 'text-amber-600')}>{o.status}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-3xl border border-purple-100 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-black text-purple-900">Recent Products</h2>
            <Link to="/admin/listings" className="text-xs font-bold text-purple-500 hover:text-purple-700">View all →</Link>
          </div>
          {products.length === 0 ? (
            <p className="text-xs text-purple-300 font-semibold text-center py-6">No products yet</p>
          ) : (
            <div className="space-y-2">
              {products.map(p => (
                <div key={p.id} className="flex items-center gap-3 p-3 rounded-2xl bg-purple-50">
                  <img src={p.imageUrl} className="w-8 h-8 rounded-xl object-cover flex-shrink-0" alt="" />
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
