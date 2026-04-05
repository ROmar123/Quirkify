import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../../firebase';
import { Auction } from '../../../types';
import { motion } from 'motion/react';
import { Gavel, Clock, AlertCircle } from 'lucide-react';
import { cn } from '../../../lib/utils';

interface AuctionsListProps {
  onSelectAuction: (auctionId: string) => void;
  filter?: 'all' | 'ending-soon' | 'no-bids';
}

export default function AuctionsList({
  onSelectAuction,
  filter = 'all'
}: AuctionsListProps) {
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, 'auctions'), where('status', '==', 'active')),
      (snapshot) => {
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Auction));
        setAuctions(docs);
        setLoading(false);
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, 'auctions');
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  const timeLeft = (endTime: string) => {
    const diff = new Date(endTime).getTime() - Date.now();
    if (diff <= 0) return { text: 'Ended', hours: -1 };
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return { text: `${h}h ${m}m`, hours: h };
  };

  const isEndingSoon = (endTime: string) => {
    const { hours } = timeLeft(endTime);
    return hours >= 0 && hours < 1;
  };

  const hasBids = (auction: Auction) => {
    return (auction.currentBid || 0) > auction.startPrice;
  };

  // Apply filters
  let filtered = auctions;
  if (filter === 'ending-soon') {
    filtered = auctions.filter(a => isEndingSoon(a.endTime));
  } else if (filter === 'no-bids') {
    filtered = auctions.filter(a => !hasBids(a));
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-40 bg-purple-100 animate-pulse rounded-3xl border-2 border-purple-100" />
        ))}
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="p-12 text-center bg-white rounded-3xl border-2 border-purple-100 shadow-sm">
        <div className="flex justify-center mb-4">
          <Gavel className="w-12 h-12 text-purple-300" />
        </div>
        <p className="text-purple-400 text-sm font-semibold">No auctions</p>
        <p className="text-purple-300 text-xs mt-1">
          {filter === 'all' ? 'Create your first auction to get started' : 'No auctions match this filter'}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
      {filtered.map((auction) => {
        const { text: timeText } = timeLeft(auction.endTime);
        const ending = isEndingSoon(auction.endTime);
        const bids = hasBids(auction);

        return (
          <motion.button
            key={auction.id}
            onClick={() => onSelectAuction(auction.id)}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -4, boxShadow: '0 12px 24px rgba(251, 146, 60, 0.1)' }}
            whileTap={{ scale: 0.98 }}
            className="bg-white rounded-3xl border-2 border-amber-100 overflow-hidden hover:border-amber-300 transition-all text-left shadow-sm"
          >
            {/* Gradient Bar */}
            <div className="h-1.5 bg-gradient-to-r from-amber-500 to-orange-600" />

            {/* Content */}
            <div className="p-4 sm:p-5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-black text-purple-900 text-sm line-clamp-2">
                    {auction.product?.name || 'Unknown Product'}
                  </h3>
                </div>
                {ending && (
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                )}
              </div>

              <div className="space-y-2 pt-3 border-t-2 border-amber-100">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-amber-600 uppercase tracking-widest">Start</span>
                  <span className="font-black text-sm text-purple-900">R{auction.startPrice}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-amber-600 uppercase tracking-widest">Current</span>
                  <span className={cn(
                    'font-black text-sm',
                    bids ? 'bg-gradient-to-r from-green-400 to-emerald-600 bg-clip-text text-transparent' : 'text-purple-900'
                  )}>
                    R{auction.currentBid || auction.startPrice}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-amber-600 uppercase tracking-widest">Time</span>
                  <span className={cn(
                    'font-black text-sm flex items-center gap-1',
                    ending ? 'text-red-600' : 'text-amber-600'
                  )}>
                    <Clock className="w-3 h-3" />
                    {timeText}
                  </span>
                </div>
              </div>

              {bids && (
                <div className="pt-2 border-t border-amber-100">
                  <p className="text-xs font-bold text-amber-700">
                    {auction.bidCount || 1} {(auction.bidCount || 1) === 1 ? 'bid' : 'bids'}
                  </p>
                </div>
              )}

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectAuction(auction.id);
                }}
                className="w-full mt-4 py-2.5 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-2xl transition-colors uppercase tracking-widest"
              >
                Manage
              </button>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
