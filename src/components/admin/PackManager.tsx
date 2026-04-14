import { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { Pack } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { Package, Plus, Trash2, Edit3, Save, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '../../lib/utils';

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
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Pack Manager</h1>
          <p className="text-gray-400 text-sm mt-0.5">Create and manage mystery packs for the store</p>
        </div>
        <button onClick={() => setEditing({ ...BLANK })} className="btn-primary">
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
          {[1,2,3,4].map(i => <div key={i} className="aspect-square skeleton rounded-2xl" />)}
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
                {pack.imageUrl ? (
                  <img src={pack.imageUrl} alt={pack.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-10 h-10 text-gray-200" />
                  </div>
                )}
                <span className={cn(
                  'absolute top-2 left-2 badge',
                  pack.status === 'available' ? 'badge-success' : 'bg-gray-100 text-gray-500 border-gray-200'
                )}>
                  {pack.status === 'available' ? 'Available' : 'Sold Out'}
                </span>
              </div>
              <div className="p-3">
                <p className="text-sm font-semibold text-gray-900 truncate">{pack.name}</p>
                <p className="text-base font-bold gradient-text">R{pack.price}</p>
                <p className="text-xs text-gray-400 line-clamp-2 mt-0.5">{pack.description}</p>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => setEditing({ ...pack })}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:border-gray-300 transition-colors">
                    <Edit3 className="w-3 h-3" /> Edit
                  </button>
                  <button onClick={() => handleDelete(pack.id)}
                    className="p-1.5 rounded-lg border border-gray-100 text-gray-400 hover:border-red-200 hover:text-red-500 transition-colors">
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
              <div className="bg-white rounded-t-2xl md:rounded-2xl p-6 w-full md:max-w-md shadow-2xl pointer-events-auto space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-gray-900">{editing.id ? 'Edit Pack' : 'New Pack'}</h2>
                  <button onClick={() => setEditing(null)} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </div>

                <div>
                  <label className="section-label block mb-1.5">Pack Name *</label>
                  <input value={editing.name || ''} onChange={e => setEditing({ ...editing, name: e.target.value })}
                    className="input" placeholder="e.g. Genesis Drop" />
                </div>
                <div>
                  <label className="section-label block mb-1.5">Price (R) *</label>
                  <input type="number" value={editing.price || ''} onChange={e => setEditing({ ...editing, price: Number(e.target.value) })}
                    className="input" placeholder="e.g. 250" />
                </div>
                <div>
                  <label className="section-label block mb-1.5">Image URL</label>
                  <input value={editing.imageUrl || ''} onChange={e => setEditing({ ...editing, imageUrl: e.target.value })}
                    className="input" placeholder="https://…" />
                </div>
                <div>
                  <label className="section-label block mb-1.5">Description</label>
                  <textarea value={editing.description || ''} onChange={e => setEditing({ ...editing, description: e.target.value })}
                    rows={3} className="input resize-none" placeholder="What's inside?" />
                </div>
                <div>
                  <label className="section-label block mb-1.5">Status</label>
                  <select value={editing.status || 'available'} onChange={e => setEditing({ ...editing, status: e.target.value as any })}
                    className="input">
                    <option value="available">Available</option>
                    <option value="sold_out">Sold Out</option>
                  </select>
                </div>

                <button onClick={handleSave} disabled={saving}
                  className="btn-primary w-full justify-center py-3">
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
