import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Database, Zap, HardDrive, AlertTriangle, CheckCircle2, Activity, RefreshCw, ShoppingBag, Users, Package } from 'lucide-react';
import { cn } from '../../lib/utils';
import { supabase } from '../../supabase';
import { collection, getCountFromServer } from 'firebase/firestore';
import { db } from '../../firebase';

interface SupabaseStats {
  products: number;
  orders: number;
  profiles: number;
  pendingProducts: number;
}

interface FirestoreStats {
  auctions: number;
  notifications: number;
}

interface ServiceHealth {
  supabase: 'ok' | 'error' | 'loading';
  firebase: 'ok' | 'error' | 'loading';
  gemini: 'ok' | 'unknown';
  yoco: 'ok' | 'unknown';
  resend: 'ok' | 'unknown';
}

export default function ResourceMonitor() {
  const [supabaseStats, setSupabaseStats] = useState<SupabaseStats | null>(null);
  const [firestoreStats, setFirestoreStats] = useState<FirestoreStats | null>(null);
  const [health, setHealth] = useState<ServiceHealth>({
    supabase: 'loading',
    firebase: 'loading',
    gemini: 'unknown',
    yoco: 'unknown',
    resend: 'unknown',
  });
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    setRefreshing(true);

    // Supabase stats
    try {
      const [
        { count: products },
        { count: orders },
        { count: profiles },
        { count: pendingProducts },
      ] = await Promise.all([
        supabase.from('products').select('*', { count: 'exact', head: true }),
        supabase.from('orders').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('products').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      ]);
      setSupabaseStats({
        products: products ?? 0,
        orders: orders ?? 0,
        profiles: profiles ?? 0,
        pendingProducts: pendingProducts ?? 0,
      });
      setHealth(prev => ({ ...prev, supabase: 'ok' }));
    } catch {
      setHealth(prev => ({ ...prev, supabase: 'error' }));
    }

    // Firestore stats
    try {
      const [auctionSnap, notifSnap] = await Promise.all([
        getCountFromServer(collection(db, 'auctions')),
        getCountFromServer(collection(db, 'notifications')),
      ]);
      setFirestoreStats({
        auctions: auctionSnap.data().count,
        notifications: notifSnap.data().count,
      });
      setHealth(prev => ({ ...prev, firebase: 'ok' }));
    } catch {
      setHealth(prev => ({ ...prev, firebase: 'error' }));
    }

    // Health endpoint for external services
    try {
      const resp = await fetch('/api/health');
      if (resp.ok) {
        const data = await resp.json();
        setHealth(prev => ({
          ...prev,
          gemini: data.services?.gemini === 'ok' ? 'ok' : 'unknown',
          yoco: data.services?.yoco === 'ok' ? 'ok' : 'unknown',
          resend: data.services?.resend === 'ok' ? 'ok' : 'unknown',
        }));
      }
    } catch {
      // health endpoint optional
    }

    setLastRefreshed(new Date());
    setRefreshing(false);
  };

  useEffect(() => { loadData(); }, []);

  const statusDot = (s: 'ok' | 'error' | 'loading' | 'unknown') => {
    if (s === 'ok') return <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />;
    if (s === 'error') return <span className="w-2 h-2 rounded-full bg-red-500 inline-block animate-pulse" />;
    if (s === 'loading') return <span className="w-2 h-2 rounded-full bg-gray-300 inline-block animate-pulse" />;
    return <span className="w-2 h-2 rounded-full bg-gray-300 inline-block" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-purple-500" />
          <h2 className="text-sm font-bold text-gray-900">Resource Monitor</h2>
        </div>
        <button
          onClick={loadData}
          disabled={refreshing}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-purple-600 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Supabase DB Stats */}
      <div>
        <p className="section-label mb-3 flex items-center gap-1.5">
          <Database className="w-3 h-3" /> Supabase Database
          <span className="ml-1">{statusDot(health.supabase)}</span>
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Products', value: supabaseStats?.products, icon: Package, color: 'text-purple-600', bg: 'bg-purple-50' },
            { label: 'Pending Review', value: supabaseStats?.pendingProducts, icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50' },
            { label: 'Orders', value: supabaseStats?.orders, icon: ShoppingBag, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Profiles', value: supabaseStats?.profiles, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm"
            >
              <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center mb-2', bg)}>
                <Icon className={cn('w-3.5 h-3.5', color)} />
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {value == null ? <span className="text-gray-200 text-base">—</span> : value.toLocaleString()}
              </p>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mt-0.5">{label}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Firestore Stats */}
      <div>
        <p className="section-label mb-3 flex items-center gap-1.5">
          <Zap className="w-3 h-3" /> Firestore (Real-time)
          <span className="ml-1">{statusDot(health.firebase)}</span>
        </p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Total Auctions', value: firestoreStats?.auctions },
            { label: 'Notifications', value: firestoreStats?.notifications },
          ].map(({ label, value }) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm"
            >
              <p className="text-2xl font-bold text-gray-900">
                {value == null ? <span className="text-gray-200 text-base">—</span> : value.toLocaleString()}
              </p>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mt-0.5">{label}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Service Health */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
        <h3 className="section-label mb-4 flex items-center gap-1.5">
          <HardDrive className="w-3 h-3" /> External Services
        </h3>
        <div className="space-y-3">
          {[
            { name: 'Supabase (Auth + DB)', status: health.supabase, note: 'Row-level security active' },
            { name: 'Firebase (Firestore + Storage)', status: health.firebase, note: 'Real-time auctions & images' },
            { name: 'Gemini AI', status: health.gemini, note: 'Product identification & campaigns' },
            { name: 'Yoco Payments', status: health.yoco, note: 'ZAR checkout gateway' },
            { name: 'Resend (Email)', status: health.resend, note: 'Order confirmation emails' },
          ].map(({ name, status, note }) => (
            <div key={name} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
              <div>
                <p className="text-sm font-semibold text-gray-800">{name}</p>
                <p className="text-xs text-gray-400">{note}</p>
              </div>
              <div className="flex items-center gap-1.5">
                {statusDot(status)}
                <span className={cn(
                  'text-xs font-semibold',
                  status === 'ok' ? 'text-green-600' :
                  status === 'error' ? 'text-red-600' :
                  status === 'loading' ? 'text-gray-400' : 'text-gray-300'
                )}>
                  {status === 'loading' ? 'Checking…' : status === 'unknown' ? 'Unknown' : status.toUpperCase()}
                </span>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-gray-400 mt-3">
          Last refreshed: {lastRefreshed.toLocaleTimeString()}
        </p>
      </div>

      {/* Feature Status */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
        <h3 className="section-label mb-4">Feature Status</h3>
        <div className="space-y-4">
          {[
            { name: 'Live Auctions', status: 'Active', description: 'Real-time Firestore bidding engine' },
            { name: 'AI Product Intake', status: 'Active', description: 'Gemini vision analysis & tagging' },
            { name: 'Yoco Checkout', status: 'Active', description: 'Hosted payment page + webhooks' },
            { name: 'TCG Shipping', status: 'Active', description: 'Live rate quotes & tracking' },
            { name: 'Email Notifications', status: 'Active', description: 'Paid, shipped & delivered emails via Resend' },
            { name: 'Social Integration', status: 'Coming Soon', description: 'TikTok & WhatsApp direct orders' },
            { name: 'Live Streaming', status: 'Coming Soon', description: 'WebRTC broadcast rooms' },
          ].map((feature) => (
            <div key={feature.name} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">{feature.name}</p>
                <p className="text-xs text-gray-400">{feature.description}</p>
              </div>
              <span className={cn(
                'text-xs font-semibold px-2.5 py-1 rounded-full',
                feature.status === 'Active'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-500'
              )}>
                {feature.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Alerts */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
        <h3 className="section-label mb-4">System Alerts</h3>
        <div className="space-y-3">
          {supabaseStats?.pendingProducts && supabaseStats.pendingProducts > 0 ? (
            <div className="flex items-start gap-3 rounded-lg p-3 border text-xs bg-orange-50 border-orange-100 text-orange-700">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold">{supabaseStats.pendingProducts} product{supabaseStats.pendingProducts !== 1 ? 's' : ''} pending review</p>
                <p className="text-[10px] opacity-60 mt-0.5">Go to Review Queue to approve or reject</p>
              </div>
            </div>
          ) : null}
          <div className="flex items-start gap-3 rounded-lg p-3 border text-xs bg-green-50 border-green-100 text-green-700">
            <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold">All core services operational</p>
              <p className="text-[10px] opacity-60 mt-0.5">Payments, inventory and orders running normally</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
