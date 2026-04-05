import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../../firebase';
import { Pack } from '../../../types';
import { motion } from 'motion/react';
import { Gift } from 'lucide-react';
import { cn } from '../../../lib/utils';

interface PacksListProps {
  onSelectPack: (packId: string) => void;
}

export default function PacksList({ onSelectPack }: PacksListProps) {
  const [packs, setPacks] = useState<Pack[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'packs'),
      (snapshot) => {
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Pack));
        setPacks(docs);
        setLoading(false);
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, 'packs');
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-56 bg-purple-100 animate-pulse rounded-3xl border-2 border-purple-100" />
        ))}
      </div>
    );
  }

  if (packs.length === 0) {
    return (
      <div className="p-12 text-center bg-white rounded-3xl border-2 border-purple-100 shadow-sm">
        <div className="flex justify-center mb-4">
          <Gift className="w-12 h-12 text-purple-300" />
        </div>
        <p className="text-purple-400 text-sm font-semibold">No packs yet</p>
        <p className="text-purple-300 text-xs mt-1">Create your first mystery pack to get started</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
      {packs.map((pack) => (
        <motion.button
          key={pack.id}
          onClick={() => onSelectPack(pack.id)}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ y: -4, boxShadow: '0 12px 24px rgba(244, 63, 94, 0.1)' }}
          whileTap={{ scale: 0.98 }}
          className="bg-white rounded-3xl border-2 border-rose-100 overflow-hidden hover:border-rose-300 transition-all text-left shadow-sm"
        >
          {/* Gradient Bar */}
          <div className="h-1.5 bg-gradient-to-r from-pink-500 to-rose-600" />

          {/* Image */}
          <div className="relative h-40 bg-purple-50 overflow-hidden group">
            <img
              src={pack.imageUrl}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
              alt={pack.name}
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://via.placeholder.com/200?text=Pack';
              }}
            />
            <span className="absolute top-3 right-3 text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-widest bg-white/90 text-purple-900">
              {pack.status}
            </span>
          </div>

          {/* Content */}
          <div className="p-4 sm:p-5 space-y-3">
            <div>
              <h3 className="font-black text-purple-900 text-sm mb-1 line-clamp-2">{pack.name}</h3>
              <p className="text-xs text-purple-400 font-semibold line-clamp-2">{pack.description}</p>
            </div>

            <div className="space-y-2 pt-3 border-t-2 border-rose-100">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-rose-600 uppercase tracking-widest">Price</span>
                <span className="font-black text-sm text-purple-900">R{pack.price}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-rose-600 uppercase tracking-widest">Items</span>
                <span className="font-black text-sm text-purple-900">{pack.contents?.itemCount || 3}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-rose-600 uppercase tracking-widest">Linked</span>
                <span className="font-black text-sm bg-gradient-to-r from-pink-400 to-rose-600 bg-clip-text text-transparent">
                  {pack.linkedProductIds?.length || 0} products
                </span>
              </div>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelectPack(pack.id);
              }}
              className="w-full mt-4 py-2.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-2xl transition-colors uppercase tracking-widest"
            >
              Edit Pack
            </button>
          </div>
        </motion.button>
      ))}
    </div>
  );
}
