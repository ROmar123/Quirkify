import { useEffect, useMemo, useState } from 'react';
import { cancelOrder, fetchOrdersForCustomer } from '../../services/commerceService';
import { useSession } from '../../hooks/useSession';
import { currency, formatDate } from '../../lib/quirkify';
import type { Order } from '../../types';

const journeySteps = [
  { key: 'pending_payment', label: 'Payment' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'processing', label: 'Packing' },
  { key: 'shipped', label: 'In transit' },
  { key: 'delivered', label: 'Delivered' },
] as const;

function stageIndex(order: Order) {
  if (order.status === 'cancelled' || order.status === 'refunded') return -1;
  if (order.status === 'delivered') return 4;
  if (order.status === 'shipped') return 3;
  if (order.status === 'ready_to_ship' || order.status === 'processing') return 2;
  if (order.status === 'confirmed') return 1;
  return 0;
}

export default function Orders() {
  const { profile } = useSession();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    let active = true;
    setLoading(true);
    setError(null);
    void fetchOrdersForCustomer(profile.id)
      .then((rows) => {
        if (active) setOrders(rows);
      })
      .catch((loadError) => {
        if (!active) return;
        setOrders([]);
        setError(loadError instanceof Error ? loadError.message : 'Failed to load orders');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [profile]);

  const grouped = useMemo(() => ({
    active: orders.filter((order) => !['delivered', 'cancelled', 'refunded'].includes(order.status)),
    closed: orders.filter((order) => ['delivered', 'cancelled', 'refunded'].includes(order.status)),
  }), [orders]);

  if (!profile) {
    return <div className="px-4 py-10 text-white">Loading orders...</div>;
  }

  return (
    <section className="bg-[linear-gradient(180deg,#091019,#101823_28%,#f4efe6_28%,#f4efe6)] px-4 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 text-white">
          <p className="text-[11px] uppercase tracking-[0.35em] text-[#9fd3c7]">Customer View</p>
          <h1 className="mt-4 text-4xl font-black">Orders</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/68">
            Every order is shown as a visual journey so payment, packing, transit, and delivery are obvious at a glance.
          </p>
        </div>
        {error ? (
          <div className="mb-6 rounded-[1.5rem] border border-red-300/20 bg-red-500/10 px-5 py-4 text-sm text-red-100">
            {error}
          </div>
        ) : null}
        <div className="space-y-4">
          {orders.length === 0 ? (
            <div className="rounded-[1.75rem] border border-dashed border-black/10 bg-white p-8 text-sm text-[#10151e]/60">
              {loading ? 'Loading your orders…' : 'You have no orders yet.'}
            </div>
          ) : [...grouped.active, ...grouped.closed].map((order) => (
            <article key={order.id} className="rounded-[1.75rem] border border-black/8 bg-white p-6 shadow-[0_10px_40px_rgba(15,21,30,0.08)]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.25em] text-[#725d34]">{order.orderNumber}</p>
                  <h2 className="mt-2 text-2xl font-black">{order.orderType} order</h2>
                  <p className="mt-2 text-sm text-[#10151e]/60">Placed {formatDate(order.createdAt)}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black">{currency(order.total)}</p>
                  <p className="text-sm text-[#10151e]/60">{order.status} · {order.paymentStatus}</p>
                </div>
              </div>
              <div className="mt-5 rounded-[1.5rem] bg-[#f8f4ec] p-5">
                {order.status === 'cancelled' || order.status === 'refunded' ? (
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#725d34]">Journey stopped</p>
                    <p className="text-sm text-[#10151e]/60">{order.status}</p>
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-5">
                    {journeySteps.map((step, index) => {
                      const current = stageIndex(order);
                      const isComplete = index <= current;
                      return (
                        <div key={step.key} className="rounded-[1.25rem] border border-black/8 bg-white px-4 py-4">
                          <div className={`h-2 rounded-full ${isComplete ? 'bg-[#10151e]' : 'bg-black/10'}`} />
                          <p className="mt-3 text-[11px] uppercase tracking-[0.22em] text-[#725d34]">{step.label}</p>
                          <p className="mt-1 text-sm font-bold text-[#10151e]">
                            {index === current ? 'Current' : isComplete ? 'Done' : 'Queued'}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-[1.25rem] border border-black/8 bg-white px-4 py-4 text-sm">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-[#725d34]">Payment</p>
                    <p className="mt-2 font-bold text-[#10151e]">{order.paymentStatus.replaceAll('_', ' ')}</p>
                  </div>
                  <div className="rounded-[1.25rem] border border-black/8 bg-white px-4 py-4 text-sm">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-[#725d34]">Shipping</p>
                    <p className="mt-2 font-bold text-[#10151e]">{order.shippingStatus.replaceAll('_', ' ')}</p>
                  </div>
                  <div className="rounded-[1.25rem] border border-black/8 bg-white px-4 py-4 text-sm">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-[#725d34]">Delivery address</p>
                    <p className="mt-2 font-bold text-[#10151e]">
                      {order.shippingAddress ? `${order.shippingAddress.city} ${order.shippingAddress.postalCode}` : 'Pending address review'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-5 grid gap-3">
                {order.items.map((item) => (
                  <div key={`${order.id}-${item.refId}`} className="flex items-center justify-between rounded-2xl bg-[#f8f4ec] px-4 py-3 text-sm">
                    <span>{item.title}</span>
                    <span>{item.quantity} × {currency(item.unitPrice)}</span>
                  </div>
                ))}
              </div>
              {order.status === 'pending_payment' && (
                <div className="mt-5 flex flex-wrap gap-3">
                  {order.checkoutUrl ? (
                    <a href={order.checkoutUrl} className="rounded-full bg-[#10151e] px-4 py-2 text-sm font-bold text-white">
                      Resume payment
                    </a>
                  ) : null}
                  <button
                    onClick={async () => {
                      setBusyOrderId(order.id);
                      setError(null);
                      try {
                        await cancelOrder(order.id);
                        setOrders((current) => current.map((item) => item.id === order.id ? { ...item, status: 'cancelled' } : item));
                      } catch (cancelError) {
                        setError(cancelError instanceof Error ? cancelError.message : 'Failed to cancel order');
                      } finally {
                        setBusyOrderId(null);
                      }
                    }}
                    disabled={busyOrderId === order.id}
                    className="rounded-full border border-black/10 px-4 py-2 text-sm font-bold text-[#10151e]"
                  >
                    {busyOrderId === order.id ? 'Cancelling...' : 'Cancel order'}
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
