import { useEffect, useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, onAuthStateChanged, type AuthUser } from '../../firebase';
import {
  LogIn, ShoppingBag, Package, Truck, CheckCircle, Clock, XCircle,
  ArrowRight, ShieldCheck, Radar, X, AlertCircle, ArrowLeft,
  RefreshCw, ChevronRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchOrderDetail, fetchOrders, Order, OrderDetail } from '../../services/orderService';
import { getProfileByUid } from '../../services/profileService';
import { cancelStoreCheckout, resumeStoreCheckout } from '../../services/paymentService';
import { cn } from '../../lib/utils';

const STATUS: Record<string, { label: string; color: string; icon: any; step: number }> = {
  pending:        { label: 'Pending',        color: 'bg-amber-100 text-amber-700',   icon: Clock,       step: 0 },
  paid:           { label: 'Paid',           color: 'bg-blue-100 text-blue-700',     icon: CheckCircle, step: 1 },
  processing:     { label: 'Processing',     color: 'bg-purple-100 text-purple-700', icon: Package,     step: 2 },
  shipped:        { label: 'Shipped',        color: 'bg-indigo-100 text-indigo-700', icon: Truck,       step: 3 },
  delivered:      { label: 'Delivered',      color: 'bg-green-100 text-green-700',   icon: CheckCircle, step: 4 },
  cancelled:      { label: 'Cancelled',      color: 'bg-red-100 text-red-700',       icon: XCircle,     step: -1 },
  refunded:       { label: 'Refunded',       color: 'bg-gray-100 text-gray-600',     icon: XCircle,     step: -1 },
  payment_failed: { label: 'Payment Failed', color: 'bg-red-100 text-red-700',       icon: XCircle,     step: -1 },
};

const STEPS = [
  { key: 'paid',      label: 'Paid' },
  { key: 'processing', label: 'Preparing' },
  { key: 'shipped',   label: 'Shipped' },
  { key: 'delivered', label: 'Delivered' },
];

function fmt(n: number) { return `R${n.toLocaleString()}`; }
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

function isVisible(order: Order) {
  if (order.sourceRef === 'wallet_topup') return false;
  if ((order.status === 'cancelled' || order.status === 'payment_failed') && !order.paidAt) return false;
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
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  const loadOrders = useCallback(async (uid: string) => {
    setLoading(true);
    setError(null);
    try {
      const profile = await getProfileByUid(uid);
      if (!profile) { setOrders([]); return; }
      const data = await fetchOrders({ profileId: profile.id });
      setOrders(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) void loadOrders(user.uid);
    else { setOrders([]); setLoading(false); }
  }, [user, loadOrders]);

  useEffect(() => {
    if (!selectedOrderId) { setSelectedOrder(null); return; }
    let cancelled = false;
    const load = async () => {
      setDetailLoading(true);
      try {
        const detail = await fetchOrderDetail(selectedOrderId);
        if (!cancelled && detail) setSelectedOrder(detail);
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [selectedOrderId]);

  const visibleOrders = useMemo(() => orders.filter(isVisible), [orders]);

  const handleCancel = async (orderId: string) => {
    setActionLoading(orderId);
    try {
      await cancelStoreCheckout(orderId, 'customer_cancelled_from_orders');
      setOrders(prev => prev.filter(o => o.id !== orderId));
      if (selectedOrderId === orderId) setSelectedOrderId(null);
    } catch (err: any) {
      setError(err.message || 'Failed to cancel order');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResume = async (orderId: string) => {
    setActionLoading(orderId);
    try {
      await resumeStoreCheckout(orderId);
    } catch (err: any) {
      setError(err.message || 'Failed to resume checkout');
      setActionLoading(null);
    }
  };

  // ─── Not signed in ────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 pb-32 text-center">
        <div className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center" style={{ background: 'var(--gradient-primary)' }}>
          <LogIn className="w-7 h-7 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Sign in to view orders</h2>
        <p className="text-gray-500 text-sm mb-7">Your order history is just a sign-in away.</p>
        <button onClick={() => navigate('/auth?next=%2Forders')} className="btn-primary px-8 py-3">
          Sign In <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // ─── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 pb-32 space-y-4">
        <div className="skeleton h-28 rounded-2xl" />
        {[1,2,3].map(i => <div key={i} className="skeleton h-36 rounded-2xl" />)}
      </div>
    );
  }

  // ─── Error ─────────────────────────────────────────────────────────────────
  if (error && visibleOrders.length === 0) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 pb-32 text-center">
        <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-red-50">
          <AlertCircle className="w-6 h-6 text-red-500" />
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-2">Couldn't load orders</h2>
        <p className="text-gray-500 text-sm mb-6">{error}</p>
        <button onClick={() => user && void loadOrders(user.uid)} className="btn-primary">
          <RefreshCw className="w-4 h-4" /> Try again
        </button>
      </div>
    );
  }

  const showDetail = !!selectedOrderId;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-32">
      {/* Stats strip */}
      {!showDetail && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-5 text-white mb-5 noise"
          style={{ background: 'var(--gradient-deep)' }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-purple-300 mb-1">My Orders</p>
              <h1 className="text-xl font-bold">Order History</h1>
              <p className="text-sm text-white/70 mt-0.5">Track your deliveries</p>
            </div>
            <div className="flex gap-2">
              {[
                ['Placed', String(visibleOrders.length)],
                ['Active', String(visibleOrders.filter(o => ['paid','processing','shipped'].includes(o.status)).length)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 text-center">
                  <p className="text-[9px] font-semibold uppercase tracking-widest text-white/60">{label}</p>
                  <p className="text-lg font-bold mt-0.5">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Order list */}
      <AnimatePresence mode="wait">
        {!showDetail && (
          <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {visibleOrders.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
                <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: 'var(--gradient-primary)' }}>
                  <ShoppingBag className="w-6 h-6 text-white" />
                </div>
                <p className="text-sm font-semibold text-gray-600 mb-5">No orders yet</p>
                <button onClick={() => navigate('/')} className="btn-primary px-7">
                  Start Shopping <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {visibleOrders.map((order, idx) => {
                  const cfg = STATUS[order.status] || STATUS.pending;
                  const Icon = cfg.icon;
                  const activeStep = cfg.step;
                  return (
                    <motion.div
                      key={order.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.04 }}
                      className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm"
                    >
                      <div className="p-4">
                        {/* Header */}
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="flex items-center gap-2">
                            <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full', cfg.color)}>
                              <Icon className="w-3 h-3" />{cfg.label}
                            </span>
                          </div>
                          <span className="text-[10px] text-gray-400 font-medium">{fmtDate(order.createdAt)}</span>
                        </div>

                        {/* Order info */}
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-gray-900">{order.orderNumber}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{order.items.length} item{order.items.length !== 1 ? 's' : ''} · {fmt(order.total)}</p>
                          </div>
                          <button
                            onClick={() => setSelectedOrderId(order.id)}
                            className="flex items-center gap-1 text-xs font-semibold text-purple-600 hover:text-purple-700 flex-shrink-0"
                          >
                            View <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Progress bar */}
                        {activeStep >= 0 && (
                          <div className="mt-4">
                            <div className="flex gap-1">
                              {STEPS.map((step, i) => (
                                <div key={step.key} className="flex-1">
                                  <div className={cn(
                                    'h-1.5 rounded-full transition-all',
                                    i < activeStep ? 'bg-purple-500' :
                                    i === activeStep - 1 ? 'bg-purple-400' : 'bg-gray-100'
                                  )} />
                                </div>
                              ))}
                            </div>
                            <div className="flex justify-between mt-1">
                              {STEPS.map((step, i) => (
                                <p key={step.key} className={cn(
                                  'text-[9px] font-semibold',
                                  i < activeStep ? 'text-purple-500' : 'text-gray-300'
                                )}>{step.label}</p>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Tracking chip */}
                        {order.trackingNumber && (
                          <div className="mt-3 flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                            <Radar className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-gray-700 truncate">{order.trackingNumber}</p>
                              <p className="text-[10px] text-gray-400">{order.carrier || 'Carrier assigned'}</p>
                            </div>
                          </div>
                        )}

                        {/* Pending actions */}
                        {order.status === 'pending' && (
                          <div className="mt-3 flex gap-2">
                            <button
                              onClick={() => void handleResume(order.id)}
                              disabled={actionLoading === order.id}
                              className="btn-primary py-2 px-4 text-xs flex-1 justify-center disabled:opacity-50"
                            >
                              {actionLoading === order.id ? 'Opening…' : <>Resume payment <ArrowRight className="w-3.5 h-3.5" /></>}
                            </button>
                            <button
                              onClick={() => void handleCancel(order.id)}
                              disabled={actionLoading === order.id}
                              className="btn-secondary py-2 px-3 text-xs text-red-600 border-red-100 hover:bg-red-50 disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* Order detail — full-page on mobile */}
        {showDetail && (
          <motion.div
            key="detail"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            {/* Back button */}
            <button onClick={() => setSelectedOrderId(null)} className="flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-900 mb-4">
              <ArrowLeft className="w-4 h-4" /> Back to orders
            </button>

            {detailLoading || !selectedOrder ? (
              <div className="space-y-4">
                <div className="skeleton h-32 rounded-2xl" />
                <div className="skeleton h-48 rounded-2xl" />
              </div>
            ) : (
              <div className="space-y-4">
                {/* Detail header */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="h-1.5 bg-gradient-to-r from-pink-500 to-purple-600" />
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="section-label mb-1">Order number</p>
                        <p className="text-base font-bold text-gray-900">{selectedOrder.orderNumber}</p>
                        <p className="text-xs text-gray-400 mt-0.5">Placed {fmtDate(selectedOrder.createdAt)}</p>
                      </div>
                      <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0', STATUS[selectedOrder.status]?.color)}>
                        {STATUS[selectedOrder.status]?.label}
                      </span>
                    </div>

                    {/* Progress stepper */}
                    {STATUS[selectedOrder.status]?.step >= 0 && (
                      <div className="mt-5">
                        <div className="flex items-center gap-0">
                          {STEPS.map((step, i) => {
                            const activeStep = STATUS[selectedOrder.status]?.step || 0;
                            const done = i < activeStep;
                            const current = i === activeStep - 1;
                            return (
                              <div key={step.key} className="flex-1 flex flex-col items-center">
                                <div className="w-full flex items-center">
                                  {i > 0 && <div className={cn('flex-1 h-0.5', done ? 'bg-purple-400' : 'bg-gray-100')} />}
                                  <div className={cn(
                                    'w-7 h-7 rounded-full flex items-center justify-center border-2 flex-shrink-0 transition-all',
                                    done ? 'border-purple-500 bg-purple-500' :
                                    current ? 'border-purple-400 bg-white' : 'border-gray-200 bg-white'
                                  )}>
                                    {done
                                      ? <CheckCircle className="w-3.5 h-3.5 text-white" />
                                      : <div className={cn('w-2 h-2 rounded-full', current ? 'bg-purple-400' : 'bg-gray-200')} />}
                                  </div>
                                  {i < STEPS.length - 1 && <div className={cn('flex-1 h-0.5', done ? 'bg-purple-400' : 'bg-gray-100')} />}
                                </div>
                                <p className={cn('text-[9px] font-semibold mt-1.5', done || current ? 'text-purple-600' : 'text-gray-300')}>
                                  {step.label}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tracking */}
                {selectedOrder.trackingNumber && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Radar className="w-4 h-4 text-purple-500" />
                      <p className="section-label">Tracking</p>
                    </div>
                    <p className="text-sm font-bold text-gray-900">{selectedOrder.trackingNumber}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{selectedOrder.carrier || 'The Courier Guy'}</p>
                  </div>
                )}

                {/* Pending checkout action */}
                {selectedOrder.status === 'pending' && (
                  <div className="bg-amber-50 rounded-2xl border border-amber-100 p-4">
                    <p className="text-sm font-bold text-amber-800 mb-1">Payment pending</p>
                    <p className="text-xs text-amber-600 mb-3">
                      {selectedOrder.reservationExpiresAt
                        ? `Expires ${new Date(selectedOrder.reservationExpiresAt).toLocaleString('en-ZA')}`
                        : 'Complete your payment to confirm the order.'}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => void handleResume(selectedOrder.id)}
                        disabled={actionLoading === selectedOrder.id}
                        className="btn-primary py-2 px-4 text-sm disabled:opacity-50"
                      >
                        {actionLoading === selectedOrder.id ? 'Opening…' : <>Resume payment <ArrowRight className="w-3.5 h-3.5" /></>}
                      </button>
                      <button
                        onClick={() => void handleCancel(selectedOrder.id)}
                        disabled={actionLoading === selectedOrder.id}
                        className="btn-secondary py-2 px-4 text-sm text-red-600 border-red-100 hover:bg-red-50 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Delivery address */}
                {selectedOrder.shippingAddress && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <ShieldCheck className="w-4 h-4 text-gray-400" />
                      <p className="section-label">Delivery address</p>
                    </div>
                    <p className="text-sm font-semibold text-gray-900">{selectedOrder.shippingAddress}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {selectedOrder.shippingCity}{selectedOrder.shippingZip ? `, ${selectedOrder.shippingZip}` : ''}
                    </p>
                  </div>
                )}

                {/* Items */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <ShoppingBag className="w-4 h-4 text-gray-400" />
                    <p className="section-label">Items in this order</p>
                  </div>
                  <div className="space-y-2">
                    {selectedOrder.items.map(item => (
                      <div key={item.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5">
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-white border border-gray-100 flex-shrink-0">
                          {item.productImageUrl
                            ? <img src={item.productImageUrl} alt={item.productName} className="w-full h-full object-cover" />
                            : <Package className="w-5 h-5 text-gray-300 m-auto mt-3.5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{item.productName}</p>
                          <p className="text-xs text-gray-400">Qty {item.quantity} · {fmt(item.unitPrice)}</p>
                        </div>
                        <p className="text-sm font-bold text-gray-900">{fmt(item.lineTotal)}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
                    <div className="flex justify-between text-xs text-gray-500"><span>Subtotal</span><span>{fmt(selectedOrder.subtotal)}</span></div>
                    <div className="flex justify-between text-xs text-gray-500"><span>Shipping</span><span>{selectedOrder.shippingCost > 0 ? fmt(selectedOrder.shippingCost) : 'Free'}</span></div>
                    <div className="flex justify-between text-sm font-bold text-gray-900 pt-1 border-t border-gray-100">
                      <span>Total</span><span>{fmt(selectedOrder.total)}</span>
                    </div>
                  </div>
                </div>

                {/* Timeline */}
                {'events' in selectedOrder && (selectedOrder as any).events?.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <p className="section-label">Order timeline</p>
                    </div>
                    <div className="space-y-3">
                      {(selectedOrder as any).events.map((event: any, i: number) => (
                        <div key={event.id} className="relative pl-5">
                          <span className={cn('absolute left-0 top-1.5 w-2 h-2 rounded-full', i === 0 ? 'bg-purple-500' : 'bg-gray-200')} />
                          <p className="text-xs font-semibold text-gray-900 capitalize">
                            {event.note || event.eventType.replace(/_/g, ' ')}
                          </p>
                          <p className="text-[10px] text-gray-400">
                            {new Date(event.createdAt).toLocaleString('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
