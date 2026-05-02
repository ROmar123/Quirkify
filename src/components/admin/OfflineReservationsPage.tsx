import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Link2, CheckCircle2, XCircle, Clock, AlertCircle, RefreshCw, Plus, ChevronDown } from 'lucide-react';
import {
  OfflineReservation, OfflineChannel, fetchOfflineReservations,
  createOfflineReservation, resolveReservation
} from '../../services/offlineReservationService';
import { useSession } from '../../hooks/useSession';
import { fetchProducts } from '../../services/productService';
import { fetchAllListings } from '../../services/storeListingService';
import { Product } from '../../types';
import { cn } from '../../lib/utils';

const CHANNEL_LABELS: Record<OfflineChannel, string> = {
  whatsapp: 'WhatsApp',
  facebook_marketplace: 'Facebook Marketplace',
  instagram: 'Instagram',
  in_store: 'In Store',
  other: 'Other',
};

const CHANNEL_COLORS: Record<OfflineChannel, string> = {
  whatsapp: 'bg-green-100 text-green-700',
  facebook_marketplace: 'bg-blue-100 text-blue-700',
  instagram: 'bg-pink-100 text-pink-700',
  in_store: 'bg-purple-100 text-purple-700',
  other: 'bg-gray-100 text-gray-600',
};

const STATUS_CONFIG = {
  reserved: { label: 'Reserved', color: 'bg-amber-100 text-amber-700', icon: Clock },
  sold_offline: { label: 'Sold', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  released: { label: 'Released', color: 'bg-gray-100 text-gray-600', icon: XCircle },
  expired: { label: 'Expired', color: 'bg-red-100 text-red-600', icon: XCircle },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-400', icon: XCircle },
};

interface CreateForm {
  productId: string;
  listingId: string;
  quantity: number;
  channel: OfflineChannel;
  customerName: string;
  customerContact: string;
  agreedPrice: string;
  notes: string;
}

const EMPTY_FORM: CreateForm = {
  productId: '', listingId: '', quantity: 1, channel: 'whatsapp',
  customerName: '', customerContact: '', agreedPrice: '', notes: '',
};

export default function OfflineReservationsPage() {
  const { profile } = useSession();
  const [reservations, setReservations] = useState<OfflineReservation[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('reserved');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const adminProfileId = profile?.id ?? '';

  const load = async () => {
    setLoading(true);
    try {
      const [data, prods, lists] = await Promise.all([
        fetchOfflineReservations(filter === 'all' ? undefined : filter as any),
        fetchProducts().catch(() => []),
        fetchAllListings().catch(() => []),
      ]);
      setReservations(data);
      setProducts(prods as Product[]);
      setListings(lists);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filter]);

  const handleCreate = async () => {
    if (!form.productId) { setError('Select a product'); return; }
    setProcessing('create');
    setError(null);
    try {
      await createOfflineReservation({
        productId: form.productId,
        listingId: form.listingId || undefined,
        quantity: form.quantity,
        channel: form.channel,
        customerName: form.customerName || undefined,
        customerContact: form.customerContact || undefined,
        agreedPrice: form.agreedPrice ? Number(form.agreedPrice) : undefined,
        notes: form.notes || undefined,
        adminProfileId,
      });
      setForm(EMPTY_FORM);
      setShowCreate(false);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setProcessing(null);
    }
  };

  const handleResolve = async (id: string, newStatus: 'sold_offline' | 'released' | 'cancelled') => {
    setProcessing(id);
    try {
      await resolveReservation(id, newStatus);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setProcessing(null);
    }
  };

  const productListings = listings.filter(l => l.productId === form.productId || l.product_id === form.productId);
  const selectedProduct = products.find(p => p.id === form.productId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Offline Reservations</h2>
          <p className="text-sm text-gray-500 mt-0.5">WhatsApp, Facebook Marketplace &amp; in-store holds</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="btn-secondary p-2.5"><RefreshCw className="w-4 h-4" /></button>
          <button onClick={() => setShowCreate(!showCreate)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Reserve
          </button>
        </div>
      </div>

      {/* Create form */}
      {showCreate && (
        <motion.div
          initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
        >
          <div className="h-1 bg-gradient-to-r from-purple-500 to-pink-500" />
          <div className="p-5 space-y-4">
            <p className="font-semibold text-gray-900">New Offline Reservation</p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="section-label block mb-1.5">Product *</label>
                <select
                  value={form.productId}
                  onChange={e => setForm(f => ({ ...f, productId: e.target.value, listingId: '' }))}
                  className="input"
                >
                  <option value="">Select product…</option>
                  {products.filter(p => ['approved', 'active', 'live', 'allocated'].includes(p.status)).map(p => (
                    <option key={p.id} value={p.id}>{p.title || p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="section-label block mb-1.5">Store Listing (optional)</label>
                <select
                  value={form.listingId}
                  onChange={e => setForm(f => ({ ...f, listingId: e.target.value }))}
                  className="input"
                  disabled={!form.productId}
                >
                  <option value="">No listing (raw stock)</option>
                  {productListings.map((l: any) => (
                    <option key={l.id} value={l.id}>
                      {l.title} — {l.quantityRemaining ?? l.quantity_remaining} left
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="section-label block mb-1.5">Qty *</label>
                <input
                  type="number" min="1" value={form.quantity}
                  onChange={e => setForm(f => ({ ...f, quantity: Number(e.target.value) }))}
                  className="input"
                />
              </div>
              <div>
                <label className="section-label block mb-1.5">Channel *</label>
                <select value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value as OfflineChannel }))} className="input">
                  {Object.entries(CHANNEL_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="section-label block mb-1.5">Agreed Price (R)</label>
                <input
                  type="number" min="0" value={form.agreedPrice}
                  onChange={e => setForm(f => ({ ...f, agreedPrice: e.target.value }))}
                  placeholder="0"
                  className="input"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="section-label block mb-1.5">Customer name</label>
                <input value={form.customerName} onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))} className="input" placeholder="Optional" />
              </div>
              <div>
                <label className="section-label block mb-1.5">Contact</label>
                <input value={form.customerContact} onChange={e => setForm(f => ({ ...f, customerContact: e.target.value }))} className="input" placeholder="Phone / WhatsApp" />
              </div>
            </div>

            <div>
              <label className="section-label block mb-1.5">Notes</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="input resize-none" placeholder="Any additional notes…" />
            </div>

            {selectedProduct && (
              <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2.5">
                Stock deducted from {form.listingId ? 'store listing' : 'product inventory'} immediately. Expires in 48 hours if not resolved.
              </p>
            )}

            {error && (
              <div className="flex gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
                <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button onClick={() => { setShowCreate(false); setError(null); }} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleCreate} disabled={!!processing} className="btn-primary flex-1 justify-center">
                {processing === 'create' ? 'Creating…' : 'Reserve Stock'}
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {['reserved', 'sold_offline', 'released', 'expired', 'all'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn('px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all',
              filter === f
                ? 'bg-purple-600 text-white border-purple-600'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
            )}
          >
            {f === 'all' ? 'All' : f.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : reservations.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Link2 className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="font-medium">No reservations</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reservations.map(r => {
            const cfg = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.reserved;
            const Icon = cfg.icon;
            const expanded = expandedId === r.id;
            const channelCfg = CHANNEL_COLORS[r.channel] ?? 'bg-gray-100 text-gray-600';
            const isExpired = r.status === 'reserved' && new Date(r.expiresAt) < new Date();
            return (
              <motion.div key={r.id} layout className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <button
                  onClick={() => setExpandedId(expanded ? null : r.id)}
                  className="w-full flex items-center gap-3 p-4 text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0">
                    <Link2 className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">
                      {r.product?.title || r.product?.name || 'Product'} × {r.quantity}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {r.customerName || 'Anonymous'} · {new Date(r.createdAt).toLocaleDateString()}
                      {isExpired && <span className="ml-1 text-red-500 font-semibold">· EXPIRED</span>}
                    </p>
                  </div>
                  <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', channelCfg)}>
                    {CHANNEL_LABELS[r.channel]}
                  </span>
                  <span className={cn('text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1', cfg.color)}>
                    <Icon className="w-3 h-3" />{cfg.label}
                  </span>
                  <ChevronDown className={cn('w-4 h-4 text-gray-400 transition-transform', expanded && 'rotate-180')} />
                </button>

                {expanded && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                    className="border-t border-gray-100 p-4 space-y-4"
                  >
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {r.agreedPrice && (
                        <div><p className="text-xs text-gray-400">Agreed price</p><p className="font-semibold">R{r.agreedPrice.toLocaleString()}</p></div>
                      )}
                      {r.customerContact && (
                        <div><p className="text-xs text-gray-400">Contact</p><p className="font-medium">{r.customerContact}</p></div>
                      )}
                      <div>
                        <p className="text-xs text-gray-400">Expires</p>
                        <p className={cn('font-medium', isExpired && 'text-red-600')}>{new Date(r.expiresAt).toLocaleString()}</p>
                      </div>
                    </div>
                    {r.notes && <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3">{r.notes}</p>}

                    {r.status === 'reserved' && (
                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => handleResolve(r.id, 'released')}
                          disabled={!!processing}
                          className="btn-secondary flex-1 text-sm text-gray-600"
                        >
                          Release
                        </button>
                        <button
                          onClick={() => handleResolve(r.id, 'sold_offline')}
                          disabled={!!processing}
                          className="btn-primary flex-1 text-sm justify-center"
                        >
                          {processing === r.id ? 'Updating…' : 'Mark Sold'}
                        </button>
                      </div>
                    )}
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
