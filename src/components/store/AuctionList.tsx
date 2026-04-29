import { useState, useEffect, useRef } from 'react';
import { Auction, Bid } from '../../types';
import { subscribeToAuctions, placeBid, subscribeToBids, closeAuction } from '../../services/auctionService';
import { motion, AnimatePresence } from 'motion/react';
import {
  Clock, Gavel, AlertCircle, CheckCircle2, Trophy,
  Flame, ChevronDown, ChevronUp, Users, Zap,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useNavigate } from 'react-router-dom';
import { auth } from '../../firebase';

function useCountdown(endTime: string) {
  const [t, setT] = useState({ h: 0, m: 0, s: 0, ended: false, total: 0 });
  useEffect(() => {
    const tick = () => {
      const dist = new Date(endTime).getTime() - Date.now();
      if (dist <= 0) { setT({ h: 0, m: 0, s: 0, ended: true, total: 0 }); return; }
      setT({
        h: Math.floor(dist / 3600000),
        m: Math.floor((dist % 3600000) / 60000),
        s: Math.floor((dist % 60000) / 1000),
        ended: false,
        total: dist,
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endTime]);
  return t;
}

function TimeUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="bg-gray-900/80 backdrop-blur-sm rounded-lg px-2.5 py-1.5 min-w-[40px] text-center">
        <span className="text-white font-black text-lg leading-none tabular-nums countdown">
          {String(value).padStart(2, '0')}
        </span>
      </div>
      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-1">{label}</span>
    </div>
  );
}

function AuctionCard({
  auction, onBid, bidValue, setBidValue, isBidding,
}: {
  auction: Auction;
  onBid: () => void;
  bidValue: number;
  setBidValue: (v: number) => void;
  isBidding: boolean;
}) {
  const [bids, setBids] = useState<Bid[]>([]);
  const [showBids, setShowBids] = useState(false);
  const t = useCountdown(auction.endTime || auction.endsAt || new Date().toISOString());
  const ended = t.ended || (auction.status !== 'active' && auction.status !== 'live');
  const isUrgent = !ended && t.h === 0 && t.m < 10;
  const isCritical = !ended && t.h === 0 && t.m < 3;

  useEffect(() => {
    return subscribeToBids(auction.id, setBids);
  }, [auction.id]);

  // Auto-close when timer hits zero
  useEffect(() => {
    if (t.ended && (auction.status === 'active' || auction.status === 'live')) {
      closeAuction(auction.id);
    }
  }, [t.ended, auction.id, auction.status]);

  const rarityGradients: Record<string, string> = {
    'Unique':     'linear-gradient(135deg,#f59e0b,#ef4444)',
    'Super Rare': 'linear-gradient(135deg,#f472b6,#a855f7)',
    'Rare':       'linear-gradient(135deg,#a855f7,#6366f1)',
    'Limited':    'linear-gradient(135deg,#06b6d4,#6366f1)',
  };
  const rarityGrad = rarityGradients[auction.product?.rarity || ''] || null;

  const title = auction.product?.name || auction.product?.title || auction.title || `Lot #${auction.id.slice(-6).toUpperCase()}`;
  const img = auction.product?.imageUrl || auction.heroImage;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'group bg-white rounded-3xl overflow-hidden border transition-all duration-300 flex flex-col',
        ended ? 'border-gray-100 opacity-75' : 'border-gray-100 hover:border-purple-100 hover:shadow-xl hover:-translate-y-1',
        isCritical && !ended && 'border-red-200 shadow-[0_0_0_1px_rgba(239,68,68,0.2)]'
      )}
      style={{ boxShadow: ended ? 'none' : '0 4px 20px rgba(0,0,0,0.06)' }}
    >
      {/* Image */}
      <div className="relative overflow-hidden bg-gray-50 aspect-[4/3]">
        {img ? (
          <img
            src={img}
            alt={title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
            <Gavel className="w-12 h-12 text-gray-200" />
          </div>
        )}

        {/* Gradient overlay at bottom */}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/50 to-transparent" />

        {/* Rarity badge */}
        {rarityGrad && (
          <div
            className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-black text-white shadow-md"
            style={{ background: rarityGrad }}
          >
            {auction.product?.rarity}
          </div>
        )}

        {/* Live / ended chip */}
        <div className="absolute top-3 right-3">
          {ended ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-black/60 backdrop-blur-sm rounded-full">
              <Trophy className="w-3 h-3 text-amber-400" />
              <span className="text-[10px] font-bold text-white/90">Ended</span>
            </div>
          ) : (
            <div className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-full backdrop-blur-sm',
              isCritical ? 'bg-red-500/90' : isUrgent ? 'bg-orange-500/90' : 'bg-black/50'
            )}>
              {!ended && <span className="live-dot" style={{ width: 5, height: 5 }} />}
              <span className="text-[10px] font-bold text-white">Live</span>
            </div>
          )}
        </div>

        {/* Countdown timer — pinned at bottom of image */}
        {!ended && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-end gap-1.5">
            {t.h > 0 && <TimeUnit value={t.h} label="hr" />}
            <TimeUnit value={t.m} label="min" />
            <TimeUnit value={t.s} label="sec" />
          </div>
        )}
      </div>

      {/* Bid history accordion */}
      <AnimatePresence>
        {showBids && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-gray-50 border-b border-gray-100"
          >
            <div className="max-h-36 overflow-y-auto px-4 py-3 space-y-2">
              {bids.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-2 font-medium">No bids yet — be first!</p>
              ) : bids.slice(0, 8).map((bid, i) => (
                <div key={bid.id} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    {i === 0 && <Trophy className="w-3 h-3 text-amber-400 flex-shrink-0" />}
                    <span className={cn('font-semibold truncate max-w-[120px]', i === 0 ? 'text-gray-900' : 'text-gray-500')}>
                      {(bid as Bid & { bidderName?: string }).bidderName || 'Anonymous'}
                    </span>
                  </div>
                  <span className={cn('font-black tabular-nums', i === 0 ? 'text-purple-600' : 'text-gray-400')}>
                    R{bid.amount.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Details */}
      <div className="flex flex-col flex-1 p-4 gap-3.5">
        {/* Title row */}
        <div>
          <h3 className="font-bold text-sm text-gray-900 leading-snug line-clamp-1">{title}</h3>
          {auction.product?.category && (
            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-widest mt-0.5">
              {auction.product.category}
            </p>
          )}
        </div>

        {/* Current bid */}
        <div
          className="rounded-2xl px-4 py-3 flex items-center justify-between"
          style={{ background: 'linear-gradient(135deg, #faf5ff 0%, #f5f3ff 100%)' }}
        >
          <div>
            <p className="section-label mb-0.5">Current bid</p>
            <p className="text-xl font-black text-purple-700 tabular-nums tracking-tight">
              R{auction.currentBid.toLocaleString()}
            </p>
          </div>
          <div className="text-right">
            <p className="section-label mb-0.5">Min. next</p>
            <p className="text-sm font-bold text-gray-500 tabular-nums">
              R{(auction.currentBid + (auction.increment || 1)).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Bid input or ended state */}
        {!ended ? (
          <div className="flex gap-2 mt-auto">
            <div className="relative flex-1">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm pointer-events-none">R</span>
              <input
                type="number"
                value={bidValue || ''}
                onChange={e => setBidValue(Number(e.target.value))}
                placeholder={String(auction.currentBid + (auction.increment || 1))}
                min={auction.currentBid + 1}
                className="w-full pl-8 pr-3 py-2.5 bg-gray-50 border-2 border-gray-200 rounded-xl text-sm font-bold text-gray-900 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
              />
            </div>
            <button
              onClick={onBid}
              disabled={isBidding || !bidValue || bidValue <= auction.currentBid}
              className={cn(
                'flex-shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all duration-200 disabled:opacity-40',
                isCritical
                  ? 'bg-red-500 hover:bg-red-600 shadow-[0_4px_12px_rgba(239,68,68,0.4)]'
                  : 'btn-primary'
              )}
            >
              {isBidding ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}
                  className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                />
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5" />
                  Bid
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="mt-auto rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 text-center">
            <div className="flex items-center justify-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              <p className="text-sm font-bold text-gray-700">
                {bids.length > 0 ? `Won at R${bids[0]?.amount.toLocaleString()}` : 'Auction ended'}
              </p>
            </div>
          </div>
        )}

        {/* Bid count toggle */}
        <button
          onClick={() => setShowBids(v => !v)}
          className="flex items-center justify-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-gray-600 transition-colors mt-1"
        >
          <Users className="w-3.5 h-3.5" />
          {auction.bidCount} bid{auction.bidCount !== 1 ? 's' : ''}
          {showBids ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>
    </motion.div>
  );
}

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
    const tid = window.setTimeout(() => setLoading(false), 5000);
    const unsub = subscribeToAuctions(
      (data) => { window.clearTimeout(tid); setAuctions(data); setLoading(false); },
      (msg) => { window.clearTimeout(tid); setAuctions([]); setError(msg); setLoading(false); }
    );
    return () => { window.clearTimeout(tid); unsub(); };
  }, []);

  const handleBid = async (auctionId: string, currentBid: number) => {
    if (!auth.currentUser) { navigate('/auth?next=%2Fauctions'); return; }
    const amount = bidAmount[auctionId];
    if (!amount || amount <= currentBid) {
      setError(`Bid must exceed R${currentBid.toLocaleString()}`);
      setTimeout(() => setError(null), 3000);
      return;
    }
    setBidding(b => ({ ...b, [auctionId]: true }));
    setError(null);
    try {
      await placeBid(auctionId, amount);
      gavelAudio.current?.play().catch(() => {});
      setSuccess(`Bid of R${amount.toLocaleString()} placed!`);
      setBidAmount(p => ({ ...p, [auctionId]: 0 }));
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to place bid');
      setTimeout(() => setError(null), 3000);
    } finally {
      setBidding(b => ({ ...b, [auctionId]: false }));
    }
  };

  const active = auctions.filter(a => a.status === 'active' || a.status === 'live');
  const ended = auctions.filter(a => a.status !== 'active' && a.status !== 'live');

  return (
    <div className="hero-bg min-h-screen">
      <div className="max-w-7xl mx-auto px-4 pt-8 pb-24">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#f472b6,#a855f7)', boxShadow: '0 4px 16px rgba(168,85,247,0.3)' }}
            >
              <Gavel className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-extrabold text-gray-900" style={{ fontFamily: 'Nunito, sans-serif' }}>
                  Live Auctions
                </h1>
                {active.length > 0 && (
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold text-white"
                    style={{ background: 'linear-gradient(135deg,#ef4444,#f97316)' }}>
                    <span className="live-dot" style={{ width: 6, height: 6 }} />
                    {active.length} live
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-400 mt-0.5">Bid on exclusive drops — highest bid wins</p>
            </div>
          </div>

          {/* Stats bar */}
          {!loading && auctions.length > 0 && (
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-100 rounded-full shadow-sm">
                <Flame className="w-3.5 h-3.5 text-orange-500" />
                <span className="text-xs font-bold text-gray-700">{active.length} active</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-100 rounded-full shadow-sm">
                <Trophy className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-xs font-bold text-gray-500">{ended.length} ended</span>
              </div>
            </div>
          )}
        </motion.div>

        {/* Toasts */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-4">
              <div className="toast toast-error">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            </motion.div>
          )}
          {success && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-4">
              <div className="toast toast-success">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                {success}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-3xl overflow-hidden border border-gray-100">
                <div className="skeleton aspect-[4/3]" style={{ borderRadius: 0 }} />
                <div className="p-4 space-y-3">
                  <div className="skeleton h-4 w-3/4 rounded-lg" />
                  <div className="skeleton h-16 rounded-2xl" />
                  <div className="skeleton h-10 rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && auctions.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-32 bg-white rounded-3xl border border-gray-100 text-center"
          >
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: 'linear-gradient(135deg,#faf5ff,#f5f3ff)' }}>
              <Gavel className="w-8 h-8 text-purple-300" />
            </div>
            <p className="text-gray-700 font-bold text-base">No auctions right now</p>
            <p className="text-gray-400 text-sm mt-1">Check back soon for the next drop</p>
          </motion.div>
        )}

        {/* Active lots */}
        {!loading && active.length > 0 && (
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <Flame className="w-4 h-4 text-orange-500" />
              <h2 className="text-xs font-black uppercase tracking-widest text-gray-600">Active bidding</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {active.map(a => (
                <AuctionCard
                  key={a.id}
                  auction={a}
                  onBid={() => handleBid(a.id, a.currentBid)}
                  bidValue={bidAmount[a.id] || 0}
                  setBidValue={val => setBidAmount(p => ({ ...p, [a.id]: val }))}
                  isBidding={bidding[a.id] || false}
                />
              ))}
            </div>
          </div>
        )}

        {/* Ended lots */}
        {!loading && ended.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="w-4 h-4 text-gray-400" />
              <h2 className="text-xs font-black uppercase tracking-widest text-gray-400">Recently ended</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {ended.map(a => (
                <AuctionCard
                  key={a.id}
                  auction={a}
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
    </div>
  );
}
