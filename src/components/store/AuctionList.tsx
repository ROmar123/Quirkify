import { useState, useEffect, useRef } from 'react';
import { Auction, Bid } from '../../types';
import { subscribeToAuctions, placeBid, subscribeToBids, concludeAuction } from '../../services/auctionService';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, TrendingUp, Gavel, AlertCircle, CheckCircle2, Sparkles, Users, User as UserIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Link } from 'react-router-dom';

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
      return;
    }

    try {
      setError(null);
      await placeBid(auctionId, amount);
      gavelAudio.current?.play().catch(() => {});
      setSuccess('Bid placed successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to place bid');
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 px-4 py-12">
        {[1, 2, 3].map(i => (
          <div key={`skeleton-${i}`} className="aspect-[3/4] bg-zinc-50 animate-pulse rounded-none" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <header className="mb-24 flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-7xl md:text-[10rem] font-bold tracking-tighter mb-4 text-black leading-[0.8] font-display"
          >
            LIVE <br />
            <span className="text-quirky italic">DROPS.</span>
          </motion.h1>
          <p className="text-zinc-500 max-w-md text-[10px] font-bold uppercase tracking-[0.4em] mt-8">
            Exclusive Quirkify Verified items. Bid now to secure yours.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-hot rounded-full animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-hot">Live Ticker</span>
          </div>
          <div className="h-12 overflow-hidden border-l-2 border-hot pl-4">
            <motion.div
              animate={{ y: [0, -48, -96] }}
              transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
              className="space-y-4"
            >
              <p className="text-[10px] font-bold uppercase tracking-tight">User_42 bid R1,200 on Vintage Lens</p>
              <p className="text-[10px] font-bold uppercase tracking-tight">Quirky_Collector bid R5,000 on Monolith</p>
              <p className="text-[10px] font-bold uppercase tracking-tight">Neon_Soul bid R800 on Cyber Cap</p>
            </motion.div>
          </div>
        </div>
      </header>

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

      {auctions.length === 0 ? (
        <div className="text-center py-32 border border-zinc-100 rounded-none bg-zinc-50">
          <Gavel className="w-12 h-12 mx-auto mb-4 text-zinc-300" />
          <p className="text-zinc-400 font-bold uppercase tracking-widest text-xs">No active auctions.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
          {auctions.map((auction) => (
            <AuctionCard 
              key={auction.id} 
              auction={auction} 
              onBid={(amount) => handleBid(auction.id, auction.currentBid)}
              bidValue={bidAmount[auction.id] || 0}
              setBidValue={(val) => setBidAmount(prev => ({ ...prev, [auction.id]: val }))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AuctionCard({ auction, onBid, bidValue, setBidValue }: { 
  auction: Auction, 
  onBid: (amount: number) => void,
  bidValue: number,
  setBidValue: (val: number) => void
}) {
  const [timeLeft, setTimeLeft] = useState('');
  const [bids, setBids] = useState<Bid[]>([]);
  const [showBids, setShowBids] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToBids(auction.id, setBids);
    return unsubscribe;
  }, [auction.id]);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date().getTime();
      const end = new Date(auction.endTime).getTime();
      const distance = end - now;

      if (distance < 0) {
        setTimeLeft('ENDED');
        clearInterval(timer);
        if (auction.status === 'active') {
          concludeAuction(auction.id);
        }
      } else {
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);
        setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [auction.endTime, auction.id, auction.status]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="group border border-zinc-100 bg-white p-8 rounded-none shadow-sm hover:shadow-2xl transition-all duration-500"
    >
      <div className="aspect-[3/4] overflow-hidden bg-zinc-50 mb-8 relative border border-zinc-100">
        {auction.product && (
          <img 
            src={auction.product.imageUrl} 
            alt={auction.product.name}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 grayscale group-hover:grayscale-0"
            referrerPolicy="no-referrer"
          />
        )}
        <div className={cn(
          "absolute top-4 left-4 text-white text-[8px] font-bold px-2 py-1 uppercase tracking-widest flex items-center gap-2",
          auction.product?.rarity === 'Unique' ? 'bg-cyber text-black' : 
          auction.product?.rarity === 'Super Rare' ? 'bg-hot' : 
          auction.product?.rarity === 'Rare' ? 'bg-quirky' : 'bg-black'
        )}>
          <Clock className="w-3 h-3" />
          {timeLeft}
        </div>
        <button 
          onClick={() => setShowBids(!showBids)}
          className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm text-black text-[8px] font-bold px-2 py-1 uppercase tracking-widest border border-zinc-100 hover:bg-black hover:text-white transition-colors"
        >
          {auction.bidCount} BIDS
        </button>
        {auction.product?.rarity && (
          <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm text-black text-[8px] font-bold px-2 py-1 uppercase tracking-widest border border-zinc-100">
            {auction.product.rarity}
          </div>
        )}

        <AnimatePresence>
          {showBids && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute inset-x-4 bottom-12 bg-white/95 backdrop-blur-md border border-zinc-100 p-4 shadow-2xl z-10"
            >
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-[8px] font-bold uppercase tracking-widest">Bidding History</h4>
                <button onClick={() => setShowBids(false)} className="text-[8px] font-bold uppercase tracking-widest text-zinc-400">Close</button>
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {bids.map((bid, i) => (
                  <div key={bid.id} className="flex items-center justify-between py-1 border-b border-zinc-50 last:border-0">
                    <div className="flex items-center gap-2">
                      <Link to={`/profile/${bid.bidderId}`} className="w-4 h-4 bg-zinc-100 rounded-full flex items-center justify-center hover:bg-quirky transition-colors">
                        <UserIcon className="w-2 h-2 text-zinc-400 hover:text-white" />
                      </Link>
                      <span className="text-[8px] font-bold truncate w-24">{(bid as any).bidderName || 'Anonymous'}</span>
                    </div>
                    <span className="text-[8px] font-bold">R{bid.amount}</span>
                  </div>
                ))}
                {bids.length === 0 && (
                  <p className="text-[8px] text-zinc-400 font-bold uppercase tracking-widest text-center py-4">No bids yet</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-bold text-xl uppercase tracking-tight truncate font-display">{auction.product?.name}</h3>
            <p className="text-zinc-400 text-[8px] font-bold uppercase tracking-widest">{auction.product?.category}</p>
          </div>
          <TrendingUp className="w-5 h-5 text-quirky" />
        </div>

        <div className="grid grid-cols-4 gap-1">
          {Object.entries(auction.product?.stats || {}).map(([key, val]) => (
            <div key={key} className="bg-zinc-50 p-2 text-center border border-zinc-100">
              <p className="text-[6px] text-zinc-400 uppercase font-bold">{key[0]}</p>
              <p className="text-[10px] font-bold">{val}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between p-6 bg-zinc-50 border border-zinc-100">
          <div>
            <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Current Bid</p>
            <p className="text-2xl font-bold text-black">R{auction.currentBid}</p>
          </div>
          <div className="w-10 h-10 bg-cyber rounded-none flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-black" />
          </div>
        </div>

        <div className="flex gap-3">
          <div className="flex-1 relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 text-[10px] font-bold">R</span>
            <input 
              type="number" 
              value={bidValue || ''}
              onChange={(e) => setBidValue(Number(e.target.value))}
              placeholder={`${auction.currentBid + 1}`}
              className="w-full pl-8 pr-4 py-4 bg-white border border-zinc-100 text-xs font-bold focus:outline-none focus:border-quirky transition-colors"
            />
          </div>
          <button 
            onClick={() => onBid(bidValue)}
            disabled={timeLeft === 'ENDED' || !bidValue || bidValue <= auction.currentBid}
            className="px-8 py-4 bg-black text-white text-[10px] font-bold uppercase tracking-widest hover:bg-quirky transition-all disabled:bg-zinc-100 disabled:text-zinc-400"
          >
            PLACE BID
          </button>
        </div>
        <p className="text-[8px] text-zinc-400 font-bold uppercase tracking-widest text-center">
          {timeLeft === 'ENDED' ? 'Auction has concluded' : `Minimum bid: R${auction.currentBid + 1}`}
        </p>
      </div>
    </motion.div>
  );
}
