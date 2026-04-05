import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { motion, AnimatePresence } from 'motion/react';
import { ClipboardList, Search, Eye, X, MapPin, User, ShoppingBag, Package } from 'lucide-react';

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
  userEmail: string;
  items: OrderItem[];
  total: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  createdAt: any;
  shippingInfo: {
    email: string;
    address: string;
    city: string;
    zip: string;
  };
}

const STATUS_CONFIG: Record<Order['status'], { label: string; classes: string }> = {
  pending:    { label: 'Pending',    classes: 'bg-purple-100 text-purple-700' },
  processing: { label: 'Processing', classes: 'bg-amber-100 text-amber-700' },
  shipped:    { label: 'Shipped',    classes: 'bg-blue-100 text-blue-700' },
  delivered:  { label: 'Delivered',  classes: 'bg-green-100 text-green-700' },
  cancelled:  { label: 'Cancelled',  classes: 'bg-red-100 text-red-700' },
};

const ALL_STATUSES: Order['status'][] = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

export default function OrderManager() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    try {
      // IMPORTANT: This query requires a Firestore composite index
      // Index name: 'orders_createdAt_desc'
      // Fields: createdAt (Descending)
      // Create in Firebase Console if query fails with "requires a composite index" error
      const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        try {
          setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));
          setLoading(false);
        } catch (err) {
          console.error('Error mapping orders:', err);
          setLoading(false);
        }
      }, (error) => {
        console.error('Firestore listener error:', error);
        handleFirestoreError(error, OperationType.LIST, 'orders');
        setLoading(false);
      });

      return unsubscribe;
    } catch (err) {
      console.error('Error setting up Firestore listener:', err);
      setLoading(false);
      return () => {};
    }
  }, []);

  const updateOrderStatus = async (orderId: string, newStatus: Order['status']) => {
    setUpdatingStatus(true);
    try {
      await updateDoc(doc(db, 'orders', orderId), { status: newStatus });
      if (selectedOrder?.id === orderId) {
        setSelectedOrder(prev => prev ? { ...prev, status: newStatus } : null);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.userEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.id.toLowerCase().includes(searchTerm.toLowerCase());
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

  return (
    <div className="space-y-6">

      {/* Top bar */}
      <div className="bg-white rounded-3xl border border-purple-100 shadow-sm p-5 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by email or order ID…"
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
            filteredOrders.map((order, i) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ delay: i * 0.03, duration: 0.22 }}
                className="bg-white rounded-3xl border border-purple-100 shadow-sm p-5 flex flex-col sm:flex-row sm:items-center gap-4"
              >
                {/* Order ID + date */}
                <div className="min-w-[110px]">
                  <p className="text-xs font-black text-purple-900 tracking-tight">
                    #{order.id.slice(-8).toUpperCase()}
                  </p>
                  <p className="text-[11px] font-bold text-purple-400 mt-0.5">
                    {order.createdAt?.toDate
                      ? order.createdAt.toDate().toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
                      : 'Just now'}
                  </p>
                </div>

                {/* Divider */}
                <div className="hidden sm:block w-px h-10 bg-purple-100 flex-shrink-0" />

                {/* Customer */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-purple-900 truncate">{order.userEmail}</p>
                  <p className="text-[11px] font-bold text-purple-400 mt-0.5">
                    {order.items.length} {order.items.length === 1 ? 'item' : 'items'}
                  </p>
                </div>

                {/* Total */}
                <div className="min-w-[72px] text-right sm:text-left">
                  <p className="text-sm font-black text-purple-900">R{order.total}</p>
                  <p className="text-[11px] font-bold text-purple-400">Total</p>
                </div>

                {/* Status badge */}
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-black tracking-wide flex-shrink-0 ${STATUS_CONFIG[order.status].classes}`}>
                  {STATUS_CONFIG[order.status].label}
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
            ))
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
                  <p className="text-xs font-bold text-pink-100 mt-0.5">#{selectedOrder.id}</p>
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
                    <p className="text-sm font-black text-purple-900 break-all">{selectedOrder.userEmail}</p>
                    <p className="text-[11px] font-bold text-purple-400 mt-1 break-all">ID: {selectedOrder.userId}</p>
                  </div>

                  <div className="bg-purple-50 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <MapPin className="w-4 h-4 text-purple-400" />
                      <span className="text-[11px] font-black text-purple-400 uppercase tracking-widest">Shipping</span>
                    </div>
                    <p className="text-sm font-bold text-purple-900 leading-relaxed">
                      {selectedOrder.shippingInfo.address}<br />
                      {selectedOrder.shippingInfo.city}, {selectedOrder.shippingInfo.zip}
                    </p>
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
                      <span>R{selectedOrder.total}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold text-purple-700">
                      <span>Shipping</span>
                      <span className="text-green-600 font-black">Free</span>
                    </div>
                    <div className="h-px bg-purple-200 my-2" />
                    <div className="flex justify-between text-base font-black text-purple-900">
                      <span>Total</span>
                      <span>R{selectedOrder.total}</span>
                    </div>
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
                          <img src={item.imageUrl} className="w-full h-full object-cover" alt={item.name} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-black text-purple-900 truncate">{item.name}</p>
                          <p className="text-[11px] font-bold text-purple-400 mt-0.5">
                            R{item.price} × {item.quantity}
                          </p>
                        </div>
                        <p className="text-sm font-black text-purple-900 flex-shrink-0">R{item.price * item.quantity}</p>
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
                      return (
                        <button
                          key={status}
                          disabled={updatingStatus}
                          onClick={() => updateOrderStatus(selectedOrder.id, status)}
                          className={`px-4 py-2 rounded-full text-xs font-black transition-all disabled:opacity-60 ${
                            isActive
                              ? 'text-white shadow-md scale-105'
                              : `${STATUS_CONFIG[status].classes} opacity-70 hover:opacity-100 hover:scale-105`
                          }`}
                          style={isActive ? { background: 'linear-gradient(135deg, #F472B6, #A855F7)' } : undefined}
                        >
                          {STATUS_CONFIG[status].label}
                        </button>
                      );
                    })}
                  </div>
                </div>

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
