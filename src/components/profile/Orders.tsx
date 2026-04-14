import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
  ShieldCheck,
  Radar,
  Sparkles,
  X,
  AlertCircle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchOrderDetail, fetchOrders, Order, OrderDetail, OrderEvent } from '../../services/orderService';
import { getProfileByUid } from '../../services/profileService';
import { fetchShipmentTracking, ShipmentTracking } from '../../services/shippingService';
import { cancelStoreCheckout, resumeStoreCheckout } from '../../services/paymentService';
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

function isCustomerVisibleOrder(order: Order) {
  if (order.sourceRef === 'wallet_topup') {
    return false;
  }

  if ((order.status === 'cancelled' || order.status === 'payment_failed') && !order.paidAt) {
    return false;
  }

  if (order.status === 'pending' && order.reservationExpiresAt) {
    return new Date(order.reservationExpiresAt).getTime() > Date.now();
  }

  return true;
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
  const [actionLoading, setActionLoading] = useState<string | null>(null);
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

  const visibleOrders = useMemo(() => orders.filter(isCustomerVisibleOrder), [orders]);

  const headlineStats = useMemo(() => {
    const paidOrders = visibleOrders.filter((order) => ['paid', 'processing', 'shipped', 'delivered'].includes(order.status));
    const inFlightOrders = visibleOrders.filter((order) => ['processing', 'shipped'].includes(order.status));

    return {
      totalSpend: paidOrders.reduce((sum, order) => sum + order.total, 0),
      activeOrders: inFlightOrders.length,
      totalOrders: visibleOrders.length,
    };
  }, [visibleOrders]);

  const handleCancelPending = async (orderId: string) => {
    setActionLoading(orderId);
    setError(null);
    try {
      await cancelStoreCheckout(orderId, 'customer_cancelled_from_orders');
      setOrders((prev) => prev.filter((order) => order.id !== orderId));
      if (selectedOrderId === orderId) {
        setSelectedOrderId(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to cancel pending order');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResumePending = async (orderId: string) => {
    setActionLoading(orderId);
    setError(null);
    try {
      await resumeStoreCheckout(orderId);
    } catch (err: any) {
      setError(err.message || 'Failed to resume checkout');
      setActionLoading(null);
    }
  };

  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 pb-32 text-center md:py-32 md:pb-20">
        <div className="w-20 h-20 rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-md"
          style={{ background: 'var(--gradient-primary)' }}>
          <LogIn className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold mb-2 text-gray-900">Sign in to view orders</h2>
        <p className="text-gray-500 text-sm mb-8">Your order history is just a sign-in away.</p>
        <button onClick={() => navigate('/auth?next=%2Forders')} className="btn-primary px-8 py-3">
          Sign In or Create Account <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12 pb-32 md:pb-12">
        <div className="skeleton h-36 rounded-2xl mb-6" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-40 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 pb-32 text-center md:py-32 md:pb-20">
        <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-red-50">
          <AlertCircle className="w-7 h-7 text-red-500" />
        </div>
        <h2 className="text-xl font-bold mb-2 text-gray-900">Error loading orders</h2>
        <p className="text-gray-500 text-sm mb-8">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 pb-32 md:pb-12">
      {/* Header */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-2xl text-white px-6 py-8 mb-8 noise"
        style={{ background: 'var(--gradient-deep)' }}
      >
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="section-label text-purple-300 mb-3">My Orders</span>
            <h1 className="text-3xl font-extrabold leading-tight" style={{ fontFamily: 'Nunito, sans-serif' }}>
              Order History
            </h1>
            <p className="mt-2 text-sm text-white/70">Track payment, fulfilment, and delivery in one place.</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            {[
              ['Total spend', formatMoney(headlineStats.totalSpend)],
              ['Active', String(headlineStats.activeOrders)],
              ['Placed', String(headlineStats.totalOrders)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm min-w-[90px]">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-white/60">{label}</p>
                <p className="mt-1 text-lg font-bold">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.section>

      {visibleOrders.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-24 rounded-2xl border border-gray-100 bg-white"
        >
          <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-sm"
            style={{ background: 'var(--gradient-primary)' }}>
            <ShoppingBag className="w-6 h-6 text-white" />
          </div>
          <p className="text-gray-500 font-medium text-sm mb-5">No orders yet</p>
          <button onClick={() => navigate('/')} className="btn-primary px-7 py-2.5">
            Start Shopping <ArrowRight className="w-4 h-4" />
          </button>
        </motion.div>
      ) : (
        <div className="grid gap-4">
          {visibleOrders.map((order, idx) => {
            const statusInfo = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
            const StatusIcon = statusInfo.icon;
            const activeStep = ORDER_STEPS.indexOf((ORDER_STEPS.includes(order.status as any) ? order.status : 'pending') as typeof ORDER_STEPS[number]);

            return (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05, duration: 0.3 }}
                className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold', statusInfo.color)}>
                        <StatusIcon className="w-3 h-3" />
                        {statusInfo.label}
                      </span>
                      {order.channel && (
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">{order.channel}</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-6 gap-y-2">
                      <div>
                        <p className="section-label mb-0.5">Order</p>
                        <p className="text-sm font-bold text-gray-900">{order.orderNumber}</p>
                      </div>
                      <div>
                        <p className="section-label mb-0.5">Placed</p>
                        <p className="text-sm font-medium text-gray-700">
                          {new Date(order.createdAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                      <div>
                        <p className="section-label mb-0.5">Total</p>
                        <p className="text-sm font-bold text-gray-900">{formatMoney(order.total)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2 text-center min-w-[70px]">
                      <p className="section-label mb-0.5">Items</p>
                      <p className="text-sm font-bold text-gray-900">{order.items.length}</p>
                    </div>
                    <button
                      onClick={() => setSelectedOrderId(order.id)}
                      className="btn-primary py-2 px-4"
                    >
                      View <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Order progress */}
                <div className="mt-4 flex gap-1.5">
                  {ORDER_STEPS.map((status, index) => {
                    const done = index <= activeStep;
                    const isCurrent = index === activeStep;
                    const config = STATUS_CONFIG[status];
                    return (
                      <div key={status} className="flex-1 relative group">
                        <div
                          className={cn(
                            'h-1.5 rounded-full transition-all duration-300',
                            done ? 'bg-purple-500' : 'bg-gray-100',
                            isCurrent && 'bg-purple-400'
                          )}
                        />
                        <p className="mt-1 text-[9px] font-semibold text-center text-gray-400 hidden sm:block">{config.label}</p>
                      </div>
                    );
                  })}
                </div>

                {order.trackingNumber && (
                  <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Radar className="w-3.5 h-3.5 text-purple-500" />
                      <div>
                        <p className="text-xs font-semibold text-gray-700">Tracking: {order.trackingNumber}</p>
                        <p className="text-[10px] text-gray-400">{order.carrier || 'Carrier assigned'}</p>
                      </div>
                    </div>
                    <button onClick={() => setSelectedOrderId(order.id)} className="text-xs font-semibold text-purple-600 hover:text-purple-700">
                      Details
                    </button>
                  </div>
                )}

                {order.status === 'pending' && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => void handleResumePending(order.id)}
                      disabled={actionLoading === order.id}
                      className="btn-primary py-2 px-4 text-sm disabled:opacity-60"
                    >
                      {actionLoading === order.id ? 'Opening...' : 'Resume payment'} <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => void handleCancelPending(order.id)}
                      disabled={actionLoading === order.id}
                      className="btn-secondary py-2 px-4 text-sm text-red-600 border-red-100 hover:bg-red-50 disabled:opacity-60"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Order detail modal */}
      <AnimatePresence>
        {selectedOrderId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm p-4 overflow-y-auto"
            onClick={(event) => {
              if (event.target === event.currentTarget) setSelectedOrderId(null);
            }}
          >
            <div className="min-h-full flex items-start justify-center py-8">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 16 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl overflow-hidden"
              >
                {/* Modal header */}
                <div className="px-6 py-5 text-white noise" style={{ background: 'var(--gradient-deep)' }}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="section-label text-purple-300 mb-1">Order Detail</span>
                      <h2 className="text-xl font-bold">{selectedOrder?.orderNumber || 'Loading…'}</h2>
                    </div>
                    <button
                      onClick={() => setSelectedOrderId(null)}
                      className="rounded-xl bg-white/15 p-2 hover:bg-white/25 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {detailLoading || !selectedOrder ? (
                  <div className="p-6 space-y-4">
                    <div className="skeleton h-32 rounded-xl" />
                    <div className="skeleton h-24 rounded-xl" />
                  </div>
                ) : (
                  <div className="p-5 space-y-4">
                    {/* Summary grid */}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                          <span className="section-label">Order Info</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="section-label mb-0.5">Customer</p>
                            <p className="text-sm font-semibold text-gray-900">{selectedOrder.customerName}</p>
                            <p className="text-xs text-gray-500">{selectedOrder.customerEmail}</p>
                          </div>
                          <div>
                            <p className="section-label mb-0.5">Destination</p>
                            <p className="text-sm font-semibold text-gray-900">{selectedOrder.shippingCity || '—'}</p>
                            <p className="text-xs text-gray-500 truncate">{selectedOrder.shippingAddress || 'Address on record'}</p>
                          </div>
                          <div>
                            <p className="section-label mb-0.5">Total</p>
                            <p className="text-sm font-bold text-gray-900">{formatMoney(selectedOrder.total)}</p>
                          </div>
                          <div>
                            <p className="section-label mb-0.5">Status</p>
                            <p className="text-sm font-semibold text-gray-900">{STATUS_CONFIG[selectedOrder.status]?.label || selectedOrder.status}</p>
                            {selectedOrder.paymentStatus && (
                              <p className="text-xs text-gray-500">Payment: {selectedOrder.paymentStatus}</p>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Truck className="w-3.5 h-3.5 text-purple-500" />
                          <span className="section-label">Tracking</span>
                        </div>
                        {selectedOrder.trackingNumber ? (
                          <div className="space-y-2">
                            <p className="text-sm font-bold text-gray-900">{selectedOrder.trackingNumber}</p>
                            <p className="text-xs text-gray-500">{selectedOrder.carrier || 'The Courier Guy'}</p>
                            {trackingLoading ? (
                              <p className="text-xs text-gray-400">Syncing carrier data…</p>
                            ) : tracking ? (
                              <>
                                <p className="text-sm font-semibold text-gray-800">{tracking.status_label}</p>
                                <p className="text-xs text-gray-500">{tracking.message}</p>
                                {tracking.estimated_delivery && (
                                  <p className="text-xs font-semibold text-purple-600">ETA: {tracking.estimated_delivery}</p>
                                )}
                              </>
                            ) : (
                              <p className="text-xs text-gray-500">Tracking assigned. Carrier sync pending.</p>
                            )}
                          </div>
                        ) : (
                          <div>
                            <p className="text-sm font-semibold text-gray-700">Not yet assigned</p>
                            <p className="text-xs text-gray-400 mt-1">Tracking reference added once dispatched.</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Pending checkout actions */}
                    {selectedOrder.status === 'pending' && (
                      <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
                        <p className="section-label text-amber-600 mb-1">Checkout still open</p>
                        <p className="text-sm text-amber-800 mb-3">
                          Active{selectedOrder.reservationExpiresAt ? ` until ${new Date(selectedOrder.reservationExpiresAt).toLocaleString('en-ZA')}` : ''}.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => void handleResumePending(selectedOrder.id)}
                            disabled={actionLoading === selectedOrder.id}
                            className="btn-primary py-2 px-4 text-sm disabled:opacity-60"
                          >
                            {actionLoading === selectedOrder.id ? 'Opening…' : 'Resume payment'} <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => void handleCancelPending(selectedOrder.id)}
                            disabled={actionLoading === selectedOrder.id}
                            className="btn-secondary py-2 px-4 text-sm text-red-600 border-red-100 hover:bg-red-50 disabled:opacity-60"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="grid gap-4 sm:grid-cols-2">
                      {/* Items list */}
                      <div className="rounded-xl border border-gray-100 p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <ShoppingBag className="w-3.5 h-3.5 text-purple-500" />
                          <span className="section-label">Items</span>
                        </div>
                        <div className="space-y-2">
                          {selectedOrder.items.map((item) => (
                            <div key={item.id} className="flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-2">
                              {item.productImageUrl ? (
                                <img src={item.productImageUrl} alt={item.productName} className="h-10 w-10 rounded-lg object-cover flex-shrink-0" />
                              ) : (
                                <div className="h-10 w-10 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center flex-shrink-0">
                                  <Package className="w-4 h-4 text-gray-400" />
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold text-gray-900 truncate">{item.productName}</p>
                                <p className="text-[10px] text-gray-500">Qty {item.quantity} · {formatMoney(item.unitPrice)}</p>
                              </div>
                              <p className="text-xs font-bold text-gray-900 flex-shrink-0">{formatMoney(item.lineTotal)}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Timeline */}
                      <div className="rounded-xl border border-gray-100 p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <ShieldCheck className="w-3.5 h-3.5 text-purple-500" />
                          <span className="section-label">Timeline</span>
                        </div>
                        <div className="space-y-3">
                          {selectedOrder.events.length > 0 ? selectedOrder.events.map((event) => (
                            <div key={event.id} className="relative pl-5">
                              <span className="absolute left-0 top-1.5 h-2 w-2 rounded-full bg-purple-400" />
                              <p className="text-xs font-semibold text-gray-900 capitalize">{formatEventLabel(event)}</p>
                              <p className="text-[10px] text-gray-400">
                                {new Date(event.createdAt).toLocaleString('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          )) : (
                            <p className="text-xs text-gray-400">Events appear as the order progresses.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
