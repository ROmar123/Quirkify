import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../../firebase';
import { Product, Auction } from '../../types';
import { createAuction } from '../../services/auctionService';
import { motion, AnimatePresence } from 'motion/react';
import { Gavel, Plus, Clock, AlertCircle, CheckCircle2, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

const inputCls = 'w-full px-4 py-2.5 bg-purple-50 border-2 border-purple-100 rounded-2xl text-sm font-semibold text-purple-800 focus:outline-none focus:border-purple-400 transition-colors';
const labelCls = 'block text-xs font-bold text-purple-400 mb-1';

export default function AuctionManager() {
  const [approvedProducts, setApprovedProducts] = useState<Product[]>([]);
  const [activeAuctions, setActiveAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [startPrice, setStartPrice] = useState<number>(0);
  const [durationHours, setDurationHours] = useState<number>(24);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const qProducts = query(collection(db, 'products'), where('status', '==', 'approved'));
    const unsubProducts = onSnapshot(qProducts, snap => {
      setApprovedProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
    }, err => handleFirestoreError(err, OperationType.GET, 'products'));

    const qAuctions = query(collection(db, 'auctions'), where('status', '==', 'active'));
    const unsubAuctions = onSnapshot(qAuctions, snap => {
      setActiveAuctions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Auction)));
      setLoading(false);
    }, err => { handleFirestoreError(err, OperationType.GET, 'auctions'); setLoading(false); });

    return () => { unsubProducts(); unsubAuctions(); };
  }, []);

  const handleStartAuction = async () => {
    if (!selectedProduct || startPrice <= 0) {
      setError('Select a product and set a start price > 0');
      return;
    }

    // Validate auction allocation
    const auctionAllocation = selectedProduct.allocations?.auction ?? 0;
    if (auctionAllocation <= 0) {
      setError(`${selectedProduct.name} has no stock allocated for auctions. Please allocate stock in the products manager.`);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const now = new Date();
      await createAuction({
        productId: selectedProduct.id,
        sellerId: auth.currentUser?.uid || 'admin',
        startPrice,
        startTime: now.toISOString(),
        endTime: new Date(now.getTime() + durationHours * 3600000).toISOString(),
      });
      setSuccess('Auction launched!');
      setSelectedProduct(null);
      setStartPrice(0);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to start auction');
    } finally {
      setSaving(false);
    }
  };

  const timeLeft = (endTime: string) => {
    const diff = new Date(endTime).getTime() - Date.now();
    if (diff <= 0) return 'Ended';
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return `${h}h ${m}m`;
  };

  return (
    <div className="px-4 py-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-black gradient-text">Auction Manager</h1>
        <p className="text-purple-400 text-xs font-semibold mt-1">Launch and monitor product auctions</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Launch panel */}
        <div className="bg-white rounded-3xl border border-purple-100 p-5 shadow-sm space-y-5">
          <h2 className="text-sm font-black text-purple-900">Launch New Auction</h2>

          <div>
            <label className={labelCls}>Select Product</label>
            {approvedProducts.length === 0 ? (
              <p className="text-xs text-purple-400 font-semibold py-3 text-center bg-purple-50 rounded-2xl">No approved products yet</p>
            ) : (
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {approvedProducts.map(p => (
                  <button key={p.id} onClick={() => setSelectedProduct(p)}
                    className={cn(
                      'w-full flex items-center gap-3 p-2.5 rounded-2xl border-2 text-left transition-all',
                      selectedProduct?.id === p.id
                        ? 'border-purple-400 bg-purple-50'
                        : 'border-purple-100 hover:border-purple-300 bg-white'
                    )}>
                    <img src={p.imageUrl} className="w-10 h-10 rounded-xl object-cover flex-shrink-0" alt="" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-purple-900 truncate">{p.name}</p>
                      <p className="text-[10px] text-purple-400 font-semibold">
                        {p.condition} · Auction stock: {p.allocations?.auction ?? 0}
                      </p>
                    </div>
                    {selectedProduct?.id === p.id && (
                      <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }} />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <AnimatePresence>
            {selectedProduct && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }} className="space-y-4 overflow-hidden">
                <div>
                  <label className={labelCls}>Start Price (R)</label>
                  <input type="number" value={startPrice || ''} onChange={e => setStartPrice(Number(e.target.value))}
                    className={inputCls} placeholder="e.g. 500" />
                </div>
                <div>
                  <label className={labelCls}>Duration</label>
                  <select value={durationHours} onChange={e => setDurationHours(Number(e.target.value))} className={inputCls}>
                    <option value={1}>1 Hour</option>
                    <option value={12}>12 Hours</option>
                    <option value={24}>24 Hours</option>
                    <option value={48}>48 Hours</option>
                    <option value={168}>1 Week</option>
                  </select>
                </div>
                <button onClick={handleStartAuction} disabled={saving}
                  className="w-full py-3 rounded-2xl text-sm font-black text-white disabled:opacity-50 transition-all hover:opacity-90 flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}>
                  <Plus className="w-4 h-4" />
                  {saving ? 'Launching…' : 'Launch Auction'}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Active auctions */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-sm font-black text-purple-900">Active Auctions ({activeAuctions.length})</h2>

          {loading ? (
            <div className="space-y-3">
              {[1, 2].map(i => <div key={i} className="h-24 bg-purple-50 animate-pulse rounded-3xl" />)}
            </div>
          ) : activeAuctions.length === 0 ? (
            <div className="text-center py-14 bg-white rounded-3xl border border-purple-100">
              <Gavel className="w-8 h-8 mx-auto mb-2 text-purple-200" />
              <p className="text-xs font-bold text-purple-400">No active auctions</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {activeAuctions.map(auction => (
                <div key={auction.id} className="bg-white rounded-3xl border border-purple-100 p-4 flex gap-3 shadow-sm">
                  {auction.product ? (
                    <img src={(auction.product as any).imageUrl} className="w-16 h-16 rounded-2xl object-cover flex-shrink-0" alt="" />
                  ) : (
                    <div className="w-16 h-16 rounded-2xl bg-purple-50 flex items-center justify-center flex-shrink-0">
                      <Gavel className="w-6 h-6 text-purple-300" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-purple-900 truncate">
                      {(auction.product as any)?.name || `Auction #${auction.id.slice(-6)}`}
                    </p>
                    <p className="text-[10px] font-bold text-purple-400 mt-0.5">{auction.bidCount} bids · R{auction.currentBid}</p>
                    <div className="flex items-center gap-1 mt-2">
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 border border-green-100 rounded-full text-[10px] font-bold text-green-600">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        Live
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-50 border border-purple-100 rounded-full text-[10px] font-bold text-purple-600">
                        <Clock className="w-2.5 h-2.5" />
                        {timeLeft(auction.endTime)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
