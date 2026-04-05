import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../../firebase';
import { Product, Pack } from '../../../types';
import { motion, AnimatePresence } from 'motion/react';
import { Gift, Plus, Trash2, Edit3, Save, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '../../../lib/utils';

const inputCls = 'w-full px-4 py-2.5 bg-purple-50 border-2 border-purple-100 rounded-2xl text-sm font-semibold text-purple-800 focus:outline-none focus:border-purple-400 transition-colors';
const labelCls = 'block text-xs font-bold text-purple-400 mb-1 uppercase tracking-widest';

const BLANK: Partial<Pack> = { name: '', description: '', price: 0, imageUrl: '', status: 'available', linkedProductIds: [] };

export default function PackEditor() {
  const [products, setProducts] = useState<Product[]>([]);
  const [packs, setPacks] = useState<Pack[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Pack> & { id?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    // Load approved products with packs allocation
    const qProducts = query(collection(db, 'products'), where('status', '==', 'approved'));
    const unsubProducts = onSnapshot(qProducts, snap => {
      const allProducts = snap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
      // Filter to only show products with packs allocation > 0
      const packProducts = allProducts.filter(p => (p.allocations?.packs || 0) > 0);
      setProducts(packProducts);
    }, err => handleFirestoreError(err, OperationType.GET, 'products'));

    // Load packs
    const unsub = onSnapshot(collection(db, 'packs'), snap => {
      setPacks(snap.docs.map(d => ({ id: d.id, ...d.data() } as Pack)));
      setLoading(false);
    }, err => { handleFirestoreError(err, OperationType.GET, 'packs'); setLoading(false); });

    return () => { unsubProducts(); unsub(); };
  }, []);

  const toast = (msg: string, isError = false) => {
    isError ? setError(msg) : setSuccess(msg);
    setTimeout(() => isError ? setError(null) : setSuccess(null), 3000);
  };

  const handleSave = async () => {
    if (!editing?.name || !editing.price) { toast('Name and price are required', true); return; }
    if (!editing.linkedProductIds || editing.linkedProductIds.length === 0) { toast('Select at least one product', true); return; }

    setSaving(true);
    try {
      const data = {
        name: editing.name,
        description: editing.description || '',
        price: editing.price,
        imageUrl: editing.imageUrl || '',
        status: editing.status || 'available',
        linkedProductIds: editing.linkedProductIds || [],
        createdAt: editing.id ? undefined : new Date().toISOString(),
        createdBy: 'admin',
        contents: {
          itemCount: 3,
          rarityProbabilities: {
            common: 0.7,
            limited: 0.2,
            rare: 0.08,
            superRare: 0.015,
            unique: 0.005,
          },
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

  const toggleProductLink = (productId: string) => {
    if (!editing) return;
    const linked = editing.linkedProductIds || [];
    const newLinked = linked.includes(productId)
      ? linked.filter(id => id !== productId)
      : [...linked, productId];
    setEditing({ ...editing, linkedProductIds: newLinked });
  };

  const linkedProducts = editing?.linkedProductIds?.map(id => products.find(p => p.id === id)).filter(Boolean) || [];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-purple-900 mb-2">Mystery Packs</h1>
        <p className="text-purple-400 text-sm font-semibold">Create and manage mystery packs linked to products</p>
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

      {editing ? (
        /* Edit/Create Form */
        <div className="bg-white rounded-3xl border border-purple-100 shadow-sm p-8 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-purple-900">{editing.id ? 'Edit Pack' : 'Create New Pack'}</h2>
            <button
              onClick={() => setEditing(null)}
              className="p-2 hover:bg-purple-50 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-purple-400" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Pack Name</label>
                <input
                  type="text"
                  value={editing.name || ''}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className={inputCls}
                  placeholder="e.g. Golden Mystery Pack"
                />
              </div>

              <div>
                <label className={labelCls}>Description</label>
                <textarea
                  value={editing.description || ''}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  rows={3}
                  className={cn(inputCls, 'resize-none')}
                  placeholder="What's in this pack?"
                />
              </div>

              <div>
                <label className={labelCls}>Price (R)</label>
                <input
                  type="number"
                  value={editing.price || ''}
                  onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })}
                  className={inputCls}
                  placeholder="0"
                />
              </div>

              <div>
                <label className={labelCls}>Image URL</label>
                <input
                  type="text"
                  value={editing.imageUrl || ''}
                  onChange={(e) => setEditing({ ...editing, imageUrl: e.target.value })}
                  className={inputCls}
                  placeholder="https://..."
                />
              </div>
            </div>

            {/* Product Selection */}
            <div>
              <label className={labelCls}>Link Products</label>
              {products.length === 0 ? (
                <div className="p-4 bg-purple-50 rounded-2xl border border-purple-100 text-center">
                  <p className="text-purple-400 text-sm font-semibold">No products with pack allocation available</p>
                  <p className="text-purple-300 text-xs mt-1">Allocate stock to packs in product settings</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {products.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => toggleProductLink(product.id)}
                      className={cn(
                        'w-full p-3 rounded-2xl border transition-all text-left flex items-center gap-3',
                        (editing.linkedProductIds || []).includes(product.id)
                          ? 'border-green-400 bg-green-50'
                          : 'border-purple-100 hover:border-purple-300'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={(editing.linkedProductIds || []).includes(product.id)}
                        onChange={() => {}}
                        className="w-4 h-4"
                      />
                      <img src={product.imageUrl} className="w-10 h-10 rounded-lg object-cover" alt="" />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-xs text-purple-900 truncate">{product.name}</p>
                        <p className="text-[10px] text-purple-400">{product.allocations?.packs || 0} allocated</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {linkedProducts.length > 0 && (
                <div className="mt-4 pt-4 border-t border-purple-100">
                  <p className="text-xs font-bold text-purple-400 mb-2">Selected ({linkedProducts.length})</p>
                  <div className="space-y-2">
                    {linkedProducts.map((product) => (
                      <div key={product.id} className="p-2 bg-green-50 rounded-lg border border-green-200 flex items-center justify-between">
                        <span className="text-xs font-bold text-green-700 truncate">{product.name}</span>
                        <button
                          onClick={() => toggleProductLink(product.id)}
                          className="p-1 hover:bg-green-100 rounded transition-colors"
                        >
                          <X className="w-3 h-3 text-green-600" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-purple-100">
            <button
              onClick={() => setEditing(null)}
              className="flex-1 py-3 rounded-2xl text-sm font-bold text-purple-700 bg-purple-50 border-2 border-purple-100 hover:border-purple-300 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-3 rounded-2xl text-sm font-bold text-white disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Pack'}
            </button>
          </div>
        </div>
      ) : (
        /* Pack Grid */
        <>
          <button
            onClick={() => setEditing({ ...BLANK })}
            className="mb-6 flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-black text-white hover:opacity-90 transition-all"
            style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}
          >
            <Plus className="w-4 h-4" /> New Pack
          </button>

          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => <div key={i} className="aspect-square bg-purple-50 animate-pulse rounded-3xl" />)}
            </div>
          ) : packs.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-purple-100">
              <Gift className="w-10 h-10 mx-auto mb-3 text-purple-200" />
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
                        <Gift className="w-12 h-12 text-purple-200" />
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
                    {pack.linkedProductIds && pack.linkedProductIds.length > 0 && (
                      <p className="text-[9px] text-purple-500 mt-1">Linked to {pack.linkedProductIds.length} product(s)</p>
                    )}
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
        </>
      )}
    </div>
  );
}
