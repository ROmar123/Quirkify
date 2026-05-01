import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  fetchOrders, fetchOrderDetail, updateOrderStatus,
  subscribeToOrders, FULFILLMENT_STEPS, orderStep,
  type Order, type OrderDetail, type OrderStatus,
} from '../../services/orderService';
import {
  ClipboardList, Search, X, MapPin, User, ShoppingBag, Package, Truck,
  Save, StickyNote, Hash, ArrowLeft, RefreshCw, CheckCircle2, Clock,
  AlertCircle, ChevronRight, Gavel,
} from 'lucide-react';
import { cn } from '../../lib/utils';

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; badge: string; dot: string }> = {
  pending:        { label: 'Awaiting Payment', badge: 'bg-amber-100 text-amber-700',   dot: 'bg-amber-400'  },
  paid:           { label: 'Confirmed',        badge: 'bg-blue-100 text-blue-700',     dot: 'bg-blue-500'   },
  processing:     { label: 'Confirmed',        badge: 'bg-blue-100 text-blue-700',     dot: 'bg-blue-500'   },
  shipped:        { label: 'Dispatched',       badge: 'bg-indigo-100 text-indigo-700', dot: 'bg-indigo-500' },
  delivered:      { label: 'Delivered',        badge: 'bg-green-100 text-green-700',   dot: 'bg-green-500'  },
  cancelled:      { label: 'Cancelled',        badge: 'bg-red-100 text-red-700',       dot: 'bg-red-400'    },
  refunded:       { label: 'Refunded',         badge: 'bg-gray-100 text-gray-600',     dot: 'bg-gray-400'   },
  payment_failed: { label: 'Failed',           badge: 'bg-red-100 text-red-700',       dot: 'bg-red-500'    },
};

const FILTER_TABS = [
  { id: 'all',       label: 'All'       },
  { id: 'paid',      label: 'Confirmed' },
  { id: 'shipped',   label: 'Dispatched'},
  { id: 'delivered', label: 'Delivered' },
  { id: 'cancelled', label: 'Issues'    },
];

function fmt(n: number) { return `R${n.toLocaleString()}`; }
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── 4-step progress bar (shared with customer view) ─────────────────────────

function StepBar({ status, compact = false }: { status: OrderStatus; compact?: boolean }) {
  const step = orderStep(status);
  if (step < 0) return null;
  return (
    <div className="flex items-center gap-0 w-full">
      {FULFILLMENT_STEPS.map((s, i) => {
        const done    = i < step;
        const current = i === step - 1;
        return (
          <div key={s.key} className="flex-1 flex flex-col items-center">
            <div className="w-full flex items-center">
              {i > 0 && <div className={cn('flex-1 h-0.5', done ? 'bg-purple-400' : 'bg-gray-100')} />}
              <div className={cn(
                'flex-shrink-0 rounded-full flex items-center justify-center border-2 transition-all',
                compact ? 'w-5 h-5' : 'w-7 h-7',
                done    ? 'border-purple-500 bg-purple-500' :
                current ? 'border-purple-400 bg-white'       : 'border-gray-200 bg-white'
              )}>
                {done
                  ? <CheckCircle2 className={cn('text-white', compact ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5')} />
                  : <div className={cn('rounded-full', compact ? 'w-1.5 h-1.5' : 'w-2 h-2', current ? 'bg-purple-400' : 'bg-gray-200')} />}
              </div>
              {i < FULFILLMENT_STEPS.length - 1 && <div className={cn('flex-1 h-0.5', done ? 'bg-purple-400' : 'bg-gray-100')} />}
            </div>
            {!compact && (
              <p className={cn('text-[9px] font-semibold mt-1.5', done || current ? 'text-purple-600' : 'text-gray-300')}>
                {s.label}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Quick action button ──────────────────────────────────────────────────────

function QuickAction({ order, onAction }: {
  order: Order;
  onAction: (id: string, status: OrderStatus, extras?: { trackingNumber?: string; carrier?: string }) => void;
}) {
  const [showDispatch, setShowDispatch] = useState(false);
  const [tracking, setTracking]         = useState('');
  const [carrier, setCarrier]           = useState('The Courier Guy');

  if (order.status === 'paid' || order.status === 'processing') {
    if (showDispatch) {
      return (
        <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
          <input
            value={tracking}
            onChange={e => setTracking(e.target.value)}
            placeholder="Tracking #"
            className="text-[10px] border border-gray-200 rounded-lg px-2 py-1.5 w-28 focus:outline-none focus:border-purple-300"
          />
          <input
            value={carrier}
            onChange={e => setCarrier(e.target.value)}
            placeholder="Carrier"
            className="text-[10px] border border-gray-200 rounded-lg px-2 py-1.5 w-24 focus:outline-none focus:border-purple-300"
          />
          <button
            onClick={() => { onAction(order.id, 'shipped', { trackingNumber: tracking, carrier }); setShowDispatch(false); }}
            className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 transition-colors"
          >
            Dispatch
          </button>
          <button onClick={() => setShowDispatch(false)} className="p-1 text-gray-400 hover:text-gray-600">
            <X className="w-3 h-3" />
          </button>
        </div>
      );
    }
    return (
      <button
        onClick={e => { e.stopPropagation(); setShowDispatch(true); }}
        className="text-[10px] font-bold uppercase tracking-wide px-2.5 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors"
      >
        Mark Dispatched →
      </button>
    );
  }

  if (order.status === 'shipped') {
    return (
      <button
        onClick={e => { e.stopPropagation(); onAction(order.id, 'delivered'); }}
        className="text-[10px] font-bold uppercase tracking-wide px-2.5 py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
      >
        Mark Delivered →
      </button>
    );
  }

  return null;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CommercePage() {
  const [orders, setOrders]             = useState<Order[]>([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [search, setSearch]             = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected]         = useState<OrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [statusDraft, setStatusDraft]   = useState<OrderStatus>('paid');
  const [trackingDraft, setTrackingDraft] = useState('');
  const [carrierDraft, setCarrierDraft] = useState('The Courier Guy');
  const [notesDraft, setNotesDraft]     = useState('');
  const [saving, setSaving]             = useState(false);
  const [saveError, setSaveError]       = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [toast, setToast]               = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Real-time subscription (Supabase Realtime + polling fallback)
  useEffect(() => {
    setLoading(true);
    return subscribeToOrders(undefined, (data) => {
      setOrders(data);
      setLoading(false);
      setRefreshing(false);
      setLastRefreshed(new Date());
      setError(null);
    });
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await fetchOrders({ excludeSourceRef: 'wallet_topup' });
      setOrders(data);
      setLastRefreshed(new Date());
    } catch (err: any) {
      setError(err.message || 'Failed to load orders');
    } finally {
      setRefreshing(false);
    }
  }, []);

  const openOrder = useCallback(async (order: Order) => {
    setDetailLoading(true);
    setSelected(order as OrderDetail);
    setSaveError(null);
    try {
      const detail = await fetchOrderDetail(order.id);
      if (detail) {
        setSelected(detail);
        setStatusDraft(detail.status);
        setTrackingDraft(detail.trackingNumber || '');
        setCarrierDraft(detail.carrier || 'The Courier Guy');
        setNotesDraft(detail.adminNotes || '');
      }
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const handleAction = useCallback(async (
    id: string,
    status: OrderStatus,
    extras?: { trackingNumber?: string; carrier?: string }
  ) => {
    try {
      const updated = await updateOrderStatus(id, status, extras);
      setOrders(prev => prev.map(o => o.id === id ? updated : o));
      if (selected?.id === id) setSelected(updated);
      showToast(`Order marked ${STATUS_CONFIG[status]?.label || status}`);
    } catch (err: any) {
      setError(err.message || 'Failed to update');
    }
  }, [selected]);

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await updateOrderStatus(selected.id, statusDraft, {
        trackingNumber: trackingDraft,
        carrier:        carrierDraft,
        adminNotes:     notesDraft,
      });
      setOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
      setSelected(updated);
      showToast('Order updated');
    } catch (err: any) {
      setSaveError(err.message || 'Failed to update order');
    } finally {
      setSaving(false);
    }
  };

  const filtered = useMemo(() => {
    return orders.filter(o => {
      // Map filter tab "paid" to include both paid + processing
      const statusMatch = statusFilter === 'all'
        ? true
        : statusFilter === 'paid'
        ? (o.status === 'paid' || o.status === 'processing')
        : o.status === statusFilter;
      const term = search.toLowerCase();
      const searchMatch = !term
        || o.customerEmail?.toLowerCase().includes(term)
        || o.orderNumber?.toLowerCase().includes(term)
        || o.customerName?.toLowerCase().includes(term);
      return statusMatch && searchMatch;
    });
  }, [orders, search, statusFilter]);

  const stats = useMemo(() => ({
    gmv:              orders.filter(o => ['paid','processing','shipped','delivered'].includes(o.status)).reduce((s, o) => s + o.total, 0),
    awaitingDispatch: orders.filter(o => ['paid','processing'].includes(o.status)).length,
    inTransit:        orders.filter(o => o.status === 'shipped').length,
    delivered:        orders.filter(o => o.status === 'delivered').length,
  }), [orders]);

  // ─── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-5 p-4 max-w-7xl mx-auto">
        <div className="skeleton h-36 rounded-2xl" />
        <div className="skeleton h-12 rounded-2xl" />
        {[1,2,3].map(i => <div key={i} className="skeleton h-24 rounded-2xl" />)}
      </div>
    );
  }

  if (error && orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 px-4">
        <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center">
          <AlertCircle className="w-7 h-7 text-red-500" />
        </div>
        <p className="text-sm font-semibold text-gray-700">{error}</p>
        <button onClick={() => void refresh()} className="btn-primary"><RefreshCw className="w-4 h-4" /> Retry</button>
      </div>
    );
  }

  const showDetail = !!selected;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 pb-24 space-y-5 relative">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full bg-green-500 text-white text-sm font-semibold shadow-lg"
          >
            <CheckCircle2 className="w-4 h-4" /> {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats banner */}
      <section className="rounded-2xl p-5 sm:p-6 text-white noise" style={{ background: 'var(--gradient-deep)' }}>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-purple-200 mb-2">Commerce</p>
            <h2 className="text-xl sm:text-2xl font-bold leading-tight">Fulfilment Console</h2>
            <p className="text-sm text-white/70 mt-1">Manage payment, dispatch and delivery in 4 steps.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            {[
              ['GMV', fmt(stats.gmv)],
              ['To Dispatch', String(stats.awaitingDispatch)],
              ['In Transit', String(stats.inTransit)],
              ['Delivered', String(stats.delivered)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-white/15 bg-white/10 px-3 py-3 text-center">
                <p className="text-[9px] font-bold uppercase tracking-widest text-purple-200 mb-1">{label}</p>
                <p className="text-lg font-bold">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Search + refresh */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email or order #"
            className="input pl-10 pr-10"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100">
              <X className="w-3.5 h-3.5 text-gray-400" />
            </button>
          )}
        </div>
        <button onClick={() => void refresh()} disabled={refreshing} className="btn-secondary px-3 flex-shrink-0" title="Refresh">
          <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
        </button>
      </div>

      {/* Status filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {FILTER_TABS.map(tab => (
          <button key={tab.id} onClick={() => setStatusFilter(tab.id)}
            className={cn('filter-pill flex-shrink-0', statusFilter === tab.id && 'active')}>
            {tab.label}
            {tab.id !== 'all' && (
              <span className="ml-1.5 text-[10px] font-bold">
                {tab.id === 'paid'
                  ? (orders.filter(o => o.status === 'paid' || o.status === 'processing').length || '')
                  : (orders.filter(o => o.status === tab.id).length || '')}
              </span>
            )}
          </button>
        ))}
      </div>

      {lastRefreshed && (
        <p className="text-[10px] text-gray-400 font-medium -mt-2">
          Updated {lastRefreshed.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Order list */}
        <div className={cn('lg:col-span-2 space-y-2', showDetail && 'hidden lg:block')}>
          <AnimatePresence initial={false}>
            {filtered.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="bg-white rounded-2xl border border-gray-100 p-12 flex flex-col items-center gap-3 shadow-sm">
                <ClipboardList className="w-8 h-8 text-gray-200" />
                <p className="text-sm font-semibold text-gray-500">No orders found</p>
              </motion.div>
            ) : filtered.map((order, idx) => {
              const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
              const isSelected = selected?.id === order.id;
              return (
                <motion.button
                  key={order.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.03, 0.2) }}
                  onClick={() => openOrder(order)}
                  className={cn(
                    'w-full text-left bg-white rounded-2xl border p-4 transition-all shadow-sm hover:border-gray-200 hover:shadow-md',
                    isSelected ? 'border-purple-300 ring-1 ring-purple-200' : 'border-gray-100'
                  )}
                >
                  <div className="flex items-start justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-2">
                      <span className={cn('w-2 h-2 rounded-full flex-shrink-0 mt-0.5', cfg.dot)} />
                      <span className={cn('text-[10px] font-bold uppercase px-2 py-0.5 rounded-full', cfg.badge)}>
                        {cfg.label}
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-400 font-medium">{fmtDate(order.createdAt)}</span>
                  </div>
                  <p className="text-sm font-bold text-gray-900 truncate">{order.customerName || order.customerEmail}</p>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{order.orderNumber} · {fmt(order.total)}</p>
                  <div className="mt-3">
                    <StepBar status={order.status} compact />
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <p className="text-xs text-gray-400">{order.items.length} item{order.items.length !== 1 ? 's' : ''}</p>
                    <div className="flex items-center gap-2">
                      <QuickAction order={order} onAction={handleAction} />
                      <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Detail panel */}
        <div className={cn('lg:col-span-3', !showDetail && 'hidden lg:flex lg:items-center lg:justify-center')}>
          {!showDetail ? (
            <div className="text-center py-16 w-full bg-white rounded-2xl border border-dashed border-gray-200">
              <ClipboardList className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-400">Select an order to manage</p>
            </div>
          ) : (
            <motion.div
              key={selected!.id}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
            >
              {/* Mobile back */}
              <div className="lg:hidden flex items-center gap-3 p-4 border-b border-gray-100">
                <button onClick={() => setSelected(null)} className="btn-secondary p-2">
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <span className="text-sm font-semibold text-gray-900">Order Detail</span>
              </div>

              {detailLoading ? (
                <div className="p-5 space-y-4">
                  <div className="skeleton h-28 rounded-xl" />
                  <div className="skeleton h-40 rounded-xl" />
                </div>
              ) : (
                <div className="p-5 space-y-5">
                  {/* Order header */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-gray-400 font-medium">{selected!.orderNumber}</p>
                      <p className="text-base font-bold text-gray-900 mt-0.5">{selected!.customerName}</p>
                      <p className="text-xs text-gray-500 break-all">{selected!.customerEmail}</p>
                      {selected!.customerPhone && <p className="text-xs text-gray-500">{selected!.customerPhone}</p>}
                    </div>
                    <span className={cn('text-[10px] font-bold uppercase px-2.5 py-1 rounded-full flex-shrink-0', STATUS_CONFIG[selected!.status]?.badge)}>
                      {STATUS_CONFIG[selected!.status]?.label}
                    </span>
                  </div>

                  {/* 4-step progress */}
                  <div className="py-2">
                    <StepBar status={selected!.status} />
                  </div>

                  {/* Customer + address */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="bg-gray-50 rounded-xl p-4">
                      <div className="flex items-center gap-1.5 mb-2">
                        <User className="w-3.5 h-3.5 text-gray-400" />
                        <p className="section-label">Customer</p>
                      </div>
                      <p className="text-sm font-semibold text-gray-900">{selected!.customerName}</p>
                      <p className="text-xs text-gray-500 mt-0.5 capitalize">{selected!.channel} order</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4">
                      <div className="flex items-center gap-1.5 mb-2">
                        <MapPin className="w-3.5 h-3.5 text-gray-400" />
                        <p className="section-label">Delivery address</p>
                      </div>
                      {selected!.shippingAddress ? (
                        <>
                          <p className="text-sm font-semibold text-gray-900 leading-snug">{selected!.shippingAddress}</p>
                          <p className="text-xs text-gray-500">{selected!.shippingCity}{selected!.shippingZip ? `, ${selected!.shippingZip}` : ''}</p>
                        </>
                      ) : (
                        <p className="text-sm text-gray-400">No address on file</p>
                      )}
                    </div>
                  </div>

                  {/* Items */}
                  <div className="rounded-xl border border-gray-100 p-4">
                    <div className="flex items-center gap-1.5 mb-3">
                      <Package className="w-3.5 h-3.5 text-gray-400" />
                      <p className="section-label">Items ({selected!.items.length})</p>
                    </div>
                    <div className="space-y-2">
                      {selected!.items.map(item => (
                        <div key={item.id} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2">
                          <div className="w-10 h-10 rounded-lg overflow-hidden bg-white border border-gray-100 flex-shrink-0">
                            {item.productImageUrl
                              ? <img src={item.productImageUrl} alt={item.productName} className="w-full h-full object-cover" />
                              : <ShoppingBag className="w-4 h-4 text-gray-300 m-auto mt-3" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-900 truncate">{item.productName}</p>
                            <p className="text-[10px] text-gray-400">{item.quantity} × {fmt(item.unitPrice)}</p>
                          </div>
                          <p className="text-xs font-bold text-gray-900">{fmt(item.lineTotal)}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
                      <div className="flex justify-between text-xs text-gray-500"><span>Subtotal</span><span>{fmt(selected!.subtotal)}</span></div>
                      <div className="flex justify-between text-xs text-gray-500"><span>Shipping</span><span>{selected!.shippingCost > 0 ? fmt(selected!.shippingCost) : 'Free'}</span></div>
                      <div className="flex justify-between text-sm font-bold text-gray-900 pt-1 border-t border-gray-100"><span>Total</span><span>{fmt(selected!.total)}</span></div>
                    </div>
                  </div>

                  {/* Fulfilment controls */}
                  <div className="rounded-xl border border-gray-100 p-4 space-y-4">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Truck className="w-3.5 h-3.5 text-gray-400" />
                      <p className="section-label">Update fulfilment</p>
                    </div>

                    {saveError && (
                      <div className="p-3 bg-red-50 border border-red-100 rounded-lg flex items-center gap-2 text-xs text-red-700">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> {saveError}
                      </div>
                    )}

                    <div>
                      <label className="section-label block mb-1.5">Status</label>
                      <select
                        value={statusDraft}
                        onChange={e => setStatusDraft(e.target.value as OrderStatus)}
                        className="input"
                      >
                        <option value="paid">Confirmed (paid)</option>
                        <option value="shipped">Dispatched</option>
                        <option value="delivered">Delivered</option>
                        <option value="cancelled">Cancelled</option>
                        <option value="refunded">Refunded</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="section-label block mb-1.5">
                          <Hash className="w-3 h-3 inline mr-1" />Tracking #
                        </label>
                        <input value={trackingDraft} onChange={e => setTrackingDraft(e.target.value)} className="input" placeholder="TCG123456789" />
                      </div>
                      <div>
                        <label className="section-label block mb-1.5">
                          <Truck className="w-3 h-3 inline mr-1" />Carrier
                        </label>
                        <input value={carrierDraft} onChange={e => setCarrierDraft(e.target.value)} className="input" placeholder="The Courier Guy" />
                      </div>
                    </div>

                    <div>
                      <label className="section-label block mb-1.5">
                        <StickyNote className="w-3 h-3 inline mr-1" />Operations note
                      </label>
                      <textarea value={notesDraft} onChange={e => setNotesDraft(e.target.value)} rows={3} className="input resize-none" placeholder="Dispatch notes, exceptions…" />
                    </div>

                    <button onClick={handleSave} disabled={saving} className="btn-primary w-full justify-center py-3 disabled:opacity-50">
                      {saving
                        ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} className="w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                        : <Save className="w-4 h-4" />}
                      {saving ? 'Saving…' : 'Save update'}
                    </button>
                  </div>

                  {/* Timeline */}
                  {'events' in selected! && (selected as any).events?.length > 0 && (
                    <div className="rounded-xl border border-gray-100 p-4">
                      <div className="flex items-center gap-1.5 mb-3">
                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                        <p className="section-label">Timeline</p>
                      </div>
                      <div className="space-y-3">
                        {(selected as any).events.map((event: any, i: number) => (
                          <div key={event.id} className="relative pl-5">
                            <span className={cn('absolute left-0 top-1.5 w-2 h-2 rounded-full', i === 0 ? 'bg-purple-500' : 'bg-gray-200')} />
                            <p className="text-xs font-semibold text-gray-900 capitalize">{event.note || event.eventType.replace(/_/g, ' ')}</p>
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
        </div>
      </div>
    </div>
  );
}
