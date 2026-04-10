import { useEffect, useMemo, useState } from 'react';
import { auth, onAuthStateChanged, type AuthUser } from '../../firebase';
import {
  LogIn,
  ShoppingBag,
  Package,
  Truck,
  CheckCircle,
  Clock,
  XCircle,
  ArrowRight,
  MapPin,
  ShieldCheck,
  Radar,
  Sparkles,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchOrderDetail, fetchOrders, Order, OrderDetail, OrderEvent } from '../../services/orderService';
import { getProfileByUid } from '../../services/profileService';
import { fetchShipmentTracking, ShipmentTracking } from '../../services/shippingService';
import { cn } from '../../lib/utils';

const STATUS_CONFIG: Record<string, { label: string; color: string; accent: string; icon: any }> = {
  pending: { label: 'Pending', color: 'bg-amber-100 text-amber-700', accent: 'from-amber-300 to-orange-400', icon: Clock },
  paid: { label: 'Paid', color: 'bg-blue-100 text-blue-700', accent: 'from-sky-400 to-indigo-500', icon: CheckCircle },
  processing: { label: 'Processing', color: 'bg-purple-100 text-purple-700', accent: 'from-violet-400 to-fuchsia-500', icon: Package },
  shipped: { label: 'Shipped', color: 'bg-indigo-100 text-indigo-700', accent: 'from-indigo-400 to-cyan-500', icon: Truck },
  delivered: { label: 'Delivered', color: 'bg-green-100 text-green-700', accent: 'from-emerald-400 to-teal-500', icon: CheckCircle },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-700', accent: 'from-rose-400 to-red-500', icon: XCircle },
  refunded: { label: 'Refunded', color: 'bg-gray-100 text-gray-700', accent: 'from-slate-400 to-gray-500', icon: XCircle },
  payment_failed: { label: 'Payment Failed', color: 'bg-red-100 text-red-700', accent: 'from-rose-400 to-red-500', icon: XCircle },
};

const ORDER_STEPS = ['pending', 'paid', 'processing', 'shipped', 'delivered'] as const;

function formatMoney(value: number) {
  return `R${value.toLocaleString()}`;
}

function formatEventLabel(event: OrderEvent) {
  return event.note || event.eventType.replace(/_/g, ' ');
}

export default function Orders() {
  const [user, setUser] = useState<AuthUser | null>(auth.currentUser);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null);
  const [tracking, setTracking] = useState<ShipmentTracking | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    let cancelled = false;

    if (!user) {
      setOrders([]);
      setError(null);
      setLoading(false);
      return;
    }

    const loadOrders = async () => {
      setLoading(true);
      setError(null);
      try {
        const profile = await getProfileByUid(user.uid);
        if (cancelled) return;
        if (!profile) {
          setOrders([]);
          return;
        }
        const data = await fetchOrders({ profileId: profile.id });
        if (!cancelled) {
          setOrders(data);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || 'Failed to load orders');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadOrders();

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    let cancelled = false;

    if (!selectedOrderId) {
      setSelectedOrder(null);
      setTracking(null);
      return;
    }

    const loadDetail = async () => {
      setDetailLoading(true);
      try {
        const detail = await fetchOrderDetail(selectedOrderId);
        if (cancelled) return;
        setSelectedOrder(detail);

        if (detail?.trackingNumber) {
          setTrackingLoading(true);
          try {
            const trackingData = await fetchShipmentTracking(detail.trackingNumber);
            if (!cancelled) {
              setTracking(trackingData);
            }
          } catch {
            if (!cancelled) {
              setTracking(null);
            }
          } finally {
            if (!cancelled) {
              setTrackingLoading(false);
            }
          }
        } else {
          setTracking(null);
        }
      } finally {
        if (!cancelled) {
          setDetailLoading(false);
        }
      }
    };

    void loadDetail();

    return () => {
      cancelled = true;
    };
  }, [selectedOrderId]);

  const headlineStats = useMemo(() => {
    const paidOrders = orders.filter((order) => ['paid', 'processing', 'shipped', 'delivered'].includes(order.status));
    const inFlightOrders = orders.filter((order) => ['processing', 'shipped'].includes(order.status));

    return {
      totalSpend: paidOrders.reduce((sum, order) => sum + order.total, 0),
      activeOrders: inFlightOrders.length,
      totalOrders: orders.length,
    };
  }, [orders]);

  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 pb-32 text-center md:py-32 md:pb-20">
        <div className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}>
          <LogIn className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-3xl font-black mb-3 text-purple-900">Sign in to view orders</h2>
        <p className="text-purple-400 text-sm font-semibold mb-8">Your order history is just a sign-in away.</p>
        <button onClick={() => navigate('/auth?next=%2Forders')} className="px-10 py-4 rounded-full font-bold text-white text-base" style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}>
          Sign In or Create Account
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 pb-32 md:pb-12">
        <div className="space-y-6">
          {[1, 2, 3].map((i) => <div key={i} className="h-40 bg-purple-50 animate-pulse rounded-3xl" />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 pb-32 text-center md:py-32 md:pb-20">
        <div className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center bg-red-50">
          <ShoppingBag className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-3xl font-black mb-3 text-red-600">Error loading orders</h2>
        <p className="text-red-400 text-sm font-semibold mb-8">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 pb-32 md:pb-12">
      <section className="rounded-[2rem] border border-white/50 px-6 py-8 shadow-[0_24px_80px_rgba(109,40,217,0.14)] text-white" style={{ background: 'linear-gradient(135deg, #2D1B69 0%, #7C3AED 46%, #EC4899 100%)' }}>
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.35em] text-pink-100/80">Order Command</p>
            <h1 className="mt-4 text-4xl sm:text-6xl font-black leading-none">Every order, one clean truth.</h1>
            <p className="mt-4 max-w-2xl text-sm sm:text-base font-semibold text-white/80">
              Track payment confirmation, fulfilment progress, and delivery signals without bouncing between fragmented screens.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ['Total spend', formatMoney(headlineStats.totalSpend)],
              ['Active fulfilment', String(headlineStats.activeOrders)],
              ['Orders placed', String(headlineStats.totalOrders)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-3xl border border-white/15 bg-white/10 px-5 py-4 backdrop-blur-sm">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-pink-100/75">{label}</p>
                <p className="mt-2 text-2xl font-black">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {orders.length === 0 ? (
        <div className="mt-8 text-center py-32 rounded-3xl border border-purple-100 bg-purple-50">
          <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #A855F7, #6366F1)' }}>
            <ShoppingBag className="w-8 h-8 text-white" />
          </div>
          <p className="text-purple-400 font-bold text-sm mb-4">No orders yet</p>
          <button onClick={() => navigate('/')} className="px-8 py-3 rounded-full font-bold text-white text-sm" style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}>
            Start Shopping
          </button>
        </div>
      ) : (
        <div className="mt-8 grid gap-5">
          {orders.map((order) => {
            const statusInfo = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
            const StatusIcon = statusInfo.icon;
            const activeStep = ORDER_STEPS.indexOf((ORDER_STEPS.includes(order.status as any) ? order.status : 'pending') as typeof ORDER_STEPS[number]);

            return (
              <div key={order.id} className="rounded-[2rem] border border-purple-100 bg-white p-6 shadow-[0_18px_60px_rgba(168,85,247,0.08)]">
                <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black', statusInfo.color)}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {statusInfo.label}
                      </span>
                      <span className="text-[11px] font-black uppercase tracking-[0.28em] text-purple-300">{order.channel}</span>
                    </div>
                    <div className="mt-4 flex flex-wrap items-end gap-x-8 gap-y-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-purple-300">Order Number</p>
                        <p className="mt-1 text-xl font-black text-purple-950">{order.orderNumber}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-purple-300">Placed</p>
                        <p className="mt-1 text-sm font-bold text-purple-700">
                          {new Date(order.createdAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-purple-300">Total</p>
                        <p className="mt-1 text-xl font-black text-purple-950">{formatMoney(order.total)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[26rem]">
                    <div className="rounded-3xl bg-purple-50 px-4 py-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-purple-300">Items</p>
                      <p className="mt-2 text-base font-black text-purple-900">{order.items.length}</p>
                    </div>
                    <div className="rounded-3xl bg-purple-50 px-4 py-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-purple-300">Payment</p>
                      <p className="mt-2 text-base font-black text-purple-900">{order.paymentMethod?.toUpperCase() || 'Pending'}</p>
                    </div>
                    <button
                      onClick={() => setSelectedOrderId(order.id)}
                      className="rounded-3xl px-4 py-3 text-left text-white shadow-lg"
                      style={{ background: 'linear-gradient(135deg, #F472B6, #7C3AED)' }}
                    >
                      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-pink-100/80">Open</p>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-base font-black">View detail</span>
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </button>
                  </div>
                </div>

                <div className="mt-6 grid gap-3 md:grid-cols-5">
                  {ORDER_STEPS.map((status, index) => {
                    const done = index <= activeStep;
                    const config = STATUS_CONFIG[status];
                    const Icon = config.icon;
                    return (
                      <div key={status} className={cn('rounded-3xl border px-4 py-4', done ? 'border-transparent text-white' : 'border-purple-100 bg-purple-50 text-purple-400')} style={done ? { background: `linear-gradient(135deg, ${index < activeStep ? '#7C3AED' : '#EC4899'}, #4F46E5)` } : {}}>
                        <Icon className="w-5 h-5" />
                        <p className="mt-3 text-xs font-black uppercase tracking-[0.24em]">{config.label}</p>
                      </div>
                    );
                  })}
                </div>

                {order.trackingNumber && (
                  <div className="mt-5 rounded-3xl border border-indigo-100 bg-indigo-50 px-5 py-4 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-3">
                      <Radar className="w-4 h-4 text-indigo-500" />
                      <div>
                        <p className="text-sm font-black text-indigo-700">Tracking {order.trackingNumber}</p>
                        <p className="text-[11px] font-bold text-indigo-400">{order.carrier || 'Carrier assigned'}</p>
                      </div>
                    </div>
                    <button onClick={() => setSelectedOrderId(order.id)} className="text-xs font-black text-indigo-600 hover:text-indigo-700">
                      Open tracking view
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {selectedOrderId && (
        <div className="fixed inset-0 z-[100] bg-[rgba(45,27,105,0.35)] backdrop-blur-md p-4 overflow-y-auto" onClick={(event) => {
          if (event.target === event.currentTarget) {
            setSelectedOrderId(null);
          }
        }}>
          <div className="min-h-full flex items-center justify-center">
            <div className="w-full max-w-4xl rounded-[2rem] bg-white shadow-[0_40px_120px_rgba(45,27,105,0.22)] overflow-hidden">
              <div className="px-6 py-5 text-white" style={{ background: 'linear-gradient(135deg, #2D1B69 0%, #7C3AED 48%, #EC4899 100%)' }}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-pink-100/75">Order detail</p>
                    <h2 className="mt-2 text-2xl font-black">{selectedOrder?.orderNumber || 'Loading order...'}</h2>
                    <p className="mt-2 text-sm font-semibold text-white/80">Payment, fulfilment, and delivery signals in one place.</p>
                  </div>
                  <button onClick={() => setSelectedOrderId(null)} className="rounded-full bg-white/15 px-4 py-2 text-sm font-black">Close</button>
                </div>
              </div>

              {detailLoading || !selectedOrder ? (
                <div className="p-8">
                  <div className="h-56 rounded-3xl bg-purple-50 animate-pulse" />
                </div>
              ) : (
                <div className="p-6 space-y-6">
                  <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                    <div className="rounded-3xl border border-purple-100 bg-purple-50 p-5">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-purple-500" />
                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-purple-400">Order narrative</p>
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-purple-300">Customer</p>
                          <p className="mt-1 text-sm font-black text-purple-900">{selectedOrder.customerName}</p>
                          <p className="text-xs font-semibold text-purple-500">{selectedOrder.customerEmail}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-purple-300">Destination</p>
                          <p className="mt-1 text-sm font-black text-purple-900">{selectedOrder.shippingCity || 'Awaiting fulfilment'}</p>
                          <p className="text-xs font-semibold text-purple-500">{selectedOrder.shippingAddress || 'Shipping address on order record'}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-purple-300">Total</p>
                          <p className="mt-1 text-sm font-black text-purple-900">{formatMoney(selectedOrder.total)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-purple-300">Current status</p>
                          <p className="mt-1 text-sm font-black text-purple-900">{STATUS_CONFIG[selectedOrder.status]?.label || selectedOrder.status}</p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-3xl border border-indigo-100 bg-indigo-50 p-5">
                      <div className="flex items-center gap-2">
                        <Truck className="w-4 h-4 text-indigo-500" />
                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-indigo-400">Tracking console</p>
                      </div>
                      {selectedOrder.trackingNumber ? (
                        <div className="mt-4 space-y-3">
                          <div>
                            <p className="text-sm font-black text-indigo-800">{selectedOrder.trackingNumber}</p>
                            <p className="text-xs font-semibold text-indigo-500">{selectedOrder.carrier || 'The Courier Guy'}</p>
                          </div>
                          {trackingLoading ? (
                            <p className="text-sm font-bold text-indigo-500">Refreshing carrier sync...</p>
                          ) : tracking ? (
                            <>
                              <p className="text-sm font-black text-indigo-800">{tracking.status_label}</p>
                              <p className="text-xs font-semibold text-indigo-500">{tracking.message}</p>
                              {tracking.estimated_delivery && (
                                <p className="text-xs font-bold text-indigo-600">ETA {tracking.estimated_delivery}</p>
                              )}
                            </>
                          ) : (
                            <p className="text-sm font-semibold text-indigo-500">Tracking has been assigned. Carrier sync details will appear here.</p>
                          )}
                        </div>
                      ) : (
                        <div className="mt-4">
                          <p className="text-sm font-black text-indigo-800">Tracking not assigned yet</p>
                          <p className="text-xs font-semibold text-indigo-500">Operations will add the Courier Guy tracking reference once the order is dispatched.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                    <div className="rounded-3xl border border-purple-100 p-5">
                      <div className="flex items-center gap-2">
                        <ShoppingBag className="w-4 h-4 text-purple-500" />
                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-purple-400">Items</p>
                      </div>
                      <div className="mt-4 space-y-3">
                        {selectedOrder.items.map((item) => (
                          <div key={item.id} className="flex items-center gap-3 rounded-2xl bg-purple-50 px-4 py-3">
                            {item.productImageUrl ? (
                              <img src={item.productImageUrl} alt={item.productName} className="h-12 w-12 rounded-2xl object-cover" />
                            ) : (
                              <div className="h-12 w-12 rounded-2xl bg-white border border-purple-100 flex items-center justify-center">
                                <Package className="w-5 h-5 text-purple-300" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-black text-purple-900 truncate">{item.productName}</p>
                              <p className="text-[11px] font-semibold text-purple-500">Qty {item.quantity} · {formatMoney(item.unitPrice)}</p>
                            </div>
                            <p className="text-sm font-black text-purple-900">{formatMoney(item.lineTotal)}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-3xl border border-purple-100 p-5">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-purple-500" />
                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-purple-400">Timeline</p>
                      </div>
                      <div className="mt-4 space-y-4">
                        {selectedOrder.events.length > 0 ? selectedOrder.events.map((event) => (
                          <div key={event.id} className="relative pl-6">
                            <span className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full bg-purple-400" />
                            <div className="rounded-2xl bg-purple-50 px-4 py-3">
                              <p className="text-sm font-black text-purple-900 capitalize">{formatEventLabel(event)}</p>
                              <p className="mt-1 text-[11px] font-semibold text-purple-500">
                                {new Date(event.createdAt).toLocaleString('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                        )) : (
                          <p className="text-sm font-semibold text-purple-500">Timeline events will appear as the order moves through payment and fulfilment.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
