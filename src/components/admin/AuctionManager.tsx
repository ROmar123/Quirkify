import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../../firebase';

import { Product, Auction } from '../../types';
import { createAuction } from '../../services/auctionService';
import { motion, AnimatePresence } from 'motion/react';
import { Gavel, Plus, Clock, ShoppingBag, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function AuctionManager() {
  const [approvedProducts, setApprovedProducts] = useState<Product[]>([]);
  const [activeAuctions, setActiveAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [startPrice, setStartPrice] = useState<number>(0);
  const [durationHours, setDurationHours] = useState<number>(24);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const qProducts = query(collection(db, 'products'), where('status', '==', 'approved'));
    const unsubscribeProducts = onSnapshot(qProducts, (snapshot) => {
      setApprovedProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'products');
    });

    const qAuctions = query(collection(db, 'auctions'), where('status', '==', 'active'));
    const unsubscribeAuctions = onSnapshot(qAuctions, (snapshot) => {
      setActiveAuctions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Auction)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'auctions');
      setLoading(false);
    });

    return () => {
      unsubscribeProducts();
      unsubscribeAuctions();
    };
  }, []);

  const handleStartAuction = async () => {
    if (!selectedProduct) return;
    if (startPrice <= 0) {
      setError('Start price must be greater than 0');
      return;
    }

    try {
      setError(null);
      const startTime = new Date().toISOString();
      const endTime = new Date(new Date().getTime() + durationHours * 60 * 60 * 1000).toISOString();

      await createAuction({
        productId: selectedProduct.id,
        sellerId: auth.currentUser?.uid || 'admin',
        startPrice,
        startTime,
        endTime,
      });

      setSuccess('Auction started successfully!');
      setSelectedProduct(null);
      setStartPrice(0);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to start auction');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="mb-12">
        <h1 className="text-4xl font-bold tracking-tight mb-2 text-black">Auction Manager</h1>
        <p className="text-zinc-500 text-sm uppercase tracking-widest font-bold">Launch and monitor exclusive product auctions.</p>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-8 p-4 bg-red-50 border border-red-100 text-red-600 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4" />
            {error}
          </motion.div>
        )}
        {success && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-8 p-4 bg-green-50 border border-green-100 text-green-600 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            {success}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-1 space-y-8">
          <section>
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-4">Launch New Auction</h2>
            <div className="p-6 bg-white border border-zinc-100 rounded-none shadow-sm space-y-6">
              <div>
                <label className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest mb-2 block">Select Product</label>
                <div className="grid grid-cols-2 gap-2">
                  {approvedProducts.map(product => (
                    <button
                      key={product.id}
                      onClick={() => setSelectedProduct(product)}
                      className={cn(
                        "p-2 border transition-all text-left flex items-center gap-2",
                        selectedProduct?.id === product.id ? "border-black bg-zinc-50" : "border-zinc-100 hover:border-zinc-300"
                      )}
                    >
                      <div className="w-8 h-8 bg-zinc-100 flex-shrink-0 relative">
                        <img src={product.imageUrl} className="w-full h-full object-cover" alt="" />
                        <div className={cn(
                          "absolute inset-0 border-2",
                          product.rarity === 'Unique' ? 'border-cyber' : 
                          product.rarity === 'Super Rare' ? 'border-hot' : 
                          product.rarity === 'Rare' ? 'border-quirky' : 'border-transparent'
                        )} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[8px] font-bold uppercase tracking-tight truncate block">{product.name}</span>
                        <span className="text-[6px] text-zinc-400 uppercase font-bold">{product.rarity}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {selectedProduct && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                  <div>
                    <label className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest mb-2 block">Start Price (R)</label>
                    <input 
                      type="number" 
                      value={startPrice || ''}
                      onChange={(e) => setStartPrice(Number(e.target.value))}
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-100 text-xs font-bold focus:outline-none focus:border-black transition-colors"
                      placeholder="e.g. 500"
                    />
                  </div>
                  <div>
                    <label className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest mb-2 block">Duration (Hours)</label>
                    <select 
                      value={durationHours}
                      onChange={(e) => setDurationHours(Number(e.target.value))}
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-100 text-xs font-bold focus:outline-none focus:border-black transition-colors"
                    >
                      <option value={1}>1 Hour</option>
                      <option value={12}>12 Hours</option>
                      <option value={24}>24 Hours</option>
                      <option value={48}>48 Hours</option>
                      <option value={168}>1 Week</option>
                    </select>
                  </div>
                  <button 
                    onClick={handleStartAuction}
                    className="w-full py-4 bg-black text-white text-[10px] font-bold uppercase tracking-widest hover:bg-zinc-800 transition-all flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Launch Auction
                  </button>
                </motion.div>
              )}
            </div>
          </section>
        </div>

        <div className="lg:col-span-2">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-4">Active Auctions ({activeAuctions.length})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {activeAuctions.map(auction => (
              <div key={auction.id} className="p-6 bg-white border border-zinc-100 rounded-none shadow-sm flex gap-4">
                <div className="w-20 h-20 bg-zinc-50 flex-shrink-0 border border-zinc-100">
                  {/* We'd need to fetch product data or denormalize it */}
                  <div className="w-full h-full flex items-center justify-center text-zinc-300">
                    <ShoppingBag className="w-8 h-8" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[8px] font-bold px-2 py-1 bg-black text-white uppercase tracking-widest">ACTIVE</span>
                    <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Ends {new Date(auction.endTime).toLocaleDateString()}
                    </span>
                  </div>
                  <h4 className="font-bold text-xs uppercase tracking-tight truncate mb-1">Auction #{auction.id.slice(-6)}</h4>
                  <p className="text-[10px] font-bold text-black">Current Bid: R{auction.currentBid}</p>
                  <p className="text-[8px] text-zinc-400 font-bold uppercase tracking-widest mt-2">{auction.bidCount} Bids Placed</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
