import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { Clock3, Gavel, Radio, ShieldCheck, Trophy, Wallet } from 'lucide-react';
import { db } from '../../firebase';
import { closeAuction, placeBid, subscribeToBids } from '../../services/auctionService';
import { useSession } from '../../hooks/useSession';
import { auctionStatusLabel, currency, formatCountdown } from '../../lib/quirkify';
import type { Auction, Bid, LiveSession } from '../../types';

export default function LiveStreamRoom() {
  const { sessionId = '' } = useParams();
  const { isAdmin, isAuthenticated } = useSession();
  const [session, setSession] = useState<LiveSession | null>(null);
  const [auction, setAuction] = useState<Auction | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [bidAmount, setBidAmount] = useState('');
  const [sessionQueue, setSessionQueue] = useState<Auction[]>([]);
  const [settlementNotice, setSettlementNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let active = true;

    async function load() {
      setError(null);
      try {
        const sessionSnap = await getDoc(doc(db, 'liveSessions', sessionId));
        if (!sessionSnap.exists()) {
          if (active) setError('Live session not found.');
          return;
        }

        const sessionData = { id: sessionSnap.id, ...sessionSnap.data() } as LiveSession;
        if (!active) return;
        setSession(sessionData);

        if (sessionData.currentAuctionId) {
          const auctionSnap = await getDoc(doc(db, 'auctions', sessionData.currentAuctionId));
          if (auctionSnap.exists() && active) {
            setAuction({ id: auctionSnap.id, ...auctionSnap.data() } as Auction);
          }
        }

        const queuedIds = (sessionData.auctionQueue || [])
          .filter((auctionId) => auctionId && auctionId !== sessionData.currentAuctionId)
          .slice(0, 4);
        if (!queuedIds.length) {
          if (active) setSessionQueue([]);
          return;
        }

        const queuedSnapshots = await Promise.all(queuedIds.map((auctionId) => getDoc(doc(db, 'auctions', auctionId))));
        if (!active) return;
        setSessionQueue(
          queuedSnapshots
            .filter((snapshot) => snapshot.exists())
            .map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }) as Auction),
        );
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : 'Failed to load live session');
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [sessionId]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!auction?.id) return;
    return subscribeToBids(auction.id, (nextBids) => {
      setBids(nextBids);
      setAuction((current) => {
        if (!current) return current;
        const highestBid = nextBids[0]?.amount;
        if (!highestBid || highestBid <= current.currentBid) return current;
        return {
          ...current,
          currentBid: highestBid,
          bidCount: Math.max(current.bidCount, nextBids.length),
        };
      });
    });
  }, [auction?.id]);

  const minimumBid = useMemo(() => {
    if (!auction) return 0;
    return Math.max(auction.startPrice, auction.currentBid) + auction.increment;
  }, [auction]);

  const nextBidOptions = useMemo(() => {
    if (!auction) return [];
    return [minimumBid, minimumBid + auction.increment, minimumBid + auction.increment * 2];
  }, [auction, minimumBid]);

  async function handleBid() {
    if (!auction) return;
    setError(null);
    const result = await placeBid(auction.id, Number(bidAmount));
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setBidAmount('');
  }

  async function handleClose() {
    if (!auction) return;
    setClosing(true);
    setError(null);
    setSettlementNotice(null);
    try {
      const result = await closeAuction(auction.id);
      setAuction((current) => current ? { ...current, status: 'closed', winnerOrderId: result.orderId || null } : current);
      setSettlementNotice(
        result.settled
          ? `Auction settled successfully. Order ${result.orderId} created and wallet capture completed.`
          : result.reason === 'no_valid_bids'
            ? 'Auction closed without a valid bid.'
            : `Auction closed. Order ${result.orderId || 'created'} is awaiting payment follow-up.`,
      );
    } catch (closeError) {
      setError(closeError instanceof Error ? closeError.message : 'Failed to close auction');
    } finally {
      setClosing(false);
    }
  }

  if (error && !session) {
    return <div className="px-4 py-12 text-white">{error}</div>;
  }

  if (!session) {
    return <div className="px-4 py-12 text-white">Loading live room…</div>;
  }

  return (
    <section className="min-h-[calc(100vh-80px)] bg-[linear-gradient(180deg,#090d14,#101823_38%,#0d1420_100%)] px-4 py-10 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Current bid', value: currency(auction?.currentBid || 0), icon: Gavel },
            { label: 'Bid count', value: String(auction?.bidCount || bids.length), icon: Trophy },
            { label: 'Time remaining', value: auction ? formatCountdown(auction.endsAt, now) : 'Awaiting lot', icon: Clock3 },
            { label: 'Wallet rule', value: 'Preloaded credit', icon: Wallet },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] uppercase tracking-[0.35em] text-white/55">{card.label}</p>
                  <Icon className="h-4 w-4 text-[#f6c971]" />
                </div>
                <p className="mt-6 text-2xl font-black">{card.value}</p>
              </div>
            );
          })}
        </div>

        {settlementNotice ? (
          <div className="rounded-[1.75rem] border border-emerald-400/25 bg-emerald-400/10 px-5 py-4 text-sm text-emerald-100">
            {settlementNotice}
          </div>
        ) : null}
        {error ? (
          <div className="rounded-[1.75rem] border border-red-400/25 bg-red-400/10 px-5 py-4 text-sm text-red-100">
            {error}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="space-y-6">
            <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/5">
              <div className="grid gap-6 p-8 lg:grid-cols-[1.05fr_0.95fr]">
                <div>
                  <div className="flex items-center gap-2 text-[#9fd3c7]">
                    <Radio className="h-4 w-4" />
                    <p className="text-[11px] uppercase tracking-[0.35em]">Live auction room</p>
                  </div>
                  <h1 className="mt-4 text-5xl font-black">{session.title}</h1>
                  <p className="mt-4 max-w-2xl text-white/65">
                    {session.spotlightMessage || 'Structured premium bidding with visible trust signals, live momentum, and clean operator controls.'}
                  </p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <div className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-white/70">
                      Session status: {session.status}
                    </div>
                    <div className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-white/70">
                      Queue size: {sessionQueue.length + (auction ? 1 : 0)} lots
                    </div>
                  </div>
                </div>

                <div className="rounded-[1.75rem] border border-white/10 bg-black/15 p-5">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-[#f6c971]" />
                    <p className="text-[11px] uppercase tracking-[0.28em] text-white/60">Settlement guardrails</p>
                  </div>
                  <div className="mt-4 space-y-4 text-sm text-white/75">
                    <p>Winning bidders are settled against wallet balance first, with follow-up payment only if the wallet does not fully cover the lot.</p>
                    <p>Bid ladder, order creation, and closure reconcile into the same commerce records used by admin operations.</p>
                    <p>Operators can close the lot here and continue fulfilment from the admin commerce surface.</p>
                  </div>
                </div>
              </div>

              {auction ? (
                <div className="grid gap-6 border-t border-white/10 bg-black/10 p-8 lg:grid-cols-[0.95fr_1.05fr]">
                  <div className="overflow-hidden rounded-[1.75rem] bg-[#1b2533]">
                    {auction.heroImage ? (
                      <img src={auction.heroImage} alt={auction.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid min-h-[320px] place-items-center text-sm text-white/45">No lot image available</div>
                    )}
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.25em] text-[#9fd3c7]">Current lot</p>
                        <h2 className="mt-3 text-3xl font-black">{auction.title}</h2>
                      </div>
                      <div className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-white/70">
                        {auctionStatusLabel(auction.status)}
                      </div>
                    </div>

                    <div className="mt-6 grid gap-4 md:grid-cols-3">
                      <div className="rounded-2xl bg-white/5 p-4">
                        <p className="text-xs uppercase tracking-[0.25em] text-white/50">Current bid</p>
                        <p className="mt-3 text-2xl font-black">{currency(auction.currentBid)}</p>
                      </div>
                      <div className="rounded-2xl bg-white/5 p-4">
                        <p className="text-xs uppercase tracking-[0.25em] text-white/50">Minimum next bid</p>
                        <p className="mt-3 text-2xl font-black">{currency(minimumBid)}</p>
                      </div>
                      <div className="rounded-2xl bg-white/5 p-4">
                        <p className="text-xs uppercase tracking-[0.25em] text-white/50">Ends</p>
                        <p className="mt-3 text-lg font-black">
                          {new Date(auction.endsAt).toLocaleString('en-ZA', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
                        </p>
                      </div>
                    </div>

                    {auction.status === 'live' || auction.status === 'active' ? (
                      isAuthenticated ? (
                        <div className="mt-6">
                          <div className="mb-3 flex flex-wrap gap-2">
                            {nextBidOptions.map((amount) => (
                              <button
                                key={amount}
                                onClick={() => setBidAmount(String(amount))}
                                className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-bold text-white"
                              >
                                {currency(amount)}
                              </button>
                            ))}
                          </div>
                          <div className="flex flex-col gap-3 md:flex-row">
                            <input
                              value={bidAmount}
                              onChange={(event) => setBidAmount(event.target.value)}
                              className="input bg-white/5 text-white"
                              placeholder={`Min ${currency(minimumBid)}`}
                            />
                            <button
                              onClick={() => void handleBid()}
                              className="rounded-full bg-[#f6c971] px-4 py-2 text-sm font-bold text-[#10151e]"
                            >
                              Place bid
                            </button>
                            {isAdmin ? (
                              <button
                                onClick={() => void handleClose()}
                                disabled={closing}
                                className="rounded-full border border-white/10 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                              >
                                {closing ? 'Closing...' : 'Close lot'}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ) : (
                        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
                          Sign in to bid. Your wallet balance will be checked before settlement.
                        </div>
                      )
                    ) : (
                      <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
                        This lot is no longer taking bids.
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="border-t border-white/10 p-8 text-sm text-white/55">No current auction is queued for this live session yet.</div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-8">
              <p className="text-[11px] uppercase tracking-[0.35em] text-[#9fd3c7]">Bid ladder</p>
              <div className="mt-5 space-y-3">
                {bids.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 p-5 text-sm text-white/55">No bids yet.</div>
                ) : bids.map((bid, index) => (
                  <div key={bid.id} className="flex items-center justify-between rounded-2xl bg-black/15 px-4 py-3 text-sm">
                    <div>
                      <p className="font-bold text-white">{bid.bidderName}</p>
                      <p className="text-xs uppercase tracking-[0.25em] text-white/45">{index === 0 ? 'Highest bid' : 'Bid recorded'}</p>
                    </div>
                    <span className="font-black">{currency(bid.amount)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-8">
              <p className="text-[11px] uppercase tracking-[0.35em] text-[#f6c971]">Queue</p>
              <div className="mt-5 space-y-3">
                {sessionQueue.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 p-5 text-sm text-white/55">No queued lots loaded yet.</div>
                ) : sessionQueue.map((queuedAuction) => (
                  <div key={queuedAuction.id} className="rounded-2xl bg-black/15 px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-white">{queuedAuction.title}</p>
                        <p className="mt-1 text-sm text-white/60">
                          Starts {new Date(queuedAuction.startsAt).toLocaleString('en-ZA', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
                        </p>
                      </div>
                      <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.25em] text-white/60">
                        {auctionStatusLabel(queuedAuction.status)}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-sm text-white/65">
                      <span>Opening bid</span>
                      <span className="font-black text-white">{currency(queuedAuction.startPrice)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
