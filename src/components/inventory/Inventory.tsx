import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus, ClipboardList, Package, Radio, LayoutGrid,
  CheckCircle, XCircle, ShoppingBag, Gavel, Layers, AlertCircle,
} from 'lucide-react';
import {
  createAuctionFromProduct,
  createLiveSession,
  listAuctions,
  listLiveSessions,
} from '../../services/auctionService';
import {
  createPack,
  subscribeToInventory,
  subscribeToReviewQueue,
  updateProduct,
} from '../../services/catalogService';
import { useSession } from '../../hooks/useSession';
import { currency, defaultAllocations, emptyReservations } from '../../lib/quirkify';
import { cn } from '../../lib/utils';
import type { LiveSession, Pack, Product, ProductCondition, ReviewEntry, SalesChannel } from '../../types';
import OnboardingFlow from './Onboarding/OnboardingFlow';
import ProductsView from './Management/ProductsView';
import AllocationEditor from './Shared/AllocationEditor';
import type { AllocationSnapshot } from '../../types';

type Tab = 'intake' | 'review' | 'products' | 'packs' | 'live';

const TABS: Array<{ key: Tab; label: string; icon: typeof Plus }> = [
  { key: 'intake',   label: 'Intake',    icon: Plus },
  { key: 'review',   label: 'Review',    icon: ClipboardList },
  { key: 'products', label: 'Products',  icon: LayoutGrid },
  { key: 'packs',    label: 'Packs',     icon: Package },
  { key: 'live',     label: 'Live',      icon: Radio },
];

const CHANNEL_LABELS: Record<string, { label: string; color: string }> = {
  store:   { label: 'Store',         color: '#6366f1' },
  auction: { label: 'Auction',       color: '#f59e0b' },
  both:    { label: 'Store + Auction', color: '#a855f7' },
  pack:    { label: 'Pack',          color: '#06b6d4' },
};

// ─── Review Queue Panel ────────────────────────────────────────────────────────

function ReviewPanel() {
  const { profile } = useSession();
  const [queue, setQueue] = useState<ReviewEntry[]>([]);
  const [selected, setSelected] = useState<ReviewEntry | null>(null);
  const [draft, setDraft] = useState<any>(null);
  const [allocs, setAllocs] = useState<AllocationSnapshot>({ store: 0, auction: 0, packs: 0 });
  const [listingType, setListingType] = useState<string>('store');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  useEffect(() => subscribeToReviewQueue(setQueue), []);

  useEffect(() => {
    if (!selected) { setDraft(null); return; }
    const d = selected.generatedDraft;
    const lt = (selected as any).listingType || d.suggestedChannel || 'store';
    setListingType(lt);
    setDraft({
      title: d.title,
      description: d.description,
      category: d.category,
      condition: d.condition,
      tags: (d.tags || []).join(', '),
      retailPrice: d.pricing?.listPrice || d.pricing?.salePrice || 0,
      markdownPct: 0,
      salePrice: d.pricing?.salePrice || 0,
      stock: d.inventory?.onHand || 1,
    });
    const qty = d.inventory?.onHand || 1;
    setAllocs(defaultAllocations(lt as SalesChannel | 'both', qty));
  }, [selected]);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  async function approve() {
    if (!profile || !selected || !draft) return;
    setBusy(true);
    try {
      const qty = Number(draft.stock) || 1;
      const finalAllocs = allocs;
      const updated = await updateProduct(selected.id, {
        name: draft.title,
        description: draft.description,
        category: draft.category,
        condition: draft.condition as ProductCondition,
        status: 'approved',
        listingType: listingType as any,
        retailPrice: Number(draft.retailPrice) || 0,
        markdownPercentage: Number(draft.markdownPct) || 0,
        stock: qty,
        allocations: finalAllocs,
        tags: String(draft.tags || '').split(',').map((t: string) => t.trim()).filter(Boolean),
      });
      if (listingType === 'auction' || listingType === 'both') {
        const start = new Date(Date.now() + 60 * 60 * 1000).toISOString();
        const end = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        await createAuctionFromProduct({
          product: updated,
          startsAt: start,
          endsAt: end,
          startPrice: Number(draft.retailPrice) || 0,
          createdBy: profile.id,
        });
      }
      setQueue(q => q.filter(e => e.id !== selected.id));
      setSelected(null);
      showToast(`Published to ${CHANNEL_LABELS[listingType]?.label || listingType}`);
    } catch (err: any) {
      showToast(err.message || 'Approval failed', false);
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    if (!selected) return;
    setBusy(true);
    try {
      await updateProduct(selected.id, { status: 'rejected' });
      setQueue(q => q.filter(e => e.id !== selected.id));
      setSelected(null);
      showToast('Product rejected');
    } catch (err: any) {
      showToast(err.message || 'Failed', false);
    } finally {
      setBusy(false);
    }
  }

  const pending = queue.filter(e => e.status === 'pending');
  const ch = CHANNEL_LABELS[listingType] || CHANNEL_LABELS.store;

  return (
    <div className="relative">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className={cn(
              'absolute top-0 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold text-white shadow-lg',
              toast.ok ? 'bg-green-500' : 'bg-red-500'
            )}
          >
            {toast.ok ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        {/* Queue list */}
        <div className="space-y-2">
          <p className="section-label mb-3">
            {pending.length} pending {pending.length === 1 ? 'item' : 'items'}
          </p>
          {pending.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center shadow-sm">
              <CheckCircle className="w-10 h-10 text-green-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-600">Queue is clear</p>
              <p className="text-xs text-gray-400 mt-1">New items appear here after intake</p>
            </div>
          ) : pending.map(entry => {
            const img = entry.sourceInput?.media?.[0]?.url || (entry as any).image_url;
            const active = selected?.id === entry.id;
            const entryChannel = (entry as any).listingType || entry.generatedDraft.suggestedChannel || 'store';
            const entryChLabel = CHANNEL_LABELS[entryChannel];
            return (
              <motion.button
                key={entry.id}
                onClick={() => setSelected(entry)}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.99 }}
                className={cn(
                  'w-full text-left bg-white rounded-2xl border overflow-hidden shadow-sm transition-all',
                  active ? 'border-purple-300 ring-1 ring-purple-300' : 'border-gray-100 hover:border-gray-200'
                )}
              >
                {active && <div className="h-0.5 bg-gradient-to-r from-pink-500 to-purple-600" />}
                <div className="flex items-center gap-3 p-3">
                  {img ? (
                    <img src={img} alt="" className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <Package className="w-5 h-5 text-gray-300" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{entry.generatedDraft.title}</p>
                    <p className="text-[11px] text-gray-400 uppercase tracking-wide mt-0.5">{entry.generatedDraft.category}</p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      {entryChLabel && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: entryChLabel.color }}>
                          {entryChLabel.label}
                        </span>
                      )}
                      <span className="text-[10px] text-gray-400 font-medium">
                        {Math.round(entry.confidenceScore * 100)}% conf
                      </span>
                    </div>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Edit panel */}
        <div>
          {!selected || !draft ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center shadow-sm h-full flex flex-col items-center justify-center">
              <ClipboardList className="w-10 h-10 text-gray-200 mb-3" />
              <p className="text-sm font-semibold text-gray-500">Select an item to review</p>
              <p className="text-xs text-gray-400 mt-1">Edit fields and approve or reject</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Details card */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-pink-500 to-purple-600" />
                <div className="p-6 space-y-4">
                  <p className="section-label">Product details</p>
                  <div>
                    <label className="section-label block mb-1.5">Name</label>
                    <input value={draft.title} onChange={e => setDraft((d: any) => ({ ...d, title: e.target.value }))} className="input" />
                  </div>
                  <div>
                    <label className="section-label block mb-1.5">Description</label>
                    <textarea value={draft.description} onChange={e => setDraft((d: any) => ({ ...d, description: e.target.value }))} rows={3} className="input resize-none" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="section-label block mb-1.5">Category</label>
                      <select value={draft.category} onChange={e => setDraft((d: any) => ({ ...d, category: e.target.value }))} className="input">
                        {['Sneakers', 'Clothing', 'Accessories', 'Electronics', 'Collectibles', 'Other'].map(c => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="section-label block mb-1.5">Condition</label>
                      <select value={draft.condition} onChange={e => setDraft((d: any) => ({ ...d, condition: e.target.value }))} className="input">
                        {['New', 'Like New', 'Pre-owned', 'Refurbished'].map(c => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pricing card */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-emerald-400 to-teal-500" />
                <div className="p-6 space-y-4">
                  <p className="section-label">Pricing &amp; stock</p>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="section-label block mb-1.5">Retail / RRP</label>
                      <input type="number" value={draft.retailPrice} onChange={e => {
                        const retail = parseFloat(e.target.value) || 0;
                        const sale = Math.round(retail * (1 - (draft.markdownPct || 0) / 100));
                        setDraft((d: any) => ({ ...d, retailPrice: retail, salePrice: sale }));
                      }} className="input" min="0" />
                    </div>
                    <div>
                      <label className="section-label block mb-1.5">Markdown %</label>
                      <input type="number" value={draft.markdownPct} onChange={e => {
                        const pct = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0));
                        const sale = Math.round((draft.retailPrice || 0) * (1 - pct / 100));
                        setDraft((d: any) => ({ ...d, markdownPct: pct, salePrice: sale }));
                      }} className="input" min="0" max="100" />
                    </div>
                    <div>
                      <label className="section-label block mb-1.5">Selling price</label>
                      <div className={cn('input font-bold flex items-center', draft.salePrice > 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'text-gray-400')}>
                        R{draft.salePrice || 0}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="section-label block mb-1.5">Stock</label>
                    <input type="number" value={draft.stock} onChange={e => {
                      const qty = parseInt(e.target.value) || 1;
                      setDraft((d: any) => ({ ...d, stock: qty }));
                      setAllocs(defaultAllocations(listingType as SalesChannel | 'both', qty));
                    }} className="input" min="1" />
                  </div>
                </div>
              </div>

              {/* Channel card */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-indigo-500 to-purple-600" />
                <div className="p-6 space-y-4">
                  <p className="section-label">Listing type</p>
                  <div className="grid grid-cols-2 gap-2.5">
                    {[
                      { value: 'store',   icon: ShoppingBag, label: 'Store only',       sub: 'Buy-now' },
                      { value: 'auction', icon: Gavel,       label: 'Auction only',      sub: 'Bid to win' },
                      { value: 'both',    icon: Layers,      label: 'Store + Auction',   sub: 'Both channels' },
                      { value: 'pack',    icon: Package,     label: 'Pack component',    sub: 'Bundles only' },
                    ].map(opt => {
                      const Icon = opt.icon;
                      const active = listingType === opt.value;
                      const optCh = CHANNEL_LABELS[opt.value];
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            setListingType(opt.value);
                            setAllocs(defaultAllocations(opt.value as SalesChannel | 'both', Number(draft.stock) || 1));
                          }}
                          className={cn(
                            'flex items-start gap-2.5 p-3 rounded-xl border text-left transition-all',
                            active ? 'border-purple-300 bg-purple-50 ring-1 ring-purple-300' : 'border-gray-100 bg-gray-50 hover:border-gray-200'
                          )}
                        >
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: active ? optCh.color : '#f3f4f6' }}>
                            <Icon className="w-3.5 h-3.5" style={{ color: active ? '#fff' : '#9ca3af' }} />
                          </div>
                          <div>
                            <p className={cn('text-xs font-bold', active ? 'text-gray-900' : 'text-gray-600')}>{opt.label}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">{opt.sub}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div>
                    <p className="section-label mb-2">Stock allocation</p>
                    <AllocationEditor
                      totalStock={Number(draft.stock) || 1}
                      allocations={allocs}
                      onChange={setAllocs}
                      showPercentages
                    />
                  </div>
                </div>
              </div>

              {/* AI notes */}
              {selected.aiNotes?.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="h-1 bg-gradient-to-r from-blue-400 to-indigo-500" />
                  <div className="p-5">
                    <p className="section-label mb-2">AI notes</p>
                    <p className="text-sm text-gray-500 leading-relaxed">{selected.aiNotes.join(' · ')}</p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <button onClick={reject} disabled={busy}
                  className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-red-200 text-red-600 text-sm font-bold hover:bg-red-50 transition-colors disabled:opacity-50">
                  <XCircle className="w-4 h-4" />
                  Reject
                </button>
                <button onClick={approve} disabled={busy}
                  className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50 transition-colors"
                  style={{ background: busy ? '#9ca3af' : `linear-gradient(135deg, ${ch.color}, ${ch.color}cc)` }}>
                  {busy ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                      className="w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  ) : <CheckCircle className="w-4 h-4" />}
                  Approve → {ch.label}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Pack Builder ─────────────────────────────────────────────────────────────

function PacksPanel({ products }: { products: Product[] }) {
  const { profile } = useSession();
  const [form, setForm] = useState({ title: '', description: '', price: 0 });
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const eligible = useMemo(
    () => products.filter(p =>
      (p.status === 'approved' || p.status === 'active') &&
      (p.inventory?.allocated.packs || p.allocations?.packs || 0) > 0
    ),
    [products]
  );

  async function createPackHandler() {
    if (!profile || !form.title || selected.length === 0) return;
    setSaving(true);
    try {
      const pack: Pack = {
        id: crypto.randomUUID(),
        title: form.title,
        name: form.title,
        description: form.description,
        price: form.price,
        componentCount: selected.length,
        components: selected.map(id => ({ productId: id, quantity: 1 })),
        active: true,
        createdBy: profile.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await createPack(pack);
      setForm({ title: '', description: '', price: 0 });
      setSelected([]);
      setMsg('Pack created successfully.');
      setTimeout(() => setMsg(null), 3000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-teal-400 to-cyan-500" />
        <div className="p-6 space-y-4">
          <p className="text-lg font-bold text-gray-900">Pack builder</p>
          <p className="text-sm text-gray-400">Bundle pack-allocated products into a mystery pack for the store.</p>
          <div>
            <label className="section-label block mb-1.5">Pack title *</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="input" placeholder="e.g. Sneaker Mystery Box" />
          </div>
          <div>
            <label className="section-label block mb-1.5">Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} className="input resize-none" placeholder="What's inside?" />
          </div>
          <div>
            <label className="section-label block mb-1.5">Pack price (R)</label>
            <input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: Number(e.target.value) }))} className="input" min="0" />
          </div>
          {msg && (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-100 rounded-xl text-sm text-green-700 font-medium">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              {msg}
            </div>
          )}
          <button onClick={createPackHandler} disabled={saving || !form.title || selected.length === 0}
            className="btn-primary w-full justify-center disabled:opacity-50">
            {saving ? 'Creating…' : `Create pack with ${selected.length} product${selected.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-purple-400 to-indigo-500" />
        <div className="p-6">
          <p className="section-label mb-3">Pack-eligible inventory ({eligible.length})</p>
          {eligible.length === 0 ? (
            <div className="py-10 text-center">
              <Package className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-500 font-medium">No pack-allocated stock</p>
              <p className="text-xs text-gray-400 mt-1">Set alloc_packs &gt; 0 in a product to make it eligible</p>
            </div>
          ) : (
            <div className="space-y-2">
              {eligible.map(p => {
                const checked = selected.includes(p.id);
                return (
                  <label key={p.id} className={cn(
                    'flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all',
                    checked ? 'border-teal-200 bg-teal-50' : 'border-gray-100 bg-gray-50 hover:border-gray-200'
                  )}>
                    <input type="checkbox" checked={checked}
                      onChange={e => setSelected(s => e.target.checked ? [...s, p.id] : s.filter(id => id !== p.id))}
                      className="rounded accent-teal-500" />
                    {p.imageUrl && <img src={p.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{p.name}</p>
                      <p className="text-xs text-gray-400">
                        Pack alloc: {p.inventory?.allocated.packs || p.allocations?.packs || 0} · {currency(p.discountPrice || p.retailPrice || 0)}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Live Panel ────────────────────────────────────────────────────────────────

function LivePanel() {
  const { profile } = useSession();
  const [auctions, setAuctions] = useState<any[]>([]);
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [form, setForm] = useState({ title: '', spotlightMessage: '', selectedAuctionIds: [] as string[] });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([listLiveSessions(), listAuctions()]).then(([s, a]) => { setSessions(s); setAuctions(a); });
  }, []);

  async function createSession() {
    if (!profile || !form.title) return;
    setSaving(true);
    try {
      const session: LiveSession = {
        id: crypto.randomUUID(),
        title: form.title,
        status: 'scheduled',
        hostId: profile.id,
        hostName: profile.displayName,
        auctionQueue: form.selectedAuctionIds,
        currentAuctionId: form.selectedAuctionIds[0] || null,
        spotlightMessage: form.spotlightMessage,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await createLiveSession(session);
      setSessions(s => [session, ...s]);
      setForm({ title: '', spotlightMessage: '', selectedAuctionIds: [] });
      setMsg('Live session created.');
      setTimeout(() => setMsg(null), 3000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-rose-400 to-orange-500" />
        <div className="p-6 space-y-4">
          <p className="text-lg font-bold text-gray-900">Plan a live session</p>
          <div>
            <label className="section-label block mb-1.5">Session title *</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="input" placeholder="e.g. Sunday Drop Live" />
          </div>
          <div>
            <label className="section-label block mb-1.5">Spotlight message</label>
            <textarea value={form.spotlightMessage} onChange={e => setForm(f => ({ ...f, spotlightMessage: e.target.value }))} rows={2} className="input resize-none" placeholder="Shown to viewers during stream" />
          </div>
          <div>
            <label className="section-label block mb-3">Auction queue</label>
            <div className="space-y-2">
              {auctions.map(a => {
                const checked = form.selectedAuctionIds.includes(a.id);
                return (
                  <label key={a.id} className={cn(
                    'flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all',
                    checked ? 'border-rose-200 bg-rose-50' : 'border-gray-100 bg-gray-50 hover:border-gray-200'
                  )}>
                    <input type="checkbox" checked={checked}
                      onChange={e => setForm(f => ({
                        ...f,
                        selectedAuctionIds: e.target.checked
                          ? [...f.selectedAuctionIds, a.id]
                          : f.selectedAuctionIds.filter((id: string) => id !== a.id),
                      }))}
                      className="rounded accent-rose-500" />
                    <span className="text-sm font-semibold text-gray-900">{a.title}</span>
                  </label>
                );
              })}
              {auctions.length === 0 && <p className="text-sm text-gray-400">No auctions available yet</p>}
            </div>
          </div>
          {msg && (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-100 rounded-xl text-sm text-green-700 font-medium">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              {msg}
            </div>
          )}
          <button onClick={createSession} disabled={saving || !form.title} className="btn-primary w-full justify-center disabled:opacity-50">
            {saving ? 'Creating…' : 'Create live session'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-amber-400 to-yellow-500" />
        <div className="p-6">
          <p className="section-label mb-3">Sessions ({sessions.length})</p>
          {sessions.length === 0 ? (
            <div className="py-10 text-center">
              <Radio className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-500 font-medium">No sessions yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map(s => (
                <div key={s.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <div>
                    <p className="text-sm font-bold text-gray-900">{s.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{s.spotlightMessage || 'No spotlight message'}</p>
                  </div>
                  <span className={cn(
                    'text-[10px] font-bold px-2 py-1 rounded-full',
                    s.status === 'live' ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-600'
                  )}>
                    {s.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Inventory Component ──────────────────────────────────────────────────

export default function Inventory() {
  const [tab, setTab] = useState<Tab>('intake');
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => subscribeToInventory(setProducts), []);

  return (
    <section className="hero-bg px-4 py-10 min-h-screen">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 text-white">
          <p className="text-[11px] uppercase tracking-[0.35em] text-purple-400">Admin · Inventory</p>
          <h1 className="mt-2 text-3xl font-black">Product management</h1>
          <p className="mt-1 text-sm text-white/50">Intake → Review → Approve → Live on Store &amp; Auction</p>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex flex-wrap gap-2">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                'flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-all',
                tab === key
                  ? 'bg-white text-purple-700 shadow-sm'
                  : 'border border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {tab === 'intake' && (
              <div className="bg-white rounded-[2rem] border border-black/8 p-8">
                <OnboardingFlow onComplete={() => setTab('review')} />
              </div>
            )}

            {tab === 'review' && <ReviewPanel />}

            {tab === 'products' && (
              <div className="bg-white rounded-[2rem] border border-black/8 p-8">
                <ProductsView />
              </div>
            )}

            {tab === 'packs' && <PacksPanel products={products} />}

            {tab === 'live' && <LivePanel />}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
