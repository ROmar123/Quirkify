import { useEffect, useState } from 'react';
import { fetchOrdersForAdmin, updateOrder } from '../../services/commerceService';
import { currency, formatDate } from '../../lib/quirkify';
import type { Order, OrderStatus, PaymentStatus, ShippingStatus } from '../../types';

const orderStatuses: OrderStatus[] = ['pending_payment', 'confirmed', 'processing', 'ready_to_ship', 'shipped', 'delivered', 'cancelled', 'refunded'];
const paymentStatuses: PaymentStatus[] = ['unpaid', 'pending', 'paid', 'failed', 'cancelled', 'refunded', 'manual_review'];
const shippingStatuses: ShippingStatus[] = ['not_started', 'packing', 'ready', 'shipped', 'delivered', 'returned'];

const fulfilmentStages = [
  { label: 'Payment secure', statuses: ['confirmed', 'processing', 'ready_to_ship', 'shipped', 'delivered'] },
  { label: 'Picking and packing', statuses: ['processing', 'ready_to_ship', 'shipped', 'delivered'] },
  { label: 'Carrier handoff', statuses: ['ready_to_ship', 'shipped', 'delivered'] },
  { label: 'In transit', statuses: ['shipped', 'delivered'] },
  { label: 'Delivered', statuses: ['delivered'] },
] as const;

function stageActive(order: Order, stage: (typeof fulfilmentStages)[number]) {
  return (stage.statuses as readonly string[]).includes(order.status);
}

export default function CommercePage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  const [trackingNumbers, setTrackingNumbers] = useState<Record<string, string>>({});
  const [carriers, setCarriers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void fetchOrdersForAdmin()
      .then((rows) => {
        if (active) setOrders(rows);
      })
      .catch((loadError) => {
        if (!active) return;
        setOrders([]);
        setError(loadError instanceof Error ? loadError.message : 'Failed to load commerce operations');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function patchOrder(orderId: string, payload: Record<string, unknown>) {
    setBusyOrderId(orderId);
    setError(null);
    try {
      const result = await updateOrder(orderId, payload);
      setOrders((current) => current.map((item) => (item.id === orderId ? result.order : item)));
    } catch (patchError) {
      setError(patchError instanceof Error ? patchError.message : 'Failed to update order');
    } finally {
      setBusyOrderId(null);
    }
  }

  return (
    <section className="bg-[linear-gradient(180deg,#091019,#101823_30%,#f4efe6_30%,#f4efe6)] px-4 py-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 text-white">
          <p className="text-[11px] uppercase tracking-[0.35em] text-[#f6c971]">Admin View</p>
          <h1 className="mt-4 text-4xl font-black">Commerce operations</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/68">
            Keep fulfilment operationally clean: secure payment, pack accurately, hand over to courier, track the journey, and close delivery with auditable notes.
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
              {loading ? 'Loading commerce operations…' : 'No orders yet.'}
            </div>
          ) : orders.map((order) => (
            <article key={order.id} className="rounded-[1.75rem] border border-black/8 bg-white p-6 shadow-[0_10px_40px_rgba(15,21,30,0.08)]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.25em] text-[#725d34]">{order.orderNumber}</p>
                  <h2 className="mt-2 text-2xl font-black">{order.customerName}</h2>
                  <p className="mt-2 text-sm text-[#10151e]/60">{formatDate(order.createdAt)} · {order.orderType}</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-black">{currency(order.total)}</p>
                  <p className="text-sm text-[#10151e]/60">{order.customerEmail}</p>
                </div>
              </div>
              <div className="mt-5 rounded-[1.5rem] bg-[#f8f4ec] p-5">
                <div className="grid gap-3 md:grid-cols-5">
                  {fulfilmentStages.map((stage) => (
                    <div key={stage.label} className="rounded-[1.25rem] border border-black/8 bg-white px-4 py-4">
                      <div className={`h-2 rounded-full ${stageActive(order, stage) ? 'bg-[#10151e]' : 'bg-black/10'}`} />
                      <p className="mt-3 text-[11px] uppercase tracking-[0.22em] text-[#725d34]">{stage.label}</p>
                      <p className="mt-1 text-sm font-bold text-[#10151e]">{stageActive(order, stage) ? 'Active' : 'Pending'}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-[1.25rem] border border-black/8 bg-white px-4 py-4 text-sm">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-[#725d34]">Customer</p>
                    <p className="mt-2 font-bold text-[#10151e]">{order.customerName}</p>
                    <p className="mt-1 text-[#10151e]/60">{order.customerPhone || 'No phone captured'}</p>
                  </div>
                  <div className="rounded-[1.25rem] border border-black/8 bg-white px-4 py-4 text-sm">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-[#725d34]">Shipping destination</p>
                    <p className="mt-2 font-bold text-[#10151e]">{order.shippingAddress?.line1 || 'No address captured yet'}</p>
                    <p className="mt-1 text-[#10151e]/60">
                      {order.shippingAddress ? `${order.shippingAddress.city} ${order.shippingAddress.postalCode}` : 'Awaiting customer address'}
                    </p>
                  </div>
                  <div className="rounded-[1.25rem] border border-black/8 bg-white px-4 py-4 text-sm">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-[#725d34]">Courier status</p>
                    <p className="mt-2 font-bold text-[#10151e]">{order.carrier || 'Courier not assigned'}</p>
                    <p className="mt-1 text-[#10151e]/60">{order.trackingNumber || 'Tracking pending'}</p>
                  </div>
                </div>
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <label className="text-sm">
                  <span className="mb-1 block font-semibold text-[#10151e]/60">Order status</span>
                  <select value={order.status} onChange={(e) => void patchOrder(order.id, { status: e.target.value })} className="input bg-[#f8f4ec]">
                    {orderStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="mb-1 block font-semibold text-[#10151e]/60">Payment</span>
                  <select value={order.paymentStatus} onChange={(e) => void patchOrder(order.id, { paymentStatus: e.target.value })} className="input bg-[#f8f4ec]">
                    {paymentStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="mb-1 block font-semibold text-[#10151e]/60">Shipping</span>
                  <select value={order.shippingStatus} onChange={(e) => void patchOrder(order.id, { shippingStatus: e.target.value })} className="input bg-[#f8f4ec]">
                    {shippingStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                </label>
              </div>
              <div className="mt-4 grid gap-3">
                {order.items.map((item) => (
                  <div key={`${order.id}-${item.refId}`} className="rounded-2xl bg-[#f8f4ec] px-4 py-3 text-sm">
                    {item.title} · {item.quantity} × {currency(item.unitPrice)}
                  </div>
                ))}
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                <input
                  value={carriers[order.id] ?? order.carrier ?? ''}
                  onChange={(e) => setCarriers((current) => ({ ...current, [order.id]: e.target.value }))}
                  placeholder="Courier partner"
                  className="input bg-[#f8f4ec]"
                />
                <input
                  value={trackingNumbers[order.id] ?? order.trackingNumber ?? ''}
                  onChange={(e) => setTrackingNumbers((current) => ({ ...current, [order.id]: e.target.value }))}
                  placeholder="Tracking number"
                  className="input bg-[#f8f4ec]"
                />
                <button
                  onClick={() =>
                    void patchOrder(order.id, {
                      carrier: carriers[order.id] ?? order.carrier ?? '',
                      trackingNumber: trackingNumbers[order.id] ?? order.trackingNumber ?? '',
                    })
                  }
                  disabled={busyOrderId === order.id}
                  className="rounded-full bg-[#10151e] px-4 py-2 text-sm font-bold text-white"
                >
                  {busyOrderId === order.id ? 'Saving...' : 'Save courier'}
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-3">
                <input
                  value={adminNotes[order.id] ?? order.adminNotes ?? ''}
                  onChange={(e) => setAdminNotes((current) => ({ ...current, [order.id]: e.target.value }))}
                  placeholder="Admin notes"
                  className="input min-w-[260px] bg-[#f8f4ec]"
                />
                <button
                  onClick={() => void patchOrder(order.id, { adminNotes: adminNotes[order.id] ?? order.adminNotes ?? '' })}
                  disabled={busyOrderId === order.id}
                  className="rounded-full bg-[#10151e] px-4 py-2 text-sm font-bold text-white"
                >
                  {busyOrderId === order.id ? 'Saving...' : 'Save notes'}
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
