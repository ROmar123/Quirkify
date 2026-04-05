import { useEffect, useState } from 'react';
import { auth, db } from '../../firebase';
import { signIn } from '../../firebase';
import { LogIn, ShoppingBag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

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
  shippingInfo: { address: string; city: string; zip: string };
}

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

    try {
      // Simple query without orderBy to avoid composite index requirement
      const q = query(collection(db, 'orders'), where('userId', '==', auth.currentUser.uid));

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
        setOrders(data);
        setLoading(false);
      }, (error: any) => {
        setError(error?.message || 'Failed to load orders');
        setLoading(false);
      });

      return () => unsubscribe();
    } catch (err) {
      setError('Failed to set up orders listener');
      setLoading(false);
    }
  }, []);

  if (!auth.currentUser) {
    return (
      <div className="max-w-lg mx-auto px-4 py-32 text-center">
        <div className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}>
          <LogIn className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-3xl font-black mb-3 text-purple-900">Sign in to view orders</h2>
        <p className="text-purple-400 text-sm font-semibold mb-8">Your order history is just a sign-in away.</p>
        <button onClick={signIn} className="px-10 py-4 rounded-full font-bold text-white text-base" style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}>
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
      <h1 className="text-6xl md:text-8xl font-black mb-12 text-purple-900">My Orders</h1>

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
          {orders.map((order) => (
            <div key={order.id} className="bg-white rounded-3xl border border-purple-100 p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div>
                  <p className="text-[8px] font-bold text-purple-400 uppercase tracking-widest mb-1">Order</p>
                  <p className="text-sm font-black">#{order.id.slice(-8).toUpperCase()}</p>
                </div>
                <div>
                  <p className="text-[8px] font-bold text-purple-400 uppercase tracking-widest mb-1">Total</p>
                  <p className="text-lg font-black text-purple-900">R{order.total}</p>
                </div>
                <div>
                  <p className="text-[8px] font-bold text-purple-400 uppercase tracking-widest mb-1">Status</p>
                  <p className="px-3 py-1 rounded-full text-xs font-black text-white" style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}>
                    {order.status.toUpperCase()}
                  </p>
                </div>
              </div>

              <div className="space-y-2 border-t border-purple-100 pt-6">
                {order.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-purple-50 rounded-2xl">
                    <div className="flex-1">
                      <p className="text-sm font-bold text-purple-900">{item.name}</p>
                      <p className="text-[9px] text-purple-400 font-bold">Qty: {item.quantity}</p>
                    </div>
                    <p className="font-black text-sm text-purple-900">R{item.price * item.quantity}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t border-purple-100">
                <p className="text-[9px] font-bold text-purple-400 uppercase mb-2">Shipping to</p>
                <p className="text-sm font-semibold text-purple-800">
                  {order.shippingInfo?.address}<br />
                  {order.shippingInfo?.city}, {order.shippingInfo?.zip}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
