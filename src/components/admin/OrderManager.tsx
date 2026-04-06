import { useState, useEffect } from 'react';
import { fetchOrders, updateOrderStatus as updateStatus, Order, OrderStatus } from '../../services/orderService';
import { motion, AnimatePresence } from 'motion/react';
import { ClipboardList, Search, Eye, X, MapPin, User, ShoppingBag, Package, Clock, CheckCircle, Truck, XCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

const STATUS_CONFIG: Record<string, { label: string; classes: string }> = {
  pending:        { label: 'Pending',    classes: 'bg-amber-100 text-amber-700' },
  paid:           { label: 'Paid',       classes: 'bg-blue-100 text-blue-700' },
  processing:     { label: 'Processing', classes: 'bg-purple-100 text-purple-700' },
  shipped:        { label: 'Shipped',    classes: 'bg-indigo-100 text-indigo-700' },
  delivered:      { label: 'Delivered',  classes: 'bg-green-100 text-green-700' },
  cancelled:      { label: 'Cancelled',  classes: 'bg-red-100 text-red-700' },
  refunded:       { label: 'Refunded',   classes: 'bg-gray-100 text-gray-700' },
  payment_failed: { label: 'Failed',     classes: 'bg-red-100 text-red-700' },
};

const ALL_STATUSES: OrderStatus[] = ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded', 'payment_failed'];

export default function OrderManager() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const loadOrders = async () => {
    try {
      const data = await fetchOrders();
      setOrders(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const handleStatusUpdate = async (orderId: string, newStatus: OrderStatus) => {
    setUpdatingStatus(true);
    try {
      const updated = await updateStatus(orderId, newStatus);
      setOrders(prev => prev.map(o => o.id === orderId ? updated : o));
      if (selectedOrder?.id === orderId) {
        setSelectedOrder(updated);
      }
    } catch (err: any) {
      console.error('Failed to update order status:', err);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const filteredOrders = orders.filter(order => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = order.customerEmail?.toLowerCase().includes(term) ||
                         order.orderNumber?.toLowerCase().includes(term) ||
                         order.customerName?.toLowerCase().includes(term) ||
                         order.id.toLowerCase().includes(term);
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-10 h-10 rounded-full border-4 border-purple-200 border-t-purple-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <p className="text-red-500 font-bold">{error}</p>
        <button onClick={() => { setError(null); setLoading(true); loadOrders(); }} className="px-6 py-2 rounded-full text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Top bar */}
      <div className="bg-white rounded-3xl border border-purple-100 shadow-sm p-5 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name, email or order number…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-white border-2 border-purple-100 rounded-2xl text-sm font-bold text-purple-800 placeholder:text-purple-300 focus:outline-none focus:border-purple-400 transition-colors"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-3 bg-white border-2 border-purple-100 rounded-2xl text-sm font-bold text-purple-800 focus:outline-none focus:border-purple-400 transition-colors cursor-pointer"
        >
          <option value="all">All Statuses</option>
          {ALL_STATUSES.map(s => (
            <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
          ))}
        </select>
      </div>

      {/* Order cards */}
      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {filteredOrders.length > 0 ? (
            filteredOrders.map((order, i) => {
              const statusInfo = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
              return (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ delay: i * 0.03, duration: 0.22 }}
                  className="bg-white rounded-3xl border border-purple-100 shadow-sm p-5 flex flex-col sm:flex-row sm:items-center gap-4"
                >
                  {/* Order number + date */}
                  <div className="min-w-[130px]">
                    <p className="text-xs font-black text-purple-900 tracking-tight">
                      {order.orderNumber}
                    </p>
                    <p className="text-[11px] font-bold text-purple-400 mt-0.5">
                      {new Date(order.createdAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>

                  {/* Divider */}
                  <div className="hidden sm:block w-px h-10 bg-purple-100 flex-shrink-0" />

                  {/* Customer */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-purple-900 truncate">{order.customerName || order.customerEmail}</p>
                    <p className="text-[11px] font-bold text-purple-400 mt-0.5">
                      {order.items.length} {order.items.length === 1 ? 'item' : 'items'} · {order.channel}
                    </p>
                  </div>

                  {/* Total */}
                  <div className="min-w-[72px] text-right sm:text-left">
                    <p className="text-sm font-black text-purple-900">R{order.total.toLocaleString()}</p>
                    <p className="text-[11px] font-bold text-purple-400">Total</p>
                  </div>

                  {/* Status badge */}
                  <span className={cn('inline-flex items-center px-3 py-1 rounded-full text-[11px] font-black tracking-wide flex-shrink-0', statusInfo.classes)}>
                    {statusInfo.label}
                  </span>

                  {/* View button */}
                  <button
                    onClick={() => setSelectedOrder(order)}
                    className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-black text-white flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    View
                  </button>
                </motion.div>
              );
            })
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-3xl border border-purple-100 shadow-sm p-16 flex flex-col items-center gap-4"
            >
              <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #F9A8D4, #D8B4FE)' }}>
                <ClipboardList className="w-8 h-8 text-white" />
              </div>
              <p className="text-base font-black text-purple-900">No orders found</p>
              <p className="text-sm font-bold text-purple-400">Try adjusting your search or filter.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Order detail modal */}
      <AnimatePresence>
        {selectedOrder && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            style={{ background: 'rgba(88, 28, 135, 0.35)', backdropFilter: 'blur(6px)' }}
            onClick={(e) => { if (e.target === e.currentTarget) setSelectedOrder(null); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 20 }}
              transition={{ type: 'spring', stiffness: 340, damping: 28 }}
              className="bg-white rounded-3xl w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl"
            >
              {/* Gradient header */}
              <div
                className="p-6 flex items-center justify-between sticky top-0 z-10 rounded-t-3xl"
                style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}
              >
                <div>
                  <h2 className="text-lg font-black text-white tracking-tight">Order Details</h2>
                  <p className="text-xs font-bold text-pink-100 mt-0.5">{selectedOrder.orderNumber}</p>
                </div>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 transition-colors flex items-center justify-center flex-shrink-0"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>

              <div className="p-6 space-y-6">

                {/* Customer + Shipping */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-purple-50 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <User className="w-4 h-4 text-purple-400" />
                      <span className="text-[11px] font-black text-purple-400 uppercase tracking-widest">Customer</span>
                    </div>
                    <p className="text-sm font-black text-purple-900">{selectedOrder.customerName}</p>
                    <p className="text-[11px] font-bold text-purple-400 mt-1 break-all">{selectedOrder.customerEmail}</p>
                    {selectedOrder.customerPhone && (
                      <p className="text-[11px] font-bold text-purple-400 mt-0.5">{selectedOrder.customerPhone}</p>
                    )}
                  </div>

                  <div className="bg-purple-50 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <MapPin className="w-4 h-4 text-purple-400" />
                      <span className="text-[11px] font-black text-purple-400 uppercase tracking-widest">Shipping</span>
                    </div>
                    {selectedOrder.shippingAddress ? (
                      <p className="text-sm font-bold text-purple-900 leading-relaxed">
                        {selectedOrder.shippingAddress}<br />
                        {selectedOrder.shippingCity}{selectedOrder.shippingZip ? `, ${selectedOrder.shippingZip}` : ''}
                      </p>
                    ) : (
                      <p className="text-sm font-bold text-purple-400">No shipping address</p>
                    )}
                    {selectedOrder.trackingNumber && (
                      <div className="mt-2 flex items-center gap-2">
                        <Truck className="w-3.5 h-3.5 text-indigo-500" />
                        <p className="text-[11px] font-bold text-indigo-600">
                          {selectedOrder.trackingNumber}
                          {selectedOrder.carrier && ` · ${selectedOrder.carrier}`}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Divider */}
                <div className="h-px bg-purple-100" />

                {/* Order summary */}
                <div className="bg-purple-50 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Package className="w-4 h-4 text-purple-400" />
                    <span className="text-[11px] font-black text-purple-400 uppercase tracking-widest">Order Summary</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm font-bold text-purple-700">
                      <span>Subtotal</span>
                      <span>R{selectedOrder.subtotal.toLocaleString()}</span>
                    </div>
                    {selectedOrder.discount > 0 && (
                      <div className="flex justify-between text-sm font-bold text-green-600">
                        <span>Discount</span>
                        <span>-R{selectedOrder.discount.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-bold text-purple-700">
                      <span>Shipping</span>
                      <span>{selectedOrder.shippingCost > 0 ? `R${selectedOrder.shippingCost.toLocaleString()}` : <span className="text-green-600 font-black">Free</span>}</span>
                    </div>
                    <div className="h-px bg-purple-200 my-2" />
                    <div className="flex justify-between text-base font-black text-purple-900">
                      <span>Total</span>
                      <span>R{selectedOrder.total.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-[11px] font-bold text-purple-400">
                      <span>Channel</span>
                      <span className="uppercase">{selectedOrder.channel}</span>
                    </div>
                    {selectedOrder.paymentMethod && (
                      <div className="flex justify-between text-[11px] font-bold text-purple-400">
                        <span>Payment</span>
                        <span className="uppercase">{selectedOrder.paymentMethod}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Divider */}
                <div className="h-px bg-purple-100" />

                {/* Items */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <ShoppingBag className="w-4 h-4 text-purple-400" />
                    <span className="text-[11px] font-black text-purple-400 uppercase tracking-widest">
                      Items ({selectedOrder.items.length})
                    </span>
                  </div>
                  <div className="space-y-3">
                    {selectedOrder.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-4 bg-white border border-purple-100 rounded-2xl p-3"
                      >
                        <div className="w-14 h-14 rounded-xl overflow-hidden bg-purple-50 flex-shrink-0">
                          {item.productImageUrl ? (
                            <img src={item.productImageUrl} className="w-full h-full object-cover" alt={item.productName} />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="w-6 h-6 text-purple-300" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-black text-purple-900 truncate">{item.productName}</p>
                          <p className="text-[11px] font-bold text-purple-400 mt-0.5">
                            R{item.unitPrice.toLocaleString()} × {item.quantity}
                          </p>
                        </div>
                        <p className="text-sm font-black text-purple-900 flex-shrink-0">R{item.lineTotal.toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Divider */}
                <div className="h-px bg-purple-100" />

                {/* Status update pill buttons */}
                <div>
                  <p className="text-[11px] font-black text-purple-400 uppercase tracking-widest mb-3">Update Status</p>
                  <div className="flex flex-wrap gap-2">
                    {ALL_STATUSES.map(status => {
                      const isActive = selectedOrder.status === status;
                      const config = STATUS_CONFIG[status];
                      return (
                        <button
                          key={status}
                          disabled={updatingStatus}
                          onClick={() => handleStatusUpdate(selectedOrder.id, status)}
                          className={cn(
                            'px-4 py-2 rounded-full text-xs font-black transition-all disabled:opacity-60',
                            isActive
                              ? 'text-white shadow-md scale-105'
                              : `${config.classes} opacity-70 hover:opacity-100 hover:scale-105`
                          )}
                          style={isActive ? { background: 'linear-gradient(135deg, #F472B6, #A855F7)' } : undefined}
                        >
                          {config.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Admin notes */}
                {selectedOrder.adminNotes && (
                  <>
                    <div className="h-px bg-purple-100" />
                    <div className="bg-amber-50 rounded-2xl p-4">
                      <p className="text-[11px] font-black text-amber-500 uppercase tracking-widest mb-2">Admin Notes</p>
                      <p className="text-sm font-bold text-amber-800">{selectedOrder.adminNotes}</p>
                    </div>
                  </>
                )}

              </div>

              {/* Footer */}
              <div className="px-6 pb-6 flex justify-end">
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="px-6 py-3 rounded-full text-sm font-black text-white"
                  style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
