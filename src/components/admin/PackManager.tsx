import { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { Pack } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { Package, Plus, Trash2, Edit3, Save, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '../../lib/utils';

const inputCls = 'w-full px-4 py-2.5 bg-purple-50 border-2 border-purple-100 rounded-2xl text-sm font-semibold text-purple-800 focus:outline-none focus:border-purple-400 transition-colors';
const labelCls = 'block text-xs font-bold text-purple-400 mb-1';

const BLANK: Partial<Pack> = { name: '', description: '', price: 0, imageUrl: '', status: 'available' };

export default function PackManager() {
  const [packs, setPacks] = useState<Pack[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Pack> & { id?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'packs'), snap => {
      setPacks(snap.docs.map(d => ({ id: d.id, ...d.data() } as Pack)));
      setLoading(false);
    }, err => { handleFirestoreError(err, OperationType.GET, 'packs'); setLoading(false); });
    return unsub;
  }, []);

  const toast = (msg: string, isError = false) => {
    isError ? setError(msg) : setSuccess(msg);
    setTimeout(() => isError ? setError(null) : setSuccess(null), 3000);
  };

  const handleSave = async () => {
    if (!editing?.name || !editing.price) { toast('Name and price are required', true); return; }
    setSaving(true);
    try {
      const data = {
        name: editing.name,
        description: editing.description || '',
        price: editing.price,
        imageUrl: editing.imageUrl || '',
        status: editing.status || 'available',
        contents: {
          rarityProbabilities: { Common: 0.7, Limited: 0.2, Rare: 0.08, 'Super Rare': 0.015, Unique: 0.005 },
          itemCount: 3,
        },
      };
      if (editing.id) {
        await updateDoc(doc(db, 'packs', editing.id), data);
        toast('Pack updated!');
      } else {
        await addDoc(collection(db, 'packs'), data);
        toast('Pack created!');
      }
      setEditing(null);
    } catch {
      toast('Failed to save pack', true);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this pack?')) return;
    try {
      await deleteDoc(doc(db, 'packs', id));
      toast('Pack deleted');
    } catch {
      toast('Failed to delete', true);
    }
  };

  return (
    <div className="px-4 py-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black gradient-text">Pack Manager</h1>
          <p className="text-purple-400 text-xs font-semibold mt-1">Create and manage mystery packs for the store</p>
        </div>
        <button onClick={() => setEditing({ ...BLANK })}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-black text-white hover:opacity-90 transition-all"
          style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}>
          <Plus className="w-4 h-4" /> New Pack
        </button>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mb-4 p-3 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
          </motion.div>
        )}
        {success && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mb-4 p-3 bg-green-50 border border-green-100 rounded-2xl text-green-600 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />{success}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pack grid */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="aspect-square bg-purple-50 animate-pulse rounded-3xl" />)}
        </div>
      ) : packs.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-purple-100">
          <Package className="w-10 h-10 mx-auto mb-3 text-purple-200" />
          <p className="text-purple-400 font-bold text-sm">No packs yet</p>
          <p className="text-purple-300 text-xs mt-1">Create your first mystery pack above</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {packs.map(pack => (
            <motion.div key={pack.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-3xl border border-purple-100 shadow-sm overflow-hidden group hover:shadow-lg transition-all">
              <div className="aspect-square bg-purple-50 overflow-hidden relative">
                {pack.imageUrl ? (
                  <img src={pack.imageUrl} alt={pack.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-12 h-12 text-purple-200" />
                  </div>
                )}
                <span className={cn(
                  'absolute top-2 left-2 px-2 py-1 rounded-full text-[10px] font-black',
                  pack.status === 'available' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                )}>
                  {pack.status}
                </span>
              </div>
              <div className="p-3">
                <p className="text-sm font-black text-purple-900 truncate">{pack.name}</p>
                <p className="text-lg font-black gradient-text">R{pack.price}</p>
                <p className="text-[10px] text-purple-400 font-semibold line-clamp-2 mt-0.5">{pack.description}</p>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => setEditing({ ...pack })}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl border-2 border-purple-100 text-xs font-bold text-purple-600 hover:border-purple-400 transition-colors">
                    <Edit3 className="w-3 h-3" /> Edit
                  </button>
                  <button onClick={() => handleDelete(pack.id)}
                    className="flex items-center justify-center p-1.5 rounded-xl border-2 border-red-100 text-red-400 hover:border-red-300 hover:text-red-600 transition-colors">
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
            <motion.div initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 60 }}
              className="fixed bottom-0 left-0 right-0 md:inset-0 md:flex md:items-center md:justify-center z-50 pointer-events-none">
              <div className="bg-white rounded-t-3xl md:rounded-3xl p-6 w-full md:max-w-md shadow-2xl pointer-events-auto space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-black text-purple-900">{editing.id ? 'Edit Pack' : 'New Pack'}</h2>
                  <button onClick={() => setEditing(null)} className="p-2 rounded-2xl hover:bg-purple-50 transition-colors">
                    <X className="w-5 h-5 text-purple-400" />
                  </button>
                </div>

                <div>
                  <label className={labelCls}>Pack Name *</label>
                  <input value={editing.name || ''} onChange={e => setEditing({ ...editing, name: e.target.value })}
                    className={inputCls} placeholder="e.g. Genesis Drop" />
                </div>
                <div>
                  <label className={labelCls}>Price (R) *</label>
                  <input type="number" value={editing.price || ''} onChange={e => setEditing({ ...editing, price: Number(e.target.value) })}
                    className={inputCls} placeholder="e.g. 250" />
                </div>
                <div>
                  <label className={labelCls}>Image URL</label>
                  <input value={editing.imageUrl || ''} onChange={e => setEditing({ ...editing, imageUrl: e.target.value })}
                    className={inputCls} placeholder="https://…" />
                </div>
                <div>
                  <label className={labelCls}>Description</label>
                  <textarea value={editing.description || ''} onChange={e => setEditing({ ...editing, description: e.target.value })}
                    rows={3} className={cn(inputCls, 'resize-none')} placeholder="What's inside?" />
                </div>
                <div>
                  <label className={labelCls}>Status</label>
                  <select value={editing.status || 'available'} onChange={e => setEditing({ ...editing, status: e.target.value as any })}
                    className={inputCls}>
                    <option value="available">Available</option>
                    <option value="sold_out">Sold Out</option>
                  </select>
                </div>

                <button onClick={handleSave} disabled={saving}
                  className="w-full py-3 rounded-2xl text-sm font-black text-white disabled:opacity-50 hover:opacity-90 transition-all flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}>
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
