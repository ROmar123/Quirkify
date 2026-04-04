import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { Product, Campaign } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { TrendingUp, ShoppingBag, Zap, ArrowUpRight, ArrowDownRight, Box, Gavel, Eye, PlusCircle, ClipboardList, Video, Megaphone, LayoutGrid } from 'lucide-react';
import { cn } from '../../lib/utils';
import ProductIntake from './ProductIntake';
import ReviewQueue from './ReviewQueue';
import AuctionManager from './AuctionManager';
import PackManager from './PackManager';
import OrderManager from './OrderManager';
import ResourceMonitor from './ResourceMonitor';
import ListingManager from './ListingManager';
import CampaignManager from './CampaignManager';
import LiveStreamManager from './LiveStreamManager';

type AdminTab = 'dashboard' | 'onboarding' | 'listings' | 'review' | 'campaigns' | 'orders' | 'auctions' | 'packs' | 'streams' | 'resources';

import { handleFirestoreError, OperationType } from '../../firebase';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [products, setProducts] = useState<Product[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const qProducts = query(collection(db, 'products'), orderBy('createdAt', 'desc'), limit(10));
    const unsubscribeProducts = onSnapshot(qProducts, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'products');
    });

    const qCampaigns = query(collection(db, 'campaigns'), orderBy('createdAt', 'desc'), limit(5));
    const unsubscribeCampaigns = onSnapshot(qCampaigns, (snapshot) => {
      setCampaigns(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Campaign)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'campaigns');
    });

    const qOrders = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(5));
    const unsubscribeOrders = onSnapshot(qOrders, (snapshot) => {
      setRecentOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'orders');
      setLoading(false);
    });

    return () => {
      unsubscribeProducts();
      unsubscribeCampaigns();
      unsubscribeOrders();
    };
  }, []);

  const stats = [
    { label: 'Total Revenue', value: 'R124,500', trend: '+12.5%', up: true, icon: TrendingUp },
    { label: 'Active Products', value: products.filter(p => p.status === 'approved').length, trend: '+3', up: true, icon: ShoppingBag },
    { label: 'Pending Reviews', value: products.filter(p => p.status === 'pending').length, trend: '-2', up: false, icon: Zap },
    { label: 'Total Orders', value: '142', trend: '+8.4%', up: true, icon: ClipboardList },
  ];

  const tabs: { id: AdminTab; label: string; icon: any }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: TrendingUp },
    { id: 'onboarding', label: 'Product Onboarding', icon: PlusCircle },
    { id: 'listings', label: 'E-commerce Listings', icon: LayoutGrid },
    { id: 'review', label: 'Review Queue', icon: Eye },
    { id: 'campaigns', label: 'Marketing Campaigns', icon: Megaphone },
    { id: 'orders', label: 'Orders/Payments', icon: ClipboardList },
    { id: 'auctions', label: 'Auctions', icon: Gavel },
    { id: 'packs', label: 'Packs', icon: Box },
    { id: 'streams', label: 'Live Streams', icon: Video },
    { id: 'resources', label: 'Resources', icon: Zap },
  ];

  return (
    <div className="flex flex-col lg:flex-row min-h-screen" style={{ background: '#FDF4FF' }}>
      {/* Sidebar */}
      <aside className="w-full lg:w-64 bg-white border-r border-purple-100 flex-shrink-0 sticky top-0 h-fit lg:h-screen z-20">
        <div className="p-6 border-b border-purple-100">
          <h1 className="text-lg font-black gradient-text">Admin Portal</h1>
          <p className="text-purple-400 text-[8px] uppercase tracking-widest font-bold mt-1">Quirkify Control Center</p>
        </div>

        <nav className="p-3 space-y-1 max-h-[calc(100vh-200px)] overflow-y-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all text-left",
                activeTab === tab.id
                  ? "text-white shadow-md"
                  : "text-purple-400 hover:text-purple-600 hover:bg-purple-50"
              )}
              style={activeTab === tab.id ? { background: 'linear-gradient(135deg, #F472B6, #A855F7)' } : {}}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-5 border-t border-purple-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold" style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}>
              {auth.currentUser?.email?.[0].toUpperCase()}
            </div>
            <div>
              <p className="text-[10px] font-bold truncate max-w-[120px]">{auth.currentUser?.email?.split('@')[0]}</p>
              <p className="text-[8px] text-purple-400 font-bold uppercase tracking-widest">Administrator</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-12 overflow-y-auto pb-32">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
              {stats.map((stat, i) => {
                const gradients = [
                  'linear-gradient(135deg, #F472B6, #A855F7)',
                  'linear-gradient(135deg, #4ADE80, #60A5FA)',
                  'linear-gradient(135deg, #FBBF24, #FB923C)',
                  'linear-gradient(135deg, #A855F7, #6366F1)',
                ];
                return (
                  <div key={stat.label} className="bg-white rounded-3xl border border-purple-100 shadow-sm overflow-hidden">
                    <div className="h-1.5 w-full" style={{ background: gradients[i % gradients.length] }} />
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="p-2 bg-purple-50 rounded-xl border border-purple-100">
                          <stat.icon className="w-5 h-5 text-purple-500" />
                        </div>
                        <div className={cn(
                          "flex items-center gap-1 text-[10px] font-bold",
                          stat.up ? "text-green-600" : "text-red-500"
                        )}>
                          {stat.trend}
                          {stat.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        </div>
                      </div>
                      <span className="text-[9px] text-purple-400 uppercase tracking-widest font-bold">{stat.label}</span>
                      <p className="text-3xl font-black mt-1 text-purple-900">{stat.value}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 mb-12">
              <div className="lg:col-span-2">
                <div className="p-8 bg-black text-white rounded-3xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-12 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Zap className="w-32 h-32" />
                  </div>
                  <div className="relative z-10">
                    <h3 className="text-[10px] font-bold uppercase tracking-[0.4em] mb-8 text-zinc-500">AI Intelligence Report</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                      <div>
                        <p className="text-3xl font-bold mb-1 tracking-tighter">94.2%</p>
                        <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-zinc-500">Market Dominance</p>
                      </div>
                      <div>
                        <p className="text-3xl font-bold mb-1 tracking-tighter">1.2s</p>
                        <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-zinc-500">Intake Efficiency</p>
                      </div>
                      <div>
                        <p className="text-3xl font-bold mb-1 tracking-tighter">98.9%</p>
                        <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-zinc-500">Market Accuracy</p>
                      </div>
                    </div>
                    <div className="mt-12 pt-8 border-t border-zinc-800">
                      <p className="text-xs text-zinc-400 leading-relaxed italic">"Aura AI has detected a significant shift in Cape Town's vintage market. Recommend increasing intake of leather outerwear for the upcoming season."</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="lg:col-span-1">
                <div className="p-8 bg-white border border-purple-100 rounded-3xl shadow-sm h-full">
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] mb-8 text-zinc-400">Live Market Feed</h3>
                  <div className="space-y-6">
                    {[
                      { time: '2m ago', event: 'New TikTok Sale', value: 'R1,250.00' },
                      { time: '15m ago', event: 'AI Price Adjustment', value: '+R45.00' },
                      { time: '1h ago', event: 'Inventory Verified', value: '12 Items' },
                      { time: '3h ago', event: 'Campaign Launched', value: 'Social' },
                    ].map((item, i) => (
                      <div key={`feed-${i}`} className="flex items-center justify-between border-b border-purple-50 pb-4 last:border-0">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-tight">{item.event}</p>
                          <p className="text-[8px] text-zinc-400 font-bold uppercase tracking-widest">{item.time}</p>
                        </div>
                        <span className="text-[10px] font-bold text-black">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              <section>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Recent Orders</h2>
                  <button onClick={() => setActiveTab('orders')} className="text-[10px] font-bold text-black hover:underline transition-all uppercase tracking-widest">View All</button>
                </div>
                <div className="space-y-2">
                  {recentOrders.length === 0 ? (
                    <div className="p-12 text-center border border-purple-100 rounded-2xl bg-purple-50">
                      <p className="text-purple-400 text-[10px] font-bold uppercase tracking-widest">No orders yet.</p>
                    </div>
                  ) : (
                    recentOrders.map((order) => (
                      <div key={order.id} className="p-4 bg-white rounded-2xl border border-purple-100 flex items-center gap-4 hover:border-purple-300 transition-colors">
                        <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center border border-purple-100">
                          <ClipboardList className="w-4 h-4 text-purple-400" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-[10px] uppercase tracking-tight">#{order.id.slice(-8)}</h4>
                          <p className="text-[8px] text-zinc-400 font-bold uppercase tracking-widest">{order.userEmail}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-bold">R{order.total}</p>
                          <p className={cn(
                            "text-[8px] font-bold uppercase tracking-widest",
                            order.status === 'delivered' ? "text-green-600" : "text-amber-600"
                          )}>{order.status}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Recent Intake</h2>
                  <button onClick={() => setActiveTab('onboarding')} className="text-[10px] font-bold text-black hover:underline transition-all uppercase tracking-widest">View All</button>
                </div>
                <div className="space-y-2">
                  {products.map((product) => (
                    <div key={product.id} className="p-4 bg-white rounded-2xl border border-purple-100 flex items-center gap-4 hover:border-purple-300 transition-colors">
                      <div className="w-10 h-10 rounded-xl bg-purple-50 overflow-hidden border border-purple-100">
                        <img src={product.imageUrl} className="w-full h-full object-cover" alt="" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-[10px] uppercase tracking-tight">{product.name}</h4>
                        <p className="text-[8px] text-zinc-400 font-bold uppercase tracking-widest">{product.category}</p>
                      </div>
                      <div className={cn(
                        "px-2 py-1 rounded-full text-[8px] font-bold uppercase tracking-widest border",
                        product.status === 'approved' ? "bg-green-50 border-green-100 text-green-600" : 
                        product.status === 'pending' ? "bg-yellow-50 border-yellow-100 text-yellow-600" : "bg-red-50 border-red-100 text-red-600"
                      )}>
                        {product.status}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </motion.div>
        )}

        {activeTab === 'onboarding' && <ProductIntake onSuccess={() => setActiveTab('review')} />}
        {activeTab === 'listings' && <ListingManager />}
        {activeTab === 'review' && <ReviewQueue />}
        {activeTab === 'campaigns' && <CampaignManager />}
        {activeTab === 'orders' && <OrderManager />}
        {activeTab === 'auctions' && <AuctionManager />}
        {activeTab === 'packs' && <PackManager />}
        {activeTab === 'streams' && <LiveStreamManager />}
        {activeTab === 'resources' && <ResourceMonitor />}
        </AnimatePresence>
      </main>
    </div>
  );
}
