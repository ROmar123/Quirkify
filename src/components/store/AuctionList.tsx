import { useState, useEffect, useRef } from 'react';
import { Auction, Bid } from '../../types';
import { subscribeToAuctions, placeBid, subscribeToBids, concludeAuction } from '../../services/auctionService';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, Gavel, ChevronDown, ChevronUp, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '../../lib/utils';
export default function AuctionList() {
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [bidAmount, setBidAmount] = useState<{ [key: string]: number }>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const gavelAudio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    gavelAudio.current = new Audio('https://assets.mixkit.co/active_storage/sfx/212/212-preview.mp3');
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToAuctions((data) => {
      setAuctions(data);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const handleBid = async (auctionId: string, currentBid: number) => {
    const amount = bidAmount[auctionId];
    if (!amount || amount <= currentBid) {
      setError('Bid must be higher than current bid');
      setTimeout(() => setError(null), 3000);
      return;
    }
    try {
      setError(null);
      await placeBid(auctionId, amount);
      gavelAudio.current?.play().catch(() => {});
      setSuccess('Bid placed!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to place bid');
      setTimeout(() => setError(null), 3000);
    }
  };

  if (loading) {
    return (
      <div className="px-4 py-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="aspect-[3/4] bg-purple-50 animate-pulse rounded-3xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="px-4 py-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-black gradient-text">Live Auctions 🔴</h1>
        <p className="text-purple-400 text-xs font-semibold mt-1">Bid on exclusive Quirkify drops — highest bid wins</p>
      </div>

      {/* Toasts */}
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

      {auctions.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-purple-100">
          <Gavel className="w-10 h-10 mx-auto mb-3 text-purple-200" />
          <p className="text-purple-400 font-bold text-sm">No active auctions right now</p>
          <p className="text-purple-300 text-xs mt-1">Check back soon for new drops</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {auctions.map(auction => (
            <AuctionCard
              key={auction.id}
              auction={auction}
              onBid={() => handleBid(auction.id, auction.currentBid)}
              bidValue={bidAmount[auction.id] || 0}
              setBidValue={val => setBidAmount(prev => ({ ...prev, [auction.id]: val }))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AuctionCard({ auction, onBid, bidValue, setBidValue }: {
  auction: Auction;
  onBid: () => void;
  bidValue: number;
  setBidValue: (val: number) => void;
}) {
  const [timeLeft, setTimeLeft] = useState('');
  const [bids, setBids] = useState<Bid[]>([]);
  const [showBids, setShowBids] = useState(false);
  const ended = timeLeft === 'ENDED';

  useEffect(() => {
    const unsubscribe = subscribeToBids(auction.id, setBids);
    return unsubscribe;
  }, [auction.id]);

  useEffect(() => {
    const tick = () => {
      const distance = new Date(auction.endTime).getTime() - Date.now();
      if (distance < 0) {
        setTimeLeft('ENDED');
        if (auction.status === 'active') concludeAuction(auction.id);
      } else {
        const h = Math.floor(distance / 3600000);
        const m = Math.floor((distance % 3600000) / 60000);
        const s = Math.floor((distance % 60000) / 1000);
        setTimeLeft(`${h}h ${m}m ${s}s`);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [auction.endTime, auction.id, auction.status]);

  const rarityGradient: Record<string, string> = {
    'Unique':     'linear-gradient(135deg, #F59E0B, #EF4444)',
    'Super Rare': 'linear-gradient(135deg, #F472B6, #A855F7)',
    'Rare':       'linear-gradient(135deg, #A855F7, #6366F1)',
  };
  const gradient = rarityGradient[auction.product?.rarity || ''] || 'linear-gradient(135deg, #E9D5FF, #C4B5FD)';

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-3xl border border-purple-100 shadow-sm overflow-hidden hover:shadow-lg transition-all">

      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden bg-purple-50">
        {auction.product?.imageUrl ? (
          <img src={auction.product.imageUrl} alt={auction.product.name}
            className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Gavel className="w-12 h-12 text-purple-200" />
          </div>
        )}
        {/* Timer badge */}
        <div className={cn(
          'absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black text-white backdrop-blur-sm',
          ended ? 'bg-purple-300/80' : 'bg-purple-900/70'
        )}>
          <Clock className="w-3 h-3" />
          {timeLeft || '…'}
        </div>
        {/* Rarity badge */}
        {auction.product?.rarity && (
          <div className="absolute top-3 right-3 px-3 py-1.5 rounded-full text-xs font-black text-white"
            style={{ background: gradient }}>
            {auction.product.rarity}
          </div>
        )}
        {/* Bids toggle */}
        <button onClick={() => setShowBids(v => !v)}
          className="absolute bottom-3 right-3 flex items-center gap-1 bg-white/90 backdrop-blur-sm border border-purple-100 px-3 py-1.5 rounded-full text-xs font-bold text-purple-700 hover:bg-white transition-colors">
          <Gavel className="w-3 h-3" />
          {auction.bidCount} bids
          {showBids ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {/* Bid history */}
      <AnimatePresence>
        {showBids && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-b border-purple-50">
            <div className="px-4 py-3 bg-purple-50/50 max-h-36 overflow-y-auto space-y-1">
              {bids.length === 0 ? (
                <p className="text-xs text-purple-400 font-semibold text-center py-2">No bids yet — be first!</p>
              ) : bids.map(bid => (
                <div key={bid.id} className="flex justify-between items-center text-xs">
                  <span className="font-bold text-purple-700 truncate">{(bid as any).bidderName || 'Anonymous'}</span>
                  <span className="font-black text-purple-900">R{bid.amount}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Details */}
      <div className="p-4 space-y-3">
        <div>
          <h3 className="font-black text-sm text-purple-900 truncate">{auction.product?.name || `Auction #${auction.id.slice(-6)}`}</h3>
          <p className="text-xs text-purple-400 font-semibold">{auction.product?.category}</p>
        </div>

        {/* Current bid */}
        <div className="flex items-center justify-between px-4 py-3 rounded-2xl"
          style={{ background: 'linear-gradient(135deg, #FDF4FF, #EDE9FE)' }}>
          <div>
            <p className="text-[10px] font-bold text-purple-400 uppercase tracking-wide">Current Bid</p>
            <p className="text-xl font-black text-purple-900">R{auction.currentBid}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold text-purple-400 uppercase tracking-wide">Min Next</p>
            <p className="text-sm font-black text-purple-700">R{auction.currentBid + 1}</p>
          </div>
        </div>

        {/* Bid input */}
        {!ended && (
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-400 font-bold text-sm">R</span>
              <input type="number" value={bidValue || ''}
                onChange={e => setBidValue(Number(e.target.value))}
                placeholder={String(auction.currentBid + 1)}
                className="w-full pl-7 pr-3 py-2.5 bg-purple-50 border-2 border-purple-100 rounded-2xl text-sm font-bold text-purple-800 focus:outline-none focus:border-purple-400" />
            </div>
            <button onClick={onBid}
              disabled={!bidValue || bidValue <= auction.currentBid}
              className="px-4 py-2.5 rounded-2xl text-sm font-black text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:opacity-90 flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}>
              Bid
            </button>
          </div>
        )}
        {ended && (
          <div className="text-center py-2 text-xs font-bold text-purple-400 bg-purple-50 rounded-2xl">
            Auction ended
          </div>
        )}
      </div>
    </motion.div>
  );
}
