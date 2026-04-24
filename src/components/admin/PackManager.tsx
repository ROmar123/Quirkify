import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabase';
import { auth } from '../../firebase';
import { motion, AnimatePresence } from 'motion/react';
import { Package, Plus, Trash2, Edit3, Save, X, AlertCircle, CheckCircle2, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

interface PackRow {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string | null;
  item_count: number;
  total_packs: number;
  packs_sold: number;
  packs_remaining: number;
  prob_common: number;
  prob_limited: number;
  prob_rare: number;
  prob_super_rare: number;
  prob_unique: number;
  status: 'draft' | 'available' | 'sold_out' | 'archived';
  created_at: string;
}

interface PackForm {
  id?: string;
  name: string;
  description: string;
  price: number | '';
  image_url: string;
  item_count: number | '';
  total_packs: number | '';
  prob_common: number;
  prob_limited: number;
  prob_rare: number;
  prob_super_rare: number;
  prob_unique: number;
  status: 'draft' | 'available';
}

const BLANK_FORM: PackForm = {
  name: '',
  description: '',
  price: '',
  image_url: '',
  item_count: 3,
  total_packs: '',
  prob_common: 50,
  prob_limited: 25,
  prob_rare: 15,
  prob_super_rare: 8,
  prob_unique: 2,
  status: 'draft',
};

const STATUS_LABELS: Record<PackRow['status'], string> = {
  draft: 'Draft',
  available: 'Available',
  sold_out: 'Sold Out',
  archived: 'Archived',
};

function probSum(f: PackForm) {
  return f.prob_common + f.prob_limited + f.prob_rare + f.prob_super_rare + f.prob_unique;
}

export default function PackManager() {
  const [packs, setPacks] = useState<PackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<PackForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showProbs, setShowProbs] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('packs')
      .select('*')
      .neq('status', 'archived')
      .order('created_at', { ascending: false });
    if (!err && data) setPacks(data as PackRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const toast = (msg: string, isError = false) => {
    isError ? setError(msg) : setSuccess(msg);
    setTimeout(() => isError ? setError(null) : setSuccess(null), 3000);
  };

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.name.trim()) { toast('Pack name is required', true); return; }
    if (!editing.price || Number(editing.price) <= 0) { toast('Price must be greater than 0', true); return; }
    if (!editing.total_packs || Number(editing.total_packs) <= 0) { toast('Total packs must be greater than 0', true); return; }
    if (probSum(editing) !== 100) { toast(`Rarity probabilities must sum to 100 (currently ${probSum(editing)})`, true); return; }

    setSaving(true);
    try {
      const uid = auth.currentUser?.uid ?? 'admin';
      const payload = {
        name: editing.name.trim(),
        description: editing.description.trim(),
        price: Number(editing.price),
        image_url: editing.image_url.trim() || null,
        item_count: Number(editing.item_count) || 3,
        total_packs: Number(editing.total_packs),
        prob_common: editing.prob_common,
        prob_limited: editing.prob_limited,
        prob_rare: editing.prob_rare,
        prob_super_rare: editing.prob_super_rare,
        prob_unique: editing.prob_unique,
        status: editing.status,
        created_by: uid,
      };

      if (editing.id) {
        const { error: err } = await supabase.from('packs').update(payload).eq('id', editing.id);
        if (err) throw err;
        toast('Pack updated!');
      } else {
        const { error: err } = await supabase.from('packs').insert(payload);
        if (err) throw err;
        toast('Pack created!');
      }
      setEditing(null);
      await load();
    } catch {
      toast('Failed to save pack', true);
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (id: string) => {
    if (!confirm('Archive this pack? It will be hidden from the store.')) return;
    const { error: err } = await supabase.from('packs').update({ status: 'archived' }).eq('id', id);
    if (err) { toast('Failed to archive pack', true); return; }
    toast('Pack archived');
    await load();
  };

  const startEdit = (pack: PackRow) => {
    setEditing({
      id: pack.id,
      name: pack.name,
      description: pack.description,
      price: pack.price,
      image_url: pack.image_url ?? '',
      item_count: pack.item_count,
      total_packs: pack.total_packs,
      prob_common: pack.prob_common,
      prob_limited: pack.prob_limited,
      prob_rare: pack.prob_rare,
      prob_super_rare: pack.prob_super_rare,
      prob_unique: pack.prob_unique,
      status: pack.status === 'sold_out' ? 'available' : pack.status as 'draft' | 'available',
    });
    setShowProbs(false);
  };

  return (
    <div className="px-4 py-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Pack Manager</h1>
          <p className="text-gray-400 text-sm mt-0.5">Create and manage mystery packs for the store</p>
        </div>
        <button onClick={() => { setEditing({ ...BLANK_FORM }); setShowProbs(false); }} className="btn-primary">
          <Plus className="w-4 h-4" /> New Pack
        </button>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
          </motion.div>
        )}
        {success && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mb-4 p-3 bg-green-50 border border-green-100 rounded-xl text-green-700 text-sm flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />{success}
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="aspect-square skeleton rounded-2xl" />)}
        </div>
      ) : packs.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
          <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-3">
            <Package className="w-6 h-6 text-gray-300" />
          </div>
          <p className="text-gray-900 font-semibold text-sm">No packs yet</p>
          <p className="text-gray-400 text-xs mt-1">Create your first mystery pack above</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {packs.map(pack => (
            <motion.div key={pack.id} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden group hover:shadow-md transition-all">
              <div className="aspect-square bg-gray-50 overflow-hidden relative img-zoom">
                {pack.image_url ? (
                  <img src={pack.image_url} alt={pack.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-10 h-10 text-gray-200" />
                  </div>
                )}
                <span className={cn(
                  'absolute top-2 left-2 badge',
                  pack.status === 'available' ? 'badge-success'
                    : pack.status === 'draft' ? 'bg-gray-100 text-gray-500 border-gray-200'
                    : 'bg-orange-100 text-orange-600 border-orange-200'
                )}>
                  {STATUS_LABELS[pack.status]}
                </span>
              </div>
              <div className="p-3">
                <p className="text-sm font-semibold text-gray-900 truncate">{pack.name}</p>
                <p className="text-base font-bold gradient-text">R{pack.price}</p>
                <p className="text-xs text-gray-400 mt-0.5">{pack.packs_remaining} / {pack.total_packs} remaining</p>
                <p className="text-xs text-gray-400 line-clamp-1 mt-0.5">{pack.description}</p>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => startEdit(pack)}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:border-gray-300 transition-colors">
                    <Edit3 className="w-3 h-3" /> Edit
                  </button>
                  <button onClick={() => handleArchive(pack.id)}
                    className="p-1.5 rounded-lg border border-gray-100 text-gray-400 hover:border-red-200 hover:text-red-500 transition-colors"
                    title="Archive">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Edit/Create modal */}
      <AnimatePresence>
        {editing && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={() => setEditing(null)} />
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed bottom-0 left-0 right-0 md:inset-0 md:flex md:items-center md:justify-center z-50 pointer-events-none">
              <div className="bg-white rounded-t-2xl md:rounded-2xl p-6 w-full md:max-w-lg shadow-2xl pointer-events-auto space-y-4 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-gray-900">{editing.id ? 'Edit Pack' : 'New Pack'}</h2>
                  <button onClick={() => setEditing(null)} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="section-label block mb-1.5">Pack Name *</label>
                    <input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })}
                      className="input" placeholder="e.g. Genesis Drop" />
                  </div>
                  <div>
                    <label className="section-label block mb-1.5">Price (R) *</label>
                    <input type="number" min="1" value={editing.price}
                      onChange={e => setEditing({ ...editing, price: e.target.value === '' ? '' : Number(e.target.value) })}
                      className="input" placeholder="e.g. 250" />
                  </div>
                  <div>
                    <label className="section-label block mb-1.5">Items per Pack</label>
                    <input type="number" min="1" value={editing.item_count}
                      onChange={e => setEditing({ ...editing, item_count: e.target.value === '' ? '' : Number(e.target.value) })}
                      className="input" placeholder="3" />
                  </div>
                  <div>
                    <label className="section-label block mb-1.5">Total Packs Available *</label>
                    <input type="number" min="1" value={editing.total_packs}
                      onChange={e => setEditing({ ...editing, total_packs: e.target.value === '' ? '' : Number(e.target.value) })}
                      className="input" placeholder="e.g. 100" />
                  </div>
                  <div>
                    <label className="section-label block mb-1.5">Status</label>
                    <select value={editing.status} onChange={e => setEditing({ ...editing, status: e.target.value as 'draft' | 'available' })}
                      className="input">
                      <option value="draft">Draft</option>
                      <option value="available">Available</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="section-label block mb-1.5">Image URL</label>
                    <input value={editing.image_url} onChange={e => setEditing({ ...editing, image_url: e.target.value })}
                      className="input" placeholder="https://…" />
                  </div>
                  <div className="col-span-2">
                    <label className="section-label block mb-1.5">Description</label>
                    <textarea value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })}
                      rows={2} className="input resize-none" placeholder="What's inside?" />
                  </div>
                </div>

                {/* Rarity probabilities collapsible */}
                <div className="border border-gray-100 rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowProbs(p => !p)}
                    className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                    <span>Rarity Probabilities <span className={cn('ml-1 text-xs font-semibold', probSum(editing) === 100 ? 'text-green-600' : 'text-red-500')}>({probSum(editing)}/100)</span></span>
                    <ChevronDown className={cn('w-4 h-4 text-gray-400 transition-transform', showProbs && 'rotate-180')} />
                  </button>
                  <AnimatePresence>
                    {showProbs && (
                      <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                        className="overflow-hidden">
                        <div className="grid grid-cols-5 gap-2 px-4 pb-4">
                          {(
                            [
                              { key: 'prob_common', label: 'Common' },
                              { key: 'prob_limited', label: 'Limited' },
                              { key: 'prob_rare', label: 'Rare' },
                              { key: 'prob_super_rare', label: 'S.Rare' },
                              { key: 'prob_unique', label: 'Unique' },
                            ] as { key: keyof PackForm; label: string }[]
                          ).map(({ key, label }) => (
                            <div key={key} className="text-center">
                              <label className="text-[10px] text-gray-400 font-semibold uppercase">{label}</label>
                              <input type="number" min="0" max="100"
                                value={editing[key] as number}
                                onChange={e => setEditing({ ...editing, [key]: Number(e.target.value) })}
                                className="input text-center text-sm px-1 mt-1" />
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <button onClick={handleSave} disabled={saving} className="btn-primary w-full justify-center py-3">
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving…' : editing.id ? 'Save Changes' : 'Create Pack'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
