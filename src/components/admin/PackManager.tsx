import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';

import { Pack, Rarity } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { Box, Plus, Trash2, Edit2, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function PackManager() {
  const [packs, setPacks] = useState<Pack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [newPack, setNewPack] = useState<Partial<Pack>>({
    name: '',
    description: '',
    price: 0,
    imageUrl: 'https://picsum.photos/seed/pack/400/400',
    status: 'available',
  });

  useEffect(() => {
    const q = query(collection(db, 'packs'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPacks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Pack)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'packs');
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const handleCreatePack = async () => {
    if (!newPack.name || !newPack.price) {
      setError('Name and price are required');
      return;
    }

    try {
      await addDoc(collection(db, 'packs'), {
        ...newPack,
        contents: {
          rarityProbabilities: {
            'Common': 0.7,
            'Limited': 0.2,
            'Rare': 0.08,
            'Super Rare': 0.015,
            'Unique': 0.005,
          },
          itemCount: 3,
        }
      });
      setSuccess('Pack created successfully!');
      setNewPack({
        name: '',
        description: '',
        price: 0,
        imageUrl: 'https://picsum.photos/seed/pack/400/400',
        status: 'available',
      });
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Failed to create pack');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    try {
      await deleteDoc(doc(db, 'packs', id));
      setSuccess('Pack deleted');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Failed to delete pack');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="mb-12">
        <h1 className="text-4xl font-bold tracking-tight mb-2 text-black font-display uppercase">Pack Manager</h1>
        <p className="text-zinc-500 text-sm uppercase tracking-widest font-bold">Configure mystery drops and rarity pools.</p>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-8 p-4 bg-red-50 border border-red-100 text-red-600 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {error}
          </motion.div>
        )}
        {success && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-8 p-4 bg-green-50 border border-green-100 text-green-600 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> {success}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-1">
          <div className="bg-white border border-zinc-100 p-8 space-y-6 shadow-sm">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-4">Create New Pack</h2>
            <div>
              <label className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest mb-2 block">Pack Name</label>
              <input 
                type="text" 
                value={newPack.name}
                onChange={(e) => setNewPack({...newPack, name: e.target.value})}
                className="w-full px-4 py-3 bg-zinc-50 border border-zinc-100 text-xs font-bold focus:outline-none focus:border-quirky"
                placeholder="e.g. Genesis Drop"
              />
            </div>
            <div>
              <label className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest mb-2 block">Price (R)</label>
              <input 
                type="number" 
                value={newPack.price || ''}
                onChange={(e) => setNewPack({...newPack, price: Number(e.target.value)})}
                className="w-full px-4 py-3 bg-zinc-50 border border-zinc-100 text-xs font-bold focus:outline-none focus:border-quirky"
                placeholder="e.g. 250"
              />
            </div>
            <div>
              <label className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest mb-2 block">Description</label>
              <textarea 
                value={newPack.description}
                onChange={(e) => setNewPack({...newPack, description: e.target.value})}
                className="w-full px-4 py-3 bg-zinc-50 border border-zinc-100 text-xs font-bold focus:outline-none focus:border-quirky h-24 resize-none"
                placeholder="What's inside?"
              />
            </div>
            <button 
              onClick={handleCreatePack}
              className="w-full py-4 bg-black text-white text-[10px] font-bold uppercase tracking-widest hover:bg-quirky transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" /> Create Pack
            </button>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {packs.map(pack => (
              <div key={pack.id} className="bg-white border border-zinc-100 p-6 flex gap-6 shadow-sm group">
                <div className="w-24 h-24 bg-zinc-50 flex-shrink-0 flex items-center justify-center border border-zinc-100 overflow-hidden">
                  <img src={pack.imageUrl} className="w-16 h-16 object-contain group-hover:scale-110 transition-transform duration-500" alt="" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[8px] font-bold px-2 py-1 bg-black text-white uppercase tracking-widest">{pack.status}</span>
                    <button onClick={() => handleDelete(pack.id)} className="text-zinc-300 hover:text-red-500 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <h4 className="font-bold text-sm uppercase tracking-tight truncate mb-1">{pack.name}</h4>
                  <p className="text-[10px] font-bold text-quirky mb-2">R{pack.price}</p>
                  <p className="text-[8px] text-zinc-400 font-bold uppercase tracking-widest line-clamp-2">{pack.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
