import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { motion, AnimatePresence } from 'motion/react';
import { ClipboardList, Package, Clock, CheckCircle2, Truck, AlertCircle, Search, Filter, Eye, MoreVertical } from 'lucide-react';
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

export default function OrderManager() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'orders');
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const updateOrderStatus = async (orderId: string, newStatus: Order['status']) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), { status: newStatus });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
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
      <div className="p-12 text-center">
        <div className="animate-spin w-8 h-8 border-2 border-quirky border-t-transparent rounded-full mx-auto" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-6 border border-zinc-100">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input 
            type="text" 
            placeholder="Search by Email or Order ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-zinc-50 border border-zinc-100 text-xs font-bold focus:outline-none focus:border-black transition-colors"
          />
        </div>
        <div className="flex items-center gap-4">
          <Filter className="w-4 h-4 text-zinc-400" />
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-3 bg-zinc-50 border border-zinc-100 text-xs font-bold focus:outline-none focus:border-black transition-colors"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      <div className="bg-white border border-zinc-100 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-zinc-50 border-b border-zinc-100">
              <th className="px-6 py-4 text-[8px] font-bold uppercase tracking-widest text-zinc-400">Order Details</th>
              <th className="px-6 py-4 text-[8px] font-bold uppercase tracking-widest text-zinc-400">Customer</th>
              <th className="px-6 py-4 text-[8px] font-bold uppercase tracking-widest text-zinc-400">Total</th>
              <th className="px-6 py-4 text-[8px] font-bold uppercase tracking-widest text-zinc-400">Status</th>
              <th className="px-6 py-4 text-[8px] font-bold uppercase tracking-widest text-zinc-400">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50">
            {filteredOrders.map((order) => (
              <tr key={order.id} className="hover:bg-zinc-50/50 transition-colors">
                <td className="px-6 py-4">
                  <p className="text-[10px] font-bold uppercase">#{order.id.slice(-8)}</p>
                  <p className="text-[8px] text-zinc-400 font-bold uppercase tracking-widest">
                    {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleString() : 'Just now'}
                  </p>
                </td>
                <td className="px-6 py-4">
                  <p className="text-[10px] font-bold">{order.userEmail}</p>
                  <p className="text-[8px] text-zinc-400 font-bold uppercase tracking-widest">{order.items.length} Items</p>
                </td>
                <td className="px-6 py-4">
                  <p className="text-[10px] font-bold">R{order.total}</p>
                </td>
                <td className="px-6 py-4">
                  <select 
                    value={order.status}
                    onChange={(e) => updateOrderStatus(order.id, e.target.value as Order['status'])}
                    className={cn(
                      "px-3 py-1 text-[8px] font-bold uppercase tracking-widest border focus:outline-none",
                      order.status === 'delivered' ? "bg-green-50 border-green-100 text-green-600" :
                      order.status === 'shipped' ? "bg-blue-50 border-blue-100 text-blue-600" :
                      order.status === 'processing' ? "bg-amber-50 border-amber-100 text-amber-600" :
                      order.status === 'cancelled' ? "bg-red-50 border-red-100 text-red-600" :
                      "bg-zinc-100 border-zinc-200 text-zinc-500"
                    )}
                  >
                    <option value="pending">Pending</option>
                    <option value="processing">Processing</option>
                    <option value="shipped">Shipped</option>
                    <option value="delivered">Delivered</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </td>
                <td className="px-6 py-4">
                  <button 
                    onClick={() => setSelectedOrder(order)}
                    className="p-2 hover:bg-zinc-100 transition-colors"
                  >
                    <Eye className="w-4 h-4 text-zinc-400" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredOrders.length === 0 && (
          <div className="p-20 text-center">
            <ClipboardList className="w-12 h-12 mx-auto mb-4 text-zinc-100" />
            <p className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest">No orders found matching your criteria.</p>
          </div>
        )}
      </div>

      {/* Order Detail Modal */}
      <AnimatePresence>
        {selectedOrder && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-none shadow-2xl"
            >
              <div className="p-8 border-b border-zinc-100 flex items-center justify-between sticky top-0 bg-white z-10">
                <div>
                  <h2 className="text-xl font-bold uppercase tracking-tighter font-display">Order Details</h2>
                  <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest">#{selectedOrder.id}</p>
                </div>
                <button 
                  onClick={() => setSelectedOrder(null)}
                  className="p-2 hover:bg-zinc-100 transition-colors"
                >
                  <AlertCircle className="w-5 h-5 rotate-45" />
                </button>
              </div>

              <div className="p-8 space-y-8">
                <div className="grid grid-cols-2 gap-12">
                  <div>
                    <h3 className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest mb-4">Customer Info</h3>
                    <p className="text-[10px] font-bold uppercase mb-1">{selectedOrder.userEmail}</p>
                    <p className="text-[8px] text-zinc-400 font-bold uppercase tracking-widest mb-4">User ID: {selectedOrder.userId}</p>
                    
                    <h3 className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest mb-4 mt-8">Shipping Address</h3>
                    <p className="text-[10px] font-bold uppercase leading-relaxed">
                      {selectedOrder.shippingInfo.address}<br />
                      {selectedOrder.shippingInfo.city}, {selectedOrder.shippingInfo.zip}
                    </p>
                  </div>
                  <div className="bg-zinc-50 p-6 border border-zinc-100">
                    <h3 className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest mb-4">Order Summary</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px] font-bold uppercase">
                        <span>Subtotal</span>
                        <span>R{selectedOrder.total}</span>
                      </div>
                      <div className="flex justify-between text-[10px] font-bold uppercase">
                        <span>Shipping</span>
                        <span className="text-green-600">Free</span>
                      </div>
                      <div className="h-px bg-zinc-200 my-4" />
                      <div className="flex justify-between text-sm font-bold uppercase">
                        <span>Total</span>
                        <span>R{selectedOrder.total}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest mb-4">Items ({selectedOrder.items.length})</h3>
                  <div className="space-y-4">
                    {selectedOrder.items.map((item) => (
                      <div key={item.id} className="flex items-center gap-4 p-4 border border-zinc-100">
                        <div className="w-16 h-16 bg-zinc-50 border border-zinc-100 flex-shrink-0">
                          <img src={item.imageUrl} className="w-full h-full object-cover grayscale" alt="" />
                        </div>
                        <div className="flex-1">
                          <h4 className="text-[10px] font-bold uppercase tracking-tight">{item.name}</h4>
                          <p className="text-[8px] text-zinc-400 font-bold uppercase tracking-widest">R{item.price} x {item.quantity}</p>
                        </div>
                        <p className="text-[10px] font-bold uppercase">R{item.price * item.quantity}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-8 bg-zinc-50 border-t border-zinc-100 flex justify-end gap-4">
                <button 
                  onClick={() => setSelectedOrder(null)}
                  className="px-8 py-3 bg-white border border-zinc-200 text-[10px] font-bold uppercase tracking-widest hover:bg-zinc-100 transition-all"
                >
                  Close
                </button>
                <button 
                  className="px-8 py-3 bg-black text-white text-[10px] font-bold uppercase tracking-widest hover:bg-quirky transition-all"
                >
                  Print Invoice
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
