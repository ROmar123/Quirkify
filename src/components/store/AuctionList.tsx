import { useState, useEffect, useRef } from 'react';
import { Auction, Bid } from '../../types';
import { subscribeToAuctions, placeBid, subscribeToBids, closeAuction } from '../../services/auctionService';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, Gavel, ChevronDown, ChevronUp, AlertCircle, CheckCircle2, Trophy, Flame, Users } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useNavigate } from 'react-router-dom';
import { auth } from '../../firebase';

export default function AuctionList() {
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [bidAmount, setBidAmount] = useState<Record<string, number>>({});
  const [bidding, setBidding] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const gavelAudio = useRef<HTMLAudioElement | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    gavelAudio.current = new Audio('https://assets.mixkit.co/active_storage/sfx/212/212-preview.mp3');
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setLoading(false);
    }, 5000);

    const unsub = subscribeToAuctions((data) => {
      window.clearTimeout(timeoutId);
      setAuctions(data);
      setLoading(false);
    }, (message) => {
      window.clearTimeout(timeoutId);
      setAuctions([]);
      setError(message);
      setLoading(false);
    });
    return () => {
      window.clearTimeout(timeoutId);
      unsub();
    };
  }, []);

  const handleBid = async (auctionId: string, currentBid: number) => {
    if (!auth.currentUser) {
      navigate('/auth?next=%2Fauctions');
      return;
    }
    const amount = bidAmount[auctionId];
    if (!amount || amount <= currentBid) {
      setError(`Bid must exceed R${currentBid}`);
      setTimeout(() => setError(null), 3000);
      return;
    }
    setBidding(b => ({ ...b, [auctionId]: true }));
    try {
      setError(null);
      await placeBid(auctionId, amount);
      gavelAudio.current?.play().catch(() => {});
      setSuccess('Bid placed successfully!');
      setBidAmount(prev => ({ ...prev, [auctionId]: 0 }));
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to place bid');
      setTimeout(() => setError(null), 3000);
    } finally {
      setBidding(b => ({ ...b, [auctionId]: false }));
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <div className="skeleton h-8 w-48 rounded-xl mb-2" />
          <div className="skeleton h-4 w-72 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-3xl border border-gray-100 overflow-hidden">
              <div className="skeleton aspect-[4/3]" style={{ borderRadius: 0 }} />
              <div className="p-4 space-y-3">
                <div className="skeleton h-5 w-3/4 rounded-lg" />
                <div className="skeleton h-4 w-1/2 rounded-lg" />
                <div className="skeleton h-16 rounded-2xl" />
                <div className="skeleton h-10 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const activeAuctions = auctions.filter(a => a.status === 'active' || a.status === 'live');
  const endedAuctions = auctions.filter(a => a.status !== 'active' && a.status !== 'live');

  return (
    <div className="hero-bg min-h-screen">
      <div className="max-w-7xl mx-auto px-4 py-8 pb-24">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#f472b6,#a855f7)' }}
            >
              <Gavel className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-extrabold text-gray-900" style={{ fontFamily: 'Nunito, sans-serif' }}>
                  Live Auctions
                </h1>
                {activeAuctions.length > 0 && (
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold text-white"
                    style={{ background: 'linear-gradient(135deg,#ef4444,#f97316)' }}>
                    <span className="live-dot" style={{ width: 6, height: 6 }} />
                    {activeAuctions.length} Live
                  </span>
                )}
              </div>
              <p className="text-gray-500 text-sm">Bid on exclusive drops — highest bid wins</p>
            </div>
          </div>
        </motion.div>

        {/* Toast notifications */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -4, height: 0 }}
              className="mb-4"
            >
              <div className="toast toast-error">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
              </div>
            </motion.div>
          )}
          {success && (
            <motion.div
              initial={{ opacity: 0, y: -8, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -4, height: 0 }}
              className="mb-4"
            >
              <div className="toast toast-success">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />{success}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {auctions.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-24 bg-white rounded-3xl border border-gray-100"
          >
            <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
              <Gavel className="w-8 h-8 text-gray-300" />
            </div>
            <p className="text-gray-600 font-semibold">No active auctions right now</p>
            <p className="text-gray-400 text-sm mt-1">Check back soon for new drops</p>
          </motion.div>
        ) : (
          <div className="space-y-8">
            {/* Active auctions */}
            {activeAuctions.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Flame className="w-4 h-4 text-orange-500" />
                  <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
                    Active Bidding
                  </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {activeAuctions.map(auction => (
                    <AuctionCard
                      key={auction.id}
                      auction={auction}
                      onBid={() => handleBid(auction.id, auction.currentBid)}
                      bidValue={bidAmount[auction.id] || 0}
                      setBidValue={val => setBidAmount(prev => ({ ...prev, [auction.id]: val }))}
                      isBidding={bidding[auction.id] || false}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Ended auctions */}
            {endedAuctions.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Trophy className="w-4 h-4 text-gray-400" />
                  <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide">
                    Recently Ended
                  </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 opacity-70">
                  {endedAuctions.map(auction => (
                    <AuctionCard
                      key={auction.id}
                      auction={auction}
                      onBid={() => {}}
                      bidValue={0}
                      setBidValue={() => {}}
                      isBidding={false}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AuctionCard({
  auction, onBid, bidValue, setBidValue, isBidding
}: {
  auction: Auction;
  onBid: () => void;
  bidValue: number;
  setBidValue: (val: number) => void;
  isBidding: boolean;
}) {
  const [timeLeft, setTimeLeft] = useState<{ h: number; m: number; s: number; ended: boolean }>({
    h: 0, m: 0, s: 0, ended: false
  });
  const [bids, setBids] = useState<Bid[]>([]);
  const [showBids, setShowBids] = useState(false);

  useEffect(() => {
    const unsub = subscribeToBids(auction.id, setBids);
    return unsub;
  }, [auction.id]);

  useEffect(() => {
    const tick = () => {
      const endAt = auction.endTime || auction.endsAt;
      const distance = new Date(endAt).getTime() - Date.now();
      if (distance < 0) {
        setTimeLeft({ h: 0, m: 0, s: 0, ended: true });
        if (auction.status === 'active' || auction.status === 'live') closeAuction(auction.id);
      } else {
        setTimeLeft({
          h: Math.floor(distance / 3600000),
          m: Math.floor((distance % 3600000) / 60000),
          s: Math.floor((distance % 60000) / 1000),
          ended: false,
        });
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [auction.endTime, auction.endsAt, auction.id, auction.status]);

  const ended = timeLeft.ended || (auction.status !== 'active' && auction.status !== 'live');
  const isUrgent = !ended && timeLeft.h === 0 && timeLeft.m < 10;

  const rarityGradients: Record<string, string> = {
    'Unique':     'linear-gradient(135deg,#f59e0b,#ef4444)',
    'Super Rare': 'linear-gradient(135deg,#f472b6,#a855f7)',
    'Rare':       'linear-gradient(135deg,#a855f7,#6366f1)',
  };
  const gradient = rarityGradients[auction.product?.rarity || ''] || 'linear-gradient(135deg,#e9d5ff,#c4b5fd)';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-3xl border border-gray-100 overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
      style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}
    >
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden bg-gray-50 img-zoom">
        {auction.product?.imageUrl || auction.heroImage ? (
          <img
            src={auction.product?.imageUrl || auction.heroImage}
            alt={auction.product?.name || auction.title}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Gavel className="w-12 h-12 text-gray-200" />
          </div>
        )}

        {/* Timer badge */}
        <div
          className={cn(
            'absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold backdrop-blur-sm',
            ended
              ? 'bg-black/50 text-white/70'
              : isUrgent
                ? 'bg-red-500/90 text-white animate-pulse-glow'
                : 'bg-black/50 text-white'
          )}
        >
          <Clock className="w-3 h-3" />
          <span className="countdown">
            {ended
              ? 'Ended'
              : `${timeLeft.h > 0 ? `${timeLeft.h}h ` : ''}${String(timeLeft.m).padStart(2, '0')}m ${String(timeLeft.s).padStart(2, '0')}s`
            }
          </span>
        </div>

        {/* Rarity badge */}
        {auction.product?.rarity && (
          <div
            className="absolute top-3 right-3 px-3 py-1.5 rounded-full text-xs font-bold text-white shadow-sm"
            style={{ background: gradient }}
          >
            {auction.product.rarity}
          </div>
        )}

        {/* Bid count toggle */}
        <button
          onClick={() => setShowBids(v => !v)}
          className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-white/95 backdrop-blur-sm border border-gray-100 px-3 py-1.5 rounded-full text-xs font-semibold text-gray-700 hover:bg-white transition-colors shadow-sm"
        >
          <Users className="w-3 h-3" />
          {auction.bidCount} bids
          {showBids ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {/* Bid history */}
      <AnimatePresence>
        {showBids && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 max-h-40 overflow-y-auto space-y-1.5">
              {bids.length === 0 ? (
                <p className="text-xs text-gray-400 font-medium text-center py-2">No bids yet — be first!</p>
              ) : bids.slice(0, 10).map((bid, i) => (
                <div key={bid.id} className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-2">
                    {i === 0 && <Trophy className="w-3 h-3 text-amber-500" />}
                    <span className="font-semibold text-gray-700 truncate max-w-[120px]">
                      {(bid as Bid & { bidderName?: string }).bidderName || 'Anonymous'}
                    </span>
                  </div>
                  <span className="font-bold text-gray-900">R{bid.amount}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Details */}
      <div className="p-4 space-y-3.5">
        <div>
          <h3 className="font-bold text-sm text-gray-900 truncate">
            {auction.product?.name || auction.product?.title || auction.title || `Auction #${auction.id.slice(-6)}`}
          </h3>
          <p className="text-xs text-gray-400 font-medium mt-0.5">{auction.product?.category}</p>
        </div>

        {/* Current bid display */}
        <div
          className="flex items-center justify-between px-4 py-3 rounded-2xl"
          style={{ background: 'linear-gradient(135deg,#faf5ff,#f5f3ff)' }}
        >
          <div>
            <p className="section-label mb-0.5">Current Bid</p>
            <p className="price text-xl gradient-text">R{auction.currentBid}</p>
          </div>
          <div className="text-right">
            <p className="section-label mb-0.5">Min. Next</p>
            <p className="text-sm font-bold text-gray-700">R{auction.currentBid + 1}</p>
          </div>
        </div>

        {/* Bid input */}
        {!ended ? (
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-sm">R</span>
              <input
                type="number"
                value={bidValue || ''}
                onChange={e => setBidValue(Number(e.target.value))}
                placeholder={String(auction.currentBid + 1)}
                className="w-full pl-7 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-800 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
                min={auction.currentBid + 1}
              />
            </div>
            <button
              onClick={onBid}
              disabled={isBidding || !bidValue || bidValue <= auction.currentBid}
              className="btn-primary px-4 py-2.5 text-sm disabled:opacity-40 flex-shrink-0"
            >
              {isBidding ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                  className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                />
              ) : 'Bid'}
            </button>
          </div>
        ) : (
          <div className="text-center py-2.5 rounded-xl bg-gray-50 border border-gray-100">
            <p className="text-xs font-semibold text-gray-500">Auction ended</p>
            {bids.length > 0 && (
              <p className="text-xs text-gray-400 mt-0.5">
                Won at R{bids[0]?.amount}
              </p>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
