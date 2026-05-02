import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Layout, Plus, Trash2, Edit2, Check, X, AlertCircle, RefreshCw } from 'lucide-react';
import {
  CampaignPlacement, PlacementSlot, PlacementStatus,
  SLOT_LABELS, fetchAllPlacements, createPlacement, updatePlacement, deletePlacement,
} from '../../services/campaignPlacementService';
import { cn } from '../../lib/utils';

const BG_PRESETS = [
  '#7C3AED', '#DB2777', '#059669', '#D97706', '#2563EB', '#0891B2', '#1F2937',
];

const STATUS_COLORS: Record<PlacementStatus, string> = {
  active: 'bg-green-100 text-green-700',
  paused: 'bg-amber-100 text-amber-700',
  ended: 'bg-gray-100 text-gray-500',
};

const SLOTS: PlacementSlot[] = ['home_hero', 'store_banner', 'auction_banner', 'pack_banner', 'product_section', 'checkout_banner'];

interface EditForm {
  slot: PlacementSlot;
  headline: string;
  subline: string;
  ctaText: string;
  ctaUrl: string;
  imageUrl: string;
  bgColor: string;
  endsAt: string;
  priority: number;
}

const EMPTY_FORM: EditForm = {
  slot: 'home_hero',
  headline: '',
  subline: '',
  ctaText: 'Shop Now',
  ctaUrl: '',
  imageUrl: '',
  bgColor: '#7C3AED',
  endsAt: '',
  priority: 0,
};

export default function CampaignPlacementsPage() {
  const [placements, setPlacements] = useState<CampaignPlacement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EditForm>(EMPTY_FORM);
  const [processing, setProcessing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setPlacements(await fetchAllPlacements());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!form.headline) { setError('Headline is required'); return; }
    setProcessing('create');
    setError(null);
    try {
      await createPlacement({
        slot: form.slot,
        headline: form.headline || undefined,
        subline: form.subline || undefined,
        ctaText: form.ctaText || 'Shop Now',
        ctaUrl: form.ctaUrl || undefined,
        imageUrl: form.imageUrl || undefined,
        bgColor: form.bgColor,
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : undefined,
        priority: form.priority,
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

  const handleUpdate = async (id: string) => {
    setProcessing(id);
    setError(null);
    try {
      await updatePlacement(id, {
        headline: form.headline || undefined,
        subline: form.subline || undefined,
        ctaText: form.ctaText || 'Shop Now',
        ctaUrl: form.ctaUrl || undefined,
        imageUrl: form.imageUrl || undefined,
        bgColor: form.bgColor,
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : undefined,
        priority: form.priority,
      });
      setEditingId(null);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setProcessing(null);
    }
  };

  const handleToggleStatus = async (p: CampaignPlacement) => {
    setProcessing(p.id);
    try {
      await updatePlacement(p.id, { status: p.status === 'active' ? 'paused' : 'active' });
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setProcessing(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this placement?')) return;
    setProcessing(id);
    try {
      await deletePlacement(id);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setProcessing(null);
    }
  };

  const startEdit = (p: CampaignPlacement) => {
    setEditingId(p.id);
    setForm({
      slot: p.slot,
      headline: p.headline ?? '',
      subline: p.subline ?? '',
      ctaText: p.ctaText ?? 'Shop Now',
      ctaUrl: p.ctaUrl ?? '',
      imageUrl: p.imageUrl ?? '',
      bgColor: p.bgColor ?? '#7C3AED',
      endsAt: p.endsAt ? p.endsAt.slice(0, 16) : '',
      priority: p.priority ?? 0,
    });
  };

  const PlacementForm = ({ onSave, saveLabel }: { onSave: () => void; saveLabel: string }) => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="section-label block mb-1.5">Slot *</label>
          <select value={form.slot} onChange={e => setForm(f => ({ ...f, slot: e.target.value as PlacementSlot }))} className="input">
            {SLOTS.map(s => <option key={s} value={s}>{SLOT_LABELS[s]}</option>)}
          </select>
        </div>
        <div>
          <label className="section-label block mb-1.5">Priority (higher = shown first)</label>
          <input type="number" min="0" value={form.priority}
            onChange={e => setForm(f => ({ ...f, priority: Number(e.target.value) }))}
            className="input" />
        </div>
      </div>
      <div>
        <label className="section-label block mb-1.5">Headline *</label>
        <input value={form.headline} onChange={e => setForm(f => ({ ...f, headline: e.target.value }))} className="input" placeholder="Shop the Drop — Deadstock Finds" />
      </div>
      <div>
        <label className="section-label block mb-1.5">Subline</label>
        <input value={form.subline} onChange={e => setForm(f => ({ ...f, subline: e.target.value }))} className="input" placeholder="New arrivals every week" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="section-label block mb-1.5">CTA text</label>
          <input value={form.ctaText} onChange={e => setForm(f => ({ ...f, ctaText: e.target.value }))} className="input" placeholder="Shop Now" />
        </div>
        <div>
          <label className="section-label block mb-1.5">CTA URL</label>
          <input value={form.ctaUrl} onChange={e => setForm(f => ({ ...f, ctaUrl: e.target.value }))} className="input" placeholder="/store" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="section-label block mb-1.5">Background colour</label>
          <div className="flex gap-2 flex-wrap">
            {BG_PRESETS.map(c => (
              <button key={c} type="button"
                onClick={() => setForm(f => ({ ...f, bgColor: c }))}
                className={cn('w-8 h-8 rounded-lg border-2 transition-all', form.bgColor === c ? 'border-gray-900 scale-110' : 'border-transparent')}
                style={{ backgroundColor: c }}
              />
            ))}
            <input type="color" value={form.bgColor} onChange={e => setForm(f => ({ ...f, bgColor: e.target.value }))}
              className="w-8 h-8 rounded-lg border border-gray-200 cursor-pointer" />
          </div>
        </div>
        <div>
          <label className="section-label block mb-1.5">Ends at (optional)</label>
          <input type="datetime-local" value={form.endsAt}
            onChange={e => setForm(f => ({ ...f, endsAt: e.target.value }))}
            className="input" />
        </div>
      </div>
      <div>
        <label className="section-label block mb-1.5">Image URL</label>
        <input value={form.imageUrl} onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))} className="input" placeholder="https://…" />
      </div>

      {/* Preview */}
      {(form.headline || form.imageUrl) && (
        <div className="rounded-2xl overflow-hidden" style={{ background: form.bgColor }}>
          {form.imageUrl && <img src={form.imageUrl} alt="" className="w-full h-32 object-cover opacity-60" />}
          <div className="p-4 text-white">
            <p className="font-bold text-lg">{form.headline || 'Headline'}</p>
            {form.subline && <p className="text-sm opacity-80 mt-0.5">{form.subline}</p>}
            <button className="mt-3 px-4 py-1.5 bg-white/20 rounded-full text-sm font-semibold">
              {form.ctaText || 'Shop Now'}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="flex gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      <button onClick={onSave} disabled={!!processing} className="btn-primary w-full justify-center">
        {processing ? 'Saving…' : saveLabel}
      </button>
    </div>
  );

  // Group by slot for display
  const bySlot = SLOTS.reduce((acc, slot) => {
    acc[slot] = placements.filter(p => p.slot === slot);
    return acc;
  }, {} as Record<PlacementSlot, CampaignPlacement[]>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Campaign Placements</h2>
          <p className="text-sm text-gray-500 mt-0.5">Control banners and hero sections across the store</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="btn-secondary p-2.5"><RefreshCw className="w-4 h-4" /></button>
          <button onClick={() => { setShowCreate(!showCreate); setError(null); }} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Placement
          </button>
        </div>
      </div>

      {showCreate && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
        >
          <div className="h-1 bg-gradient-to-r from-purple-500 to-pink-500" />
          <div className="p-5 space-y-4">
            <p className="font-semibold text-gray-900">New Placement</p>
            <PlacementForm onSave={handleCreate} saveLabel="Create Placement" />
          </div>
        </motion.div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="space-y-6">
          {SLOTS.map(slot => {
            const slotPlacements = bySlot[slot] || [];
            return (
              <div key={slot}>
                <div className="flex items-center gap-2 mb-3">
                  <Layout className="w-4 h-4 text-gray-400" />
                  <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">{SLOT_LABELS[slot]}</h3>
                  <span className="text-xs text-gray-400">{slotPlacements.length} placement{slotPlacements.length !== 1 ? 's' : ''}</span>
                </div>

                {slotPlacements.length === 0 ? (
                  <p className="text-xs text-gray-400 ml-6">No placements in this slot</p>
                ) : (
                  <div className="space-y-3">
                    {slotPlacements.map(p => (
                      <motion.div key={p.id} layout className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        {editingId === p.id ? (
                          <div className="p-4 space-y-4">
                            <div className="flex items-center justify-between">
                              <p className="font-semibold text-gray-900">Edit Placement</p>
                              <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                            <PlacementForm onSave={() => handleUpdate(p.id)} saveLabel="Save Changes" />
                          </div>
                        ) : (
                          <div className="flex items-center gap-3 p-4">
                            <div
                              className="w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center"
                              style={{ background: p.bgColor }}
                            >
                              {p.imageUrl
                                ? <img src={p.imageUrl} alt="" className="w-full h-full object-cover rounded-xl opacity-70" />
                                : <Layout className="w-5 h-5 text-white/80" />
                              }
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-gray-900 truncate">{p.headline || '—'}</p>
                              <p className="text-xs text-gray-400 truncate">{p.ctaText} → {p.ctaUrl || 'no link'}</p>
                            </div>
                            <span className={cn('text-[11px] font-bold px-2.5 py-1 rounded-full', STATUS_COLORS[p.status])}>
                              {p.status}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleToggleStatus(p)}
                                disabled={!!processing}
                                className={cn('p-1.5 rounded-lg transition-colors text-xs font-semibold',
                                  p.status === 'active' ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' : 'bg-green-50 text-green-600 hover:bg-green-100'
                                )}
                                title={p.status === 'active' ? 'Pause' : 'Activate'}
                              >
                                {p.status === 'active' ? <X className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                              </button>
                              <button onClick={() => startEdit(p)} className="p-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                                <Edit2 className="w-3.5 h-3.5 text-gray-500" />
                              </button>
                              <button
                                onClick={() => handleDelete(p.id)}
                                disabled={!!processing}
                                className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                              </button>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    ))}
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
