import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../../firebase';
import { motion, AnimatePresence } from 'motion/react';
import { ClipboardList, Package, Clock, CheckCircle2, Truck, Search, MapPin, X, LogIn, ShoppingBag } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { signIn } from '../../firebase';

interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl: string;
}

interface Order {
  id: string;
  userId: string;
  items: OrderItem[];
  total: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  createdAt: any;
  trackingNumber?: string;
  shippingInfo: { address: string; city: string; zip: string };
}

interface TrackingInfo {
  status: string;
  location: string;
  estimated_delivery: string;
  history: { status: string; time: string; location: string }[];
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; icon: React.ElementType }> = {
  pending:    { label: 'Pending',    bg: 'bg-zinc-100',    text: 'text-zinc-500',  icon: Package },
  processing: { label: 'Processing', bg: 'bg-amber-50',    text: 'text-amber-600', icon: Clock },
  shipped:    { label: 'Shipped',    bg: 'bg-blue-50',     text: 'text-blue-600',  icon: Truck },
  delivered:  { label: 'Delivered',  bg: 'bg-green-50',    text: 'text-green-600', icon: CheckCircle2 },
  cancelled:  { label: 'Cancelled',  bg: 'bg-red-50',      text: 'text-red-500',   icon: X },
};

const STEPS = ['pending', 'processing', 'shipped', 'delivered'] as const;

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTracking, setSelectedTracking] = useState<{ id: string; info: TrackingInfo } | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!auth.currentUser) { setLoading(false); return; }

    const q = query(
      collection(db, 'orders'),
      where('userId', '==', auth.currentUser.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'orders');
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const handleTrack = async (orderId: string, trackingNumber: string) => {
    try {
      const response = await fetch(`/api/shipping/track/${trackingNumber}`);
      const data = await response.json();
      setSelectedTracking({ id: orderId, info: data });
    } catch (error) {
      console.error('Failed to track order:', error);
    }
  };

  if (!auth.currentUser) {
    return (
      <div className="max-w-lg mx-auto px-4 py-32 text-center">
        <div className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}>
          <LogIn className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-3xl font-black mb-3 gradient-text">Sign in to view orders</h2>
        <p className="text-purple-400 text-sm font-semibold mb-8">Your order history is just a sign-in away.</p>
        <button onClick={signIn} className="btn-primary px-10 py-4 text-base">Sign In with Google</button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="space-y-6">
          {[1, 2, 3].map(i => <div key={i} className="h-40 bg-purple-50 animate-pulse rounded-3xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <header className="mb-10">
        <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-6xl md:text-8xl font-black mb-3 leading-tight gradient-text">
          My Orders
        </motion.h1>
        <p className="text-purple-400 text-sm font-semibold">Track your quirkiness from warehouse to doorstep.</p>
      </header>

      {orders.length === 0 ? (
        <div className="text-center py-32 rounded-3xl border border-purple-100 bg-purple-50">
          <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #A855F7, #6366F1)' }}>
            <ClipboardList className="w-8 h-8 text-white" />
          </div>
          <p className="text-purple-400 font-bold text-sm mb-4">No orders yet</p>
          <button onClick={() => navigate('/')} className="btn-primary px-8 py-3 text-sm">
            <ShoppingBag className="w-4 h-4" />
            Start Shopping
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {orders.map((order) => {
            const status = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
            const StatusIcon = status.icon;
            const currentStepIdx = STEPS.indexOf(order.status as any);

            return (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-3xl border border-purple-100 overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300"
              >
                {/* Order Header */}
                <div className="p-6 bg-purple-50 border-b border-purple-100 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-6">
                    <div>
                      <p className="text-[8px] font-bold text-purple-400 uppercase tracking-widest mb-1">Order</p>
                      <p className="text-xs font-black">#{order.id.slice(-8).toUpperCase()}</p>
                    </div>
                    <div>
                      <p className="text-[8px] font-bold text-purple-400 uppercase tracking-widest mb-1">Date</p>
                      <p className="text-xs font-bold">{order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString() : 'Just now'}</p>
                    </div>
                    <div>
                      <p className="text-[8px] font-bold text-purple-400 uppercase tracking-widest mb-1">Total</p>
                      <p className="text-sm font-black gradient-text">R{order.total}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={cn('px-3 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-widest flex items-center gap-1.5', status.bg, status.text)}>
                      <StatusIcon className="w-3 h-3" />
                      {status.label}
                    </span>
                    {order.status === 'shipped' && order.trackingNumber && (
                      <button onClick={() => handleTrack(order.id, order.trackingNumber!)} className="btn-primary px-4 py-2 text-xs">
                        <Search className="w-3 h-3" />
                        Track
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                {order.status !== 'cancelled' && (
                  <div className="px-8 py-6 border-b border-purple-50">
                    <div className="flex items-center justify-between max-w-lg relative">
                      <div className="absolute left-5 right-5 top-5 h-1 bg-purple-100 rounded-full" />
                      <div
                        className="absolute left-5 top-5 h-1 rounded-full transition-all duration-1000"
                        style={{
                          width: currentStepIdx <= 0 ? '0%' : currentStepIdx === 1 ? '33%' : currentStepIdx === 2 ? '66%' : '100%',
                          background: 'linear-gradient(90deg, #F472B6, #A855F7)',
                          right: 'auto',
                        }}
                      />
                      {[
                        { id: 'pending', icon: Package, label: 'Placed' },
                        { id: 'processing', icon: Clock, label: 'Processing' },
                        { id: 'shipped', icon: Truck, label: 'Shipped' },
                        { id: 'delivered', icon: CheckCircle2, label: 'Delivered' },
                      ].map((step, i) => {
                        const stepIdx = STEPS.indexOf(step.id as any);
                        const done = stepIdx <= currentStepIdx;
                        const Icon = step.icon;
                        return (
                          <div key={step.id} className="relative z-10 flex flex-col items-center gap-2">
                            <div className={cn(
                              'w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all',
                              done ? 'border-transparent text-white' : 'border-purple-100 bg-white text-purple-200'
                            )} style={done ? { background: 'linear-gradient(135deg, #F472B6, #A855F7)' } : {}}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <span className={cn('text-[8px] font-bold uppercase tracking-widest', done ? 'text-purple-600' : 'text-purple-200')}>
                              {step.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Items */}
                <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 space-y-3">
                    {order.items.map((item) => (
                      <div key={item.id} className="flex items-center gap-4 p-3 bg-purple-50 rounded-2xl">
                        <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-white">
                          <img src={item.imageUrl} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
                        </div>
                        <div className="flex-1">
                          <h4 className="text-sm font-bold truncate">{item.name}</h4>
                          <p className="text-[9px] text-purple-400 font-bold">Qty: {item.quantity}</p>
                        </div>
                        <p className="font-black text-sm">R{item.price * item.quantity}</p>
                      </div>
                    ))}
                  </div>

                  <div className="bg-purple-50 rounded-2xl p-5">
                    <h4 className="text-[9px] font-bold text-purple-400 uppercase tracking-widest mb-3">Shipping to</h4>
                    <div className="flex gap-3">
                      <MapPin className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
                      <p className="text-sm font-semibold text-purple-800 leading-relaxed">
                        {order.shippingInfo?.address}<br />
                        {order.shippingInfo?.city}, {order.shippingInfo?.zip}
                      </p>
                    </div>
                    <div className="mt-4 pt-4 border-t border-purple-100 flex items-center gap-2 text-purple-400">
                      <Truck className="w-4 h-4" />
                      <div>
                        <p className="text-[9px] font-bold text-purple-600">The Courier Guy</p>
                        <p className="text-[8px] font-bold text-purple-400">Economy · 3–5 Days</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tracking Overlay */}
                <AnimatePresence>
                  {selectedTracking?.id === order.id && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-white/95 backdrop-blur-sm z-50 p-8 overflow-y-auto rounded-3xl">
                      <div className="flex items-center justify-between mb-8">
                        <h3 className="text-xl font-black gradient-text">Live Tracking</h3>
                        <button onClick={() => setSelectedTracking(null)} className="p-2 rounded-full hover:bg-purple-50 text-purple-400">
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                          <div className="p-5 bg-purple-50 rounded-2xl">
                            <p className="text-[9px] font-bold text-purple-400 uppercase mb-1">Status</p>
                            <p className="text-lg font-black gradient-text">{selectedTracking.info.status}</p>
                          </div>
                          <div className="p-5 bg-purple-50 rounded-2xl">
                            <p className="text-[9px] font-bold text-purple-400 uppercase mb-1">Est. Delivery</p>
                            <p className="text-lg font-black">{new Date(selectedTracking.info.estimated_delivery).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div>
                          <h4 className="text-[9px] font-bold text-purple-400 uppercase tracking-widest mb-4">History</h4>
                          <div className="space-y-4 relative">
                            <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-purple-100" />
                            {selectedTracking.info.history.map((event, i) => (
                              <div key={i} className="relative pl-7">
                                <div className={cn('absolute left-0 top-1 w-4 h-4 rounded-full border-2 bg-white', i === 0 ? 'border-purple-500' : 'border-purple-200')} />
                                <p className="text-sm font-bold">{event.status}</p>
                                <p className="text-[9px] text-purple-400 font-bold">{event.location} · {event.time}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
