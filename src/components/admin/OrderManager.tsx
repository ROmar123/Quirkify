import { useEffect, useMemo, useState } from 'react';
import { fetchOrders, updateOrderStatus as updateStatus, Order, OrderDetail, OrderStatus } from '../../services/orderService';
import { motion, AnimatePresence } from 'motion/react';
import { ClipboardList, Search, Eye, X, MapPin, User, ShoppingBag, Package, Truck, Save, StickyNote, Hash } from 'lucide-react';
import { cn } from '../../lib/utils';

const STATUS_CONFIG: Record<string, { label: string; classes: string }> = {
  pending: { label: 'Pending', classes: 'bg-amber-100 text-amber-700' },
  paid: { label: 'Paid', classes: 'bg-blue-100 text-blue-700' },
  processing: { label: 'Processing', classes: 'bg-purple-100 text-gray-700' },
  shipped: { label: 'Shipped', classes: 'bg-indigo-100 text-indigo-700' },
  delivered: { label: 'Delivered', classes: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelled', classes: 'bg-red-100 text-red-700' },
  refunded: { label: 'Refunded', classes: 'bg-gray-100 text-gray-700' },
  payment_failed: { label: 'Failed', classes: 'bg-red-100 text-red-700' },
};

const ALL_STATUSES: OrderStatus[] = ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded', 'payment_failed'];

export default function OrderManager() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null);
  const [statusDraft, setStatusDraft] = useState<OrderStatus>('pending');
  const [trackingDraft, setTrackingDraft] = useState('');
  const [carrierDraft, setCarrierDraft] = useState('The Courier Guy');
  const [notesDraft, setNotesDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const loadOrders = async () => {
    try {
      const data = await fetchOrders({ excludeSourceRef: 'wallet_topup' });
      setOrders(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOrders();
  }, []);

  useEffect(() => {
    if (!selectedOrder) return;
    setStatusDraft(selectedOrder.status);
    setTrackingDraft(selectedOrder.trackingNumber || '');
    setCarrierDraft(selectedOrder.carrier || 'The Courier Guy');
    setNotesDraft(selectedOrder.adminNotes || '');
  }, [selectedOrder]);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const term = searchTerm.toLowerCase();
      const matchesSearch = order.customerEmail?.toLowerCase().includes(term) ||
        order.orderNumber?.toLowerCase().includes(term) ||
        order.customerName?.toLowerCase().includes(term) ||
        order.id.toLowerCase().includes(term);
      const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [orders, searchTerm, statusFilter]);

  const headline = useMemo(() => ({
    gmValue: orders.reduce((sum, order) => sum + order.total, 0),
    awaitingDispatch: orders.filter((order) => ['paid', 'processing'].includes(order.status)).length,
    delivered: orders.filter((order) => order.status === 'delivered').length,
  }), [orders]);

  const handleSave = async () => {
    if (!selectedOrder) return;
    setSaving(true);
    try {
      const updated = await updateStatus(selectedOrder.id, statusDraft, {
        trackingNumber: trackingDraft,
        carrier: carrierDraft,
        adminNotes: notesDraft,
      });
      setOrders((prev) => prev.map((order) => order.id === updated.id ? updated : order));
      setSelectedOrder(updated);
    } catch (err: any) {
      setError(err.message || 'Failed to update order');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-10 h-10 rounded-full border-4 border-gray-200 border-t-purple-500 animate-spin" />
      </div>
    );
  }

  if (error && orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <p className="text-red-500 font-bold">{error}</p>
        <button onClick={() => { setError(null); setLoading(true); void loadOrders(); }} className="btn-primary">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/20 p-6 text-white shadow-xl noise" style={{ background: 'var(--gradient-deep)' }}>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-pink-100/75">Commerce Ops</p>
            <h2 className="mt-3 text-3xl sm:text-5xl font-black leading-none">Order operations with less guesswork.</h2>
            <p className="mt-3 max-w-2xl text-sm font-semibold text-white/80">Review payment state, dispatch readiness, tracking details, and admin notes from one fulfilment console.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ['GMV', `R${headline.gmValue.toLocaleString()}`],
              ['Awaiting dispatch', String(headline.awaitingDispatch)],
              ['Delivered', String(headline.delivered)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-white/15 bg-white/10 px-4 py-4">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-pink-100/75">{label}</p>
                <p className="mt-2 text-2xl font-black">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name, email, order number, or ID"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input pl-10"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input cursor-pointer"
        >
          <option value="all">All statuses</option>
          {ALL_STATUSES.map((status) => (
            <option key={status} value={status}>{STATUS_CONFIG[status].label}</option>
          ))}
        </select>
      </div>

      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {filteredOrders.length > 0 ? filteredOrders.map((order, index) => {
            const statusInfo = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
            return (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ delay: index * 0.02, duration: 0.2 }}
                className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className={cn('inline-flex items-center rounded-full px-3 py-1.5 text-[11px] font-black', statusInfo.classes)}>
                        {statusInfo.label}
                      </span>
                      <span className="text-[11px] font-black uppercase tracking-[0.24em] text-purple-300">{order.channel}</span>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-4">
                      <div>
                        <p className="section-label">Order</p>
                        <p className="mt-1 text-sm font-black text-gray-900">{order.orderNumber}</p>
                      </div>
                      <div>
                        <p className="section-label">Customer</p>
                        <p className="mt-1 text-sm font-black text-gray-900 truncate">{order.customerName || order.customerEmail}</p>
                      </div>
                      <div>
                        <p className="section-label">Total</p>
                        <p className="mt-1 text-sm font-black text-gray-900">R{order.total.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="section-label">Dispatch</p>
                        <p className="mt-1 text-sm font-black text-gray-900">{order.trackingNumber ? 'Tracked' : 'Awaiting label'}</p>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedOrder(order as OrderDetail)}
                    className="btn-primary"
                  >
                    <Eye className="w-4 h-4" />
                    Open Order
                  </button>
                </div>
              </motion.div>
            );
          }) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 flex flex-col items-center gap-4"
            >
              <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center">
                <ClipboardList className="w-7 h-7 text-gray-300" />
              </div>
              <p className="text-base font-black text-gray-900">No orders found</p>
              <p className="text-sm font-bold text-gray-400">Try adjusting your search or filter.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {selectedOrder && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={(event) => { if (event.target === event.currentTarget) setSelectedOrder(null); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 20 }}
              transition={{ type: 'spring', stiffness: 340, damping: 28 }}
              className="bg-white rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto shadow-2xl"
            >
              <div className="p-5 flex items-center justify-between sticky top-0 z-10 bg-white border-b border-gray-100 rounded-t-2xl">
                <div>
                  <h2 className="text-base font-bold text-gray-900">Fulfilment Command</h2>
                  <p className="text-xs text-gray-400 mt-0.5">{selectedOrder.orderNumber}</p>
                </div>
                <button onClick={() => setSelectedOrder(null)} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {error && (
                  <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <User className="w-4 h-4 text-gray-400" />
                      <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Customer</span>
                    </div>
                    <p className="text-sm font-black text-gray-900">{selectedOrder.customerName}</p>
                    <p className="text-[11px] font-bold text-gray-400 mt-1 break-all">{selectedOrder.customerEmail}</p>
                    {selectedOrder.customerPhone && (
                      <p className="text-[11px] font-bold text-gray-400 mt-0.5">{selectedOrder.customerPhone}</p>
                    )}
                  </div>

                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Shipping</span>
                    </div>
                    {selectedOrder.shippingAddress ? (
                      <p className="text-sm font-bold text-gray-900 leading-relaxed">
                        {selectedOrder.shippingAddress}<br />
                        {selectedOrder.shippingCity}{selectedOrder.shippingZip ? `, ${selectedOrder.shippingZip}` : ''}
                      </p>
                    ) : (
                      <p className="text-sm font-bold text-gray-400">No shipping address</p>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
                  <div className="rounded-2xl border border-gray-100 p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <Package className="w-4 h-4 text-gray-400" />
                      <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Order Summary</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm font-bold text-gray-700"><span>Subtotal</span><span>R{selectedOrder.subtotal.toLocaleString()}</span></div>
                      <div className="flex justify-between text-sm font-bold text-gray-700"><span>Shipping</span><span>{selectedOrder.shippingCost > 0 ? `R${selectedOrder.shippingCost.toLocaleString()}` : 'Free'}</span></div>
                      <div className="h-px bg-purple-200 my-2" />
                      <div className="flex justify-between text-base font-black text-gray-900"><span>Total</span><span>R{selectedOrder.total.toLocaleString()}</span></div>
                    </div>
                    <div className="mt-4 space-y-3">
                      {selectedOrder.items.map((item) => (
                        <div key={item.id} className="flex items-center gap-3 rounded-2xl bg-purple-50 px-4 py-3">
                          <div className="w-12 h-12 rounded-xl overflow-hidden bg-white border border-gray-100 flex items-center justify-center flex-shrink-0">
                            {item.productImageUrl ? <img src={item.productImageUrl} alt={item.productName} className="w-full h-full object-cover" /> : <Package className="w-5 h-5 text-purple-300" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-black text-gray-900 truncate">{item.productName}</p>
                            <p className="text-[11px] font-semibold text-purple-500">{item.quantity} × R{item.unitPrice.toLocaleString()}</p>
                          </div>
                          <p className="text-sm font-black text-gray-900">R{item.lineTotal.toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-100 p-5 space-y-4">
                    <div>
                      <p className="section-label mb-2">Lifecycle status</p>
                      <select value={statusDraft} onChange={(event) => setStatusDraft(event.target.value as OrderStatus)} className="input">
                        {ALL_STATUSES.map((status) => (
                          <option key={status} value={status}>{STATUS_CONFIG[status].label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block">
                        <span className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-gray-400"><Hash className="w-3.5 h-3.5" />Tracking Number</span>
                        <input value={trackingDraft} onChange={(event) => setTrackingDraft(event.target.value)} className="input" placeholder="TCG123456789" />
                      </label>
                      <label className="block">
                        <span className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-gray-400"><Truck className="w-3.5 h-3.5" />Carrier</span>
                        <input value={carrierDraft} onChange={(event) => setCarrierDraft(event.target.value)} className="input" placeholder="The Courier Guy" />
                      </label>
                    </div>

                    <label className="block">
                      <span className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-gray-400"><StickyNote className="w-3.5 h-3.5" />Operations Note</span>
                      <textarea value={notesDraft} onChange={(event) => setNotesDraft(event.target.value)} rows={5} className="input resize-none" placeholder="Dispatch notes, exception handling, customer communication..." />
                    </label>

                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="btn-primary w-full justify-center py-3"
                    >
                      <Save className="w-4 h-4" />
                      {saving ? 'Saving fulfilment update...' : 'Save fulfilment update'}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
