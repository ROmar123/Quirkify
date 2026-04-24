import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createCheckoutOrder } from '../../services/commerceService';
import { useCart } from '../../context/CartContext';
import { useSession } from '../../hooks/useSession';
import { currency } from '../../lib/quirkify';

export default function Checkout() {
  const { items, total, updateQuantity, removeFromCart, clearCart } = useCart();
  const { profile } = useSession();
  const navigate = useNavigate();
  const [line1, setLine1] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleCheckout() {
    if (!profile || items.length === 0) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await createCheckoutOrder({
        customerId: profile.id,
        customerEmail: profile.email,
        customerName: profile.displayName,
        customerPhone: phone,
        line1,
        city,
        postalCode,
        items: items.map((item) => ({ refId: item.productId, kind: item.kind, quantity: item.quantity })),
      });
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
        return;
      }
      clearCart();
      setMessage(`Order ${result.order.orderNumber} created. Payment is pending manual review.`);
      navigate('/orders');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Checkout failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="bg-[linear-gradient(180deg,#091019,#101823_28%,#f4efe6_28%,#f4efe6)] px-4 py-10">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[2rem] border border-black/8 bg-white p-8 shadow-[0_20px_70px_rgba(15,21,30,0.08)]">
          <p className="text-[11px] uppercase tracking-[0.35em] text-[#725d34]">Checkout</p>
          <h1 className="mt-4 text-4xl font-black">Delivery and payment</h1>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <input value={line1} onChange={(e) => setLine1(e.target.value)} className="input bg-[#f8f4ec] md:col-span-2" placeholder="Address line" />
            <input value={city} onChange={(e) => setCity(e.target.value)} className="input bg-[#f8f4ec]" placeholder="City" />
            <input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} className="input bg-[#f8f4ec]" placeholder="Postal code" />
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="input bg-[#f8f4ec] md:col-span-2" placeholder="Phone number" />
          </div>
          {message && <div className="mt-4 rounded-2xl border border-black/8 bg-[#f8f4ec] px-4 py-3 text-sm">{message}</div>}
        </div>
        <div className="rounded-[2rem] border border-black/8 bg-white p-8 shadow-[0_20px_70px_rgba(15,21,30,0.08)]">
          <h2 className="text-2xl font-black">Order summary</h2>
          <div className="mt-5 space-y-3">
            {items.map((item) => (
              <div key={`${item.kind}-${item.productId}`} className="rounded-2xl bg-[#f8f4ec] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold">{item.title}</p>
                    <p className="text-sm text-[#10151e]/55">{item.kind} · {currency(item.unitPrice)}</p>
                  </div>
                  <button onClick={() => removeFromCart(item.productId)} className="text-xs font-bold uppercase tracking-[0.2em] text-[#725d34]">Remove</button>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <button onClick={() => updateQuantity(item.productId, item.quantity - 1)} className="rounded-full border border-black/10 px-3 py-1">-</button>
                  <span className="text-sm font-bold">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.productId, item.quantity + 1)} className="rounded-full border border-black/10 px-3 py-1">+</button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 flex items-center justify-between text-lg font-black">
            <span>Total</span>
            <span>{currency(total)}</span>
          </div>
          <button disabled={busy || items.length === 0} onClick={() => void handleCheckout()} className="mt-6 w-full rounded-full bg-[#10151e] px-5 py-3 text-sm font-bold text-white">
            {busy ? 'Creating order...' : 'Place order'}
          </button>
        </div>
      </div>
    </section>
  );
}
