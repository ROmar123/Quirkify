import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../../firebase';
import { Product, Auction } from '../../../types';
import { createAuction } from '../../../services/auctionService';
import { motion, AnimatePresence } from 'motion/react';
import { Gavel, AlertCircle, CheckCircle2, Clock, ChevronRight, X, Edit2, Trash2, AlertTriangle } from 'lucide-react';
import { cn } from '../../../lib/utils';

export default function AuctionEditor() {
  const [products, setProducts] = useState<Product[]>([]);
  const [activeAuctions, setActiveAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [startPrice, setStartPrice] = useState<number>(0);
  const [durationHours, setDurationHours] = useState<number>(24);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Auction editing state
  const [selectedAuction, setSelectedAuction] = useState<Auction | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editStartPrice, setEditStartPrice] = useState<number>(0);
  const [editDurationHours, setEditDurationHours] = useState<number>(24);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    // Load approved products with auction allocation
    const qProducts = query(collection(db, 'products'), where('status', '==', 'approved'));
    const unsubProducts = onSnapshot(qProducts, snap => {
      const allProducts = snap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
      // Filter to only show products with auction allocation > 0
      const auctionProducts = allProducts.filter(p => (p.allocations?.auction || 0) > 0);
      setProducts(auctionProducts);
    }, err => handleFirestoreError(err, OperationType.GET, 'products'));

    // Load active auctions
    const qAuctions = query(collection(db, 'auctions'), where('status', '==', 'active'));
    const unsubAuctions = onSnapshot(qAuctions, async snap => {
      const auctions = snap.docs.map(d => ({ id: d.id, ...d.data() } as Auction));

      // Auto-delist auctions with 0 allocation
      for (const auction of auctions) {
        try {
          const productDoc = await getDoc(doc(db, 'products', auction.productId));
          if (productDoc.exists()) {
            const product = productDoc.data() as Product;
            const auctionAllocation = product.allocations?.auction ?? 0;
            if (auctionAllocation <= 0) {
              // This will be handled by Cloud Function in production
              // For now, just mark as ended
            }
          }
        } catch (error) {
          console.error(`Error checking allocation for auction ${auction.id}:`, error);
        }
      }

      setActiveAuctions(auctions);
      setLoading(false);
    }, err => {
      handleFirestoreError(err, OperationType.GET, 'auctions');
      setLoading(false);
    });

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
      setError(`${selectedProduct.name} has no stock allocated for auctions. Please allocate stock in product settings.`);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const now = new Date();
      await createAuction({
        productId: selectedProduct.id,
        sellerId: 'admin',
        startPrice,
        startTime: now.toISOString(),
        endTime: new Date(now.getTime() + durationHours * 3600000).toISOString(),
      });
      setSuccess(`Auction launched for ${selectedProduct.name}!`);
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

  const handleSelectAuction = (auction: Auction) => {
    setSelectedAuction(auction);
    setEditStartPrice(auction.startPrice);
    setEditDurationHours(Math.ceil((new Date(auction.endTime).getTime() - new Date(auction.startTime).getTime()) / 3600000));
    setEditMode(false);
    setShowDeleteConfirm(false);
  };

  const handleUpdateAuction = async () => {
    if (!selectedAuction || editStartPrice <= 0) {
      setError('Start price must be greater than 0');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const startTime = new Date(selectedAuction.startTime);
      const newEndTime = new Date(startTime.getTime() + editDurationHours * 3600000);

      await updateDoc(doc(db, 'auctions', selectedAuction.id), {
        startPrice: editStartPrice,
        endTime: newEndTime.toISOString(),
        updatedAt: new Date().toISOString(),
      });

      setSuccess('Auction updated successfully!');
      setEditMode(false);
      setSelectedAuction(null);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update auction');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAuction = async () => {
    if (!selectedAuction) return;

    // Check if auction has bids
    const hasBids = (selectedAuction.currentBid || 0) > selectedAuction.startPrice;
    if (hasBids) {
      setError('Cannot delete auctions with existing bids');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await deleteDoc(doc(db, 'auctions', selectedAuction.id));
      setSuccess('Auction deleted successfully!');
      setSelectedAuction(null);
      setShowDeleteConfirm(false);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to delete auction');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-purple-900 mb-2">Auctions</h1>
        <p className="text-purple-400 text-sm font-semibold">Create and manage live auctions for your products</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create Auction Form */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-3xl border-2 border-purple-100 shadow-sm p-8 space-y-6">
            <div>
              <h2 className="text-xl font-black text-purple-900 mb-4">Start New Auction</h2>

              {error && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="mb-4 p-3 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />{error}
                </motion.div>
              )}

              {success && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="mb-4 p-3 bg-green-50 border border-green-100 rounded-2xl text-green-600 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />{success}
                </motion.div>
              )}
            </div>

            {/* Product Selection */}
            <div>
              <label className="block text-xs font-bold text-purple-400 mb-3 uppercase tracking-widest">Select Product</label>
              {loading ? (
                <div className="h-12 bg-purple-50 animate-pulse rounded-2xl" />
              ) : products.length === 0 ? (
                <div className="p-4 bg-purple-50 rounded-2xl border border-purple-100 text-center">
                  <p className="text-purple-400 text-sm font-semibold">No products with auction allocation available</p>
                  <p className="text-purple-300 text-xs mt-1">Allocate stock to auctions in product settings</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {products.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => setSelectedProduct(product)}
                      className={cn(
                        'w-full p-4 rounded-2xl border transition-all text-left flex items-center gap-4',
                        selectedProduct?.id === product.id
                          ? 'border-purple-400 text-white'
                          : 'bg-white border-purple-100 text-purple-900 hover:border-purple-300'
                      )}
                      style={selectedProduct?.id === product.id ? { background: 'linear-gradient(135deg, #F472B6, #A855F7)' } : {}}
                    >
                      <img src={product.imageUrl} className="w-12 h-12 rounded-lg object-cover" alt="" />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm truncate">{product.name}</p>
                        <p className={cn(
                          'text-xs',
                          selectedProduct?.id === product.id ? 'text-white/70' : 'text-purple-400'
                        )}>
                          R{product.discountPrice} • {product.allocations?.auction || 0} allocated
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedProduct && (
              <AnimatePresence mode="wait">
                <motion.div key={selectedProduct.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 pt-4 border-t border-purple-100">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-purple-400 mb-2 uppercase tracking-widest">Start Price (R)</label>
                      <input
                        type="number"
                        min="1"
                        value={startPrice}
                        onChange={(e) => setStartPrice(Number(e.target.value))}
                        className="w-full px-4 py-3 bg-white border-2 border-purple-100 rounded-2xl text-sm font-bold text-purple-800 focus:outline-none focus:border-purple-400"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-purple-400 mb-2 uppercase tracking-widest">Duration (Hours)</label>
                      <input
                        type="number"
                        min="1"
                        value={durationHours}
                        onChange={(e) => setDurationHours(Number(e.target.value))}
                        className="w-full px-4 py-3 bg-white border-2 border-purple-100 rounded-2xl text-sm font-bold text-purple-800 focus:outline-none focus:border-purple-400"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleStartAuction}
                    disabled={saving || startPrice <= 0}
                    className="w-full py-3 rounded-2xl font-bold text-white text-sm disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                    style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}
                  >
                    <Gavel className="w-5 h-5" />
                    {saving ? 'Starting Auction...' : 'Start Auction'}
                  </button>
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        </div>

        {/* Active Auctions */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-3xl border border-purple-100 shadow-sm p-6">
            <h3 className="text-lg font-black text-purple-900 mb-4">Active Auctions</h3>
            {loading ? (
              <div className="space-y-3">
                {[1, 2].map(i => (
                  <div key={i} className="h-24 bg-purple-50 animate-pulse rounded-2xl" />
                ))}
              </div>
            ) : activeAuctions.length === 0 ? (
              <p className="text-purple-300 text-xs font-bold text-center py-8">No active auctions</p>
            ) : (
              <div className="space-y-3">
                {activeAuctions.map((auction) => (
                  <motion.button
                    key={auction.id}
                    onClick={() => handleSelectAuction(auction)}
                    whileHover={{ y: -2 }}
                    className={cn(
                      'w-full p-3 rounded-2xl border transition-all text-left',
                      selectedAuction?.id === auction.id
                        ? 'bg-purple-100 border-purple-400'
                        : 'bg-purple-50 border-purple-100 hover:border-purple-300'
                    )}
                  >
                    <p className="text-xs font-bold text-purple-900 truncate">{auction.product?.name || 'Product'}</p>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-[10px] text-purple-400 font-bold">R{auction.currentBid || auction.startPrice}</span>
                      <span className="text-[10px] text-amber-600 font-bold flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {timeLeft(auction.endTime)}
                      </span>
                    </div>
                  </motion.button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Auction Details Modal */}
      <AnimatePresence>
        {selectedAuction && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedAuction(null)}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl border-2 border-purple-100 shadow-xl max-w-md w-full max-h-screen overflow-y-auto"
            >
              {/* Header */}
              <div className="sticky top-0 bg-white border-b border-purple-100 p-6 flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-black text-purple-900">{selectedAuction.product?.name || 'Auction'}</h3>
                  <p className="text-xs text-purple-400 font-semibold mt-1">ID: {selectedAuction.id.slice(0, 8)}...</p>
                </div>
                <button
                  onClick={() => setSelectedAuction(null)}
                  className="p-2 hover:bg-purple-100 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5 text-purple-600" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6">
                {/* Status Section */}
                <div className="space-y-3">
                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-4">
                    <p className="text-xs text-purple-400 font-bold uppercase mb-1">Current Status</p>
                    <p className="text-lg font-black text-purple-900">
                      {timeLeft(selectedAuction.endTime)}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-purple-50 rounded-2xl p-3">
                      <p className="text-[10px] text-purple-400 font-bold uppercase mb-1">Start Price</p>
                      <p className="text-base font-black text-purple-900">R{selectedAuction.startPrice}</p>
                    </div>
                    <div className="bg-purple-50 rounded-2xl p-3">
                      <p className="text-[10px] text-purple-400 font-bold uppercase mb-1">Current Bid</p>
                      <p className="text-base font-black text-purple-900">R{selectedAuction.currentBid || '—'}</p>
                    </div>
                  </div>
                </div>

                {/* Bid Information */}
                {(selectedAuction.currentBid || 0) > selectedAuction.startPrice && (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-amber-900 text-sm">Active Bids</p>
                        <p className="text-xs text-amber-700 mt-1">This auction has received bids and cannot be deleted.</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Edit Form */}
                {editMode ? (
                  <div className="space-y-4 p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl">
                    <h4 className="font-bold text-purple-900">Edit Auction</h4>
                    <div>
                      <label className="block text-xs font-bold text-purple-400 mb-2 uppercase">Start Price (R)</label>
                      <input
                        type="number"
                        value={editStartPrice}
                        onChange={(e) => setEditStartPrice(Number(e.target.value))}
                        min="1"
                        className="w-full px-3 py-2 rounded-lg border-2 border-purple-100 text-sm font-bold focus:outline-none focus:border-purple-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-purple-400 mb-2 uppercase">Duration (Hours)</label>
                      <input
                        type="number"
                        value={editDurationHours}
                        onChange={(e) => setEditDurationHours(Number(e.target.value))}
                        min="1"
                        className="w-full px-3 py-2 rounded-lg border-2 border-purple-100 text-sm font-bold focus:outline-none focus:border-purple-400"
                      />
                    </div>

                    {error && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3 bg-red-50 border border-red-100 rounded-xl text-red-700 text-xs font-bold flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" /> {error}
                      </motion.div>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditMode(false)}
                        className="flex-1 py-2 rounded-lg text-sm font-bold text-purple-700 bg-white border-2 border-purple-100 hover:border-purple-300"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleUpdateAuction}
                        disabled={saving}
                        className="flex-1 py-2 rounded-lg text-sm font-bold text-white disabled:opacity-60"
                        style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}
                      >
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditMode(true)}
                      className="flex-1 py-2 px-3 rounded-lg text-sm font-bold text-white bg-gradient-to-r from-pink-500 to-purple-600 hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                      disabled={(selectedAuction.currentBid || 0) > selectedAuction.startPrice}
                    >
                      <Edit2 className="w-4 h-4" /> Edit
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="flex-1 py-2 px-3 rounded-lg text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                      disabled={(selectedAuction.currentBid || 0) > selectedAuction.startPrice}
                    >
                      <Trash2 className="w-4 h-4" /> Delete
                    </button>
                  </div>
                )}

                {/* Delete Confirmation */}
                {showDeleteConfirm && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-4 bg-red-50 border-2 border-red-200 rounded-2xl"
                  >
                    <p className="font-bold text-red-900 mb-3">Delete this auction?</p>
                    <p className="text-sm text-red-700 mb-4">This action cannot be undone.</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        className="flex-1 py-2 rounded-lg text-sm font-bold text-red-700 bg-white border-2 border-red-200 hover:border-red-300"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDeleteAuction}
                        disabled={saving}
                        className="flex-1 py-2 rounded-lg text-sm font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60"
                      >
                        {saving ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </motion.div>
                )}

                {success && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3 bg-green-50 border border-green-100 rounded-xl text-green-700 text-xs font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> {success}
                  </motion.div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
