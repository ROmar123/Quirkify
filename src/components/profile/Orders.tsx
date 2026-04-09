import { useEffect, useState } from 'react';
import { getCurrentUser } from '../../services/authService';
import { LogIn, ShoppingBag, Package, Truck, CheckCircle, Clock, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchOrders, Order } from '../../services/orderService';
import { getProfileByUid } from '../../services/profileService';
import { cn } from '../../lib/utils';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: 'Pending', color: 'bg-amber-100 text-amber-700', icon: Clock },
  paid: { label: 'Paid', color: 'bg-blue-100 text-blue-700', icon: CheckCircle },
  processing: { label: 'Processing', color: 'bg-purple-100 text-purple-700', icon: Package },
  shipped: { label: 'Shipped', color: 'bg-indigo-100 text-indigo-700', icon: Truck },
  delivered: { label: 'Delivered', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-700', icon: XCircle },
  refunded: { label: 'Refunded', color: 'bg-gray-100 text-gray-700', icon: XCircle },
  payment_failed: { label: 'Failed', color: 'bg-red-100 text-red-700', icon: XCircle },
};

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!auth.currentUser) {
      setLoading(false);
      return;
    }

    const loadOrders = async () => {
      try {
        const profile = await getProfileByUid(auth.currentUser!.uid);
        if (!profile) {
          setOrders([]);
          setLoading(false);
          return;
        }
        const data = await fetchOrders({ profileId: profile.id });
        setOrders(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load orders');
      } finally {
        setLoading(false);
      }
    };

    loadOrders();
  }, []);

  if (!auth.currentUser) {
    return (
      <div className="max-w-lg mx-auto px-4 py-32 text-center">
        <div className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}>
          <LogIn className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-3xl font-black mb-3 text-purple-900">Sign in to view orders</h2>
        <p className="text-purple-400 text-sm font-semibold mb-8">Your order history is just a sign-in away.</p>
        <button onClick={() => void signIn('/orders')} className="px-10 py-4 rounded-full font-bold text-white text-base" style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}>
          Sign In with Google
        </button>
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

  if (error) {
    return (
      <div className="max-w-lg mx-auto px-4 py-32 text-center">
        <div className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center bg-red-50">
          <ShoppingBag className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-3xl font-black mb-3 text-red-600">Error loading orders</h2>
        <p className="text-red-400 text-sm font-semibold mb-8">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <h1 className="text-4xl sm:text-6xl font-black mb-12 text-purple-900">My Orders</h1>

      {orders.length === 0 ? (
        <div className="text-center py-32 rounded-3xl border border-purple-100 bg-purple-50">
          <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #A855F7, #6366F1)' }}>
            <ShoppingBag className="w-8 h-8 text-white" />
          </div>
          <p className="text-purple-400 font-bold text-sm mb-4">No orders yet</p>
          <button onClick={() => navigate('/')} className="px-8 py-3 rounded-full font-bold text-white text-sm" style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}>
            Start Shopping
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {orders.map((order) => {
            const statusInfo = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
            const StatusIcon = statusInfo.icon;
            return (
              <div key={order.id} className="bg-white rounded-3xl border border-purple-100 p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                  <div>
                    <p className="text-[8px] font-bold text-purple-400 uppercase tracking-widest mb-1">Order</p>
                    <p className="text-sm font-black">{order.orderNumber}</p>
                    <p className="text-[10px] text-purple-400 mt-1">
                      {new Date(order.createdAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <div>
                    <p className="text-[8px] font-bold text-purple-400 uppercase tracking-widest mb-1">Channel</p>
                    <p className="text-xs font-black text-purple-700 uppercase">{order.channel}</p>
                  </div>
                  <div>
                    <p className="text-[8px] font-bold text-purple-400 uppercase tracking-widest mb-1">Total</p>
                    <p className="text-lg font-black text-purple-900">R{order.total.toLocaleString()}</p>
                  </div>
                  <div>
                    <span className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black', statusInfo.color)}>
                      <StatusIcon className="w-3.5 h-3.5" />
                      {statusInfo.label}
                    </span>
                  </div>
                </div>

                {order.trackingNumber && (
                  <div className="mb-4 p-3 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center gap-3">
                    <Truck className="w-4 h-4 text-indigo-600" />
                    <div>
                      <p className="text-xs font-bold text-indigo-700">Tracking: {order.trackingNumber}</p>
                      {order.carrier && <p className="text-[10px] text-indigo-500">{order.carrier}</p>}
                    </div>
                  </div>
                )}

                <div className="space-y-2 border-t border-purple-100 pt-4">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 p-3 bg-purple-50 rounded-2xl">
                      {item.productImageUrl && (
                        <img src={item.productImageUrl} className="w-10 h-10 rounded-xl object-cover flex-shrink-0" alt="" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-purple-900 truncate">{item.productName}</p>
                        <p className="text-[9px] text-purple-400 font-bold">Qty: {item.quantity}</p>
                      </div>
                      <p className="font-black text-sm text-purple-900">R{item.lineTotal.toLocaleString()}</p>
                    </div>
                  ))}
                </div>

                {order.shippingAddress && (
                  <div className="mt-4 pt-4 border-t border-purple-100">
                    <p className="text-[9px] font-bold text-purple-400 uppercase mb-2">Shipping to</p>
                    <p className="text-sm font-semibold text-purple-800">
                      {order.shippingAddress}<br />
                      {order.shippingCity}{order.shippingZip ? `, ${order.shippingZip}` : ''}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
