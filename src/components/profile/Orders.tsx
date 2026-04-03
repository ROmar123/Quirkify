import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../../firebase';
import { motion, AnimatePresence } from 'motion/react';
import { ClipboardList, Package, Clock, CheckCircle2, Truck, AlertCircle, Search, MapPin, Calendar, ChevronRight, X } from 'lucide-react';
import { cn } from '../../lib/utils';

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
  shippingInfo: {
    address: string;
    city: string;
    zip: string;
  };
}

interface TrackingInfo {
  status: string;
  location: string;
  estimated_delivery: string;
  history: { status: string; time: string; location: string }[];
}

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTracking, setSelectedTracking] = useState<{ id: string, info: TrackingInfo } | null>(null);
  const [trackingLoading, setTrackingLoading] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;

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
    setTrackingLoading(true);
    try {
      const response = await fetch(`/api/shipping/track/${trackingNumber}`);
      const data = await response.json();
      setSelectedTracking({ id: orderId, info: data });
    } catch (error) {
      console.error('Failed to track order:', error);
    } finally {
      setTrackingLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="animate-pulse space-y-8">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-48 bg-zinc-50 border border-zinc-100" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <header className="mb-12">
        <h1 className="text-6xl font-bold tracking-tighter uppercase font-display">MY <span className="text-quirky italic">ORDERS.</span></h1>
        <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.4em] mt-4">Track your quirkiness from warehouse to doorstep.</p>
      </header>

      {orders.length === 0 ? (
        <div className="text-center py-32 border border-zinc-100 bg-zinc-50">
          <ClipboardList className="w-12 h-12 mx-auto mb-4 text-zinc-300" />
          <p className="text-zinc-400 font-bold uppercase tracking-widest text-xs">No orders found.</p>
        </div>
      ) : (
        <div className="space-y-12">
          {orders.map((order) => (
            <motion.div 
              key={order.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border border-zinc-100 overflow-hidden group hover:shadow-2xl transition-all duration-500"
            >
              <div className="p-8 border-b border-zinc-100 bg-zinc-50 flex flex-wrap items-center justify-between gap-8">
                <div className="flex items-center gap-12">
                  <div>
                    <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Order Reference</p>
                    <p className="text-xs font-bold uppercase tracking-tight">#{order.id.slice(-12)}</p>
                  </div>
                  <div>
                    <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Date Placed</p>
                    <p className="text-xs font-bold uppercase tracking-tight">
                      {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString() : 'Just now'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Order Total</p>
                    <p className="text-xs font-bold uppercase tracking-tight text-quirky">R{order.total}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "px-4 py-1.5 text-[8px] font-bold uppercase tracking-widest flex items-center gap-2 border",
                    order.status === 'delivered' ? "bg-green-50 text-green-600 border-green-100" :
                    order.status === 'shipped' ? "bg-blue-50 text-blue-600 border-blue-100" :
                    order.status === 'processing' ? "bg-amber-50 text-amber-600 border-amber-100" :
                    "bg-zinc-100 text-zinc-500 border-zinc-200"
                  )}>
                    {order.status === 'delivered' && <CheckCircle2 className="w-3 h-3" />}
                    {order.status === 'shipped' && <Truck className="w-3 h-3" />}
                    {order.status === 'processing' && <Clock className="w-3 h-3" />}
                    {order.status === 'pending' && <Package className="w-3 h-3" />}
                    {order.status}
                  </div>
                  
                  {order.status === 'shipped' && order.trackingNumber && (
                    <button 
                      onClick={() => handleTrack(order.id, order.trackingNumber!)}
                      className="px-4 py-1.5 bg-black text-white text-[8px] font-bold uppercase tracking-widest hover:bg-quirky transition-all flex items-center gap-2"
                    >
                      <Search className="w-3 h-3" />
                      Track Shipment
                    </button>
                  )}
                </div>
              </div>

              <div className="px-8 py-12 border-b border-zinc-100 bg-white">
                <div className="flex items-center justify-between max-w-3xl mx-auto relative">
                  <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-0.5 bg-zinc-100 z-0" />
                  <div 
                    className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-quirky z-0 transition-all duration-1000" 
                    style={{ 
                      width: order.status === 'delivered' ? '100%' : 
                             order.status === 'shipped' ? '66%' : 
                             order.status === 'processing' ? '33%' : '0%' 
                    }} 
                  />
                  
                  {[
                    { id: 'pending', icon: Package, label: 'Placed' },
                    { id: 'processing', icon: Clock, label: 'Processing' },
                    { id: 'shipped', icon: Truck, label: 'Shipped' },
                    { id: 'delivered', icon: CheckCircle2, label: 'Delivered' }
                  ].map((step, i) => {
                    const steps = ['pending', 'processing', 'shipped', 'delivered'];
                    const currentIdx = steps.indexOf(order.status);
                    const stepIdx = steps.indexOf(step.id);
                    const isCompleted = stepIdx <= currentIdx;
                    const isCurrent = stepIdx === currentIdx;

                    return (
                      <div key={step.id} className="relative z-10 flex flex-col items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-500",
                          isCompleted ? "bg-black border-black text-white" : "bg-white border-zinc-100 text-zinc-300",
                          isCurrent && "ring-8 ring-quirky/10"
                        )}>
                          <step.icon className="w-4 h-4" />
                        </div>
                        <span className={cn(
                          "text-[8px] font-bold uppercase tracking-widest",
                          isCompleted ? "text-black" : "text-zinc-300"
                        )}>
                          {step.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="p-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                  <div className="lg:col-span-2 space-y-6">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-4">Order Items</h4>
                    {order.items.map((item) => (
                      <div key={item.id} className="flex items-center gap-6 p-4 border border-zinc-50 hover:border-zinc-100 transition-colors">
                        <div className="w-20 h-20 bg-zinc-50 border border-zinc-100 flex-shrink-0 overflow-hidden">
                          <img src={item.imageUrl} className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-500" alt="" referrerPolicy="no-referrer" />
                        </div>
                        <div className="flex-1">
                          <h4 className="text-xs font-bold uppercase tracking-tight mb-1">{item.name}</h4>
                          <p className="text-[8px] text-zinc-400 font-bold uppercase tracking-widest">Quantity: {item.quantity}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold">R{item.price * item.quantity}</p>
                          <p className="text-[8px] text-zinc-400 font-bold uppercase tracking-widest">R{item.price} each</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-8">
                    <div className="bg-zinc-50 p-8 border border-zinc-100">
                      <h4 className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest mb-6">Delivery Address</h4>
                      <div className="flex gap-4">
                        <MapPin className="w-4 h-4 text-quirky flex-shrink-0" />
                        <p className="text-[10px] font-bold uppercase leading-relaxed">
                          {order.shippingInfo.address}<br />
                          {order.shippingInfo.city}, {order.shippingInfo.zip}
                        </p>
                      </div>
                      
                      <div className="mt-8 pt-8 border-t border-zinc-200">
                        <div className="flex items-center gap-4 text-zinc-400">
                          <Truck className="w-4 h-4" />
                          <div>
                            <p className="text-[8px] font-bold uppercase tracking-widest text-black">The Courier Guy</p>
                            <p className="text-[8px] font-bold uppercase tracking-widest">Economy Service • 3-5 Days</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {order.status === 'delivered' && (
                      <div className="p-6 bg-green-50 border border-green-100 flex items-center gap-4">
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                        <p className="text-[8px] font-bold uppercase tracking-widest text-green-600">This order was successfully delivered.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Tracking Modal Overlay */}
              <AnimatePresence>
                {selectedTracking?.id === order.id && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-white/95 backdrop-blur-sm z-50 p-8 overflow-y-auto"
                  >
                    <div className="max-w-2xl mx-auto">
                      <div className="flex items-center justify-between mb-12">
                        <h3 className="text-2xl font-bold tracking-tighter uppercase font-display">Live <span className="text-quirky italic">Tracking.</span></h3>
                        <button onClick={() => setSelectedTracking(null)} className="p-2 hover:bg-zinc-100 transition-colors">
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-12">
                        <div className="space-y-6">
                          <div className="p-6 bg-zinc-50 border border-zinc-100">
                            <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Current Status</p>
                            <p className="text-xl font-bold uppercase text-quirky">{selectedTracking.info.status}</p>
                          </div>
                          <div className="p-6 bg-zinc-50 border border-zinc-100">
                            <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Estimated Delivery</p>
                            <p className="text-xl font-bold uppercase">{new Date(selectedTracking.info.estimated_delivery).toLocaleDateString()}</p>
                          </div>
                        </div>
                        
                        <div className="space-y-8">
                          <h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Tracking History</h4>
                          <div className="space-y-8 relative">
                            <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-zinc-100" />
                            {selectedTracking.info.history.map((event, i) => (
                              <div key={i} className="relative pl-8">
                                <div className={cn(
                                  "absolute left-0 top-1 w-4 h-4 rounded-full border-2 bg-white",
                                  i === 0 ? "border-quirky" : "border-zinc-200"
                                )} />
                                <p className="text-[10px] font-bold uppercase tracking-tight">{event.status}</p>
                                <p className="text-[8px] text-zinc-400 font-bold uppercase tracking-widest mt-1">{event.location} • {event.time}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-center">
                        <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest">Powered by The Courier Guy API</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
