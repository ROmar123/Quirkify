import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Gavel, Radio, TimerReset, Wallet } from 'lucide-react';
import { listLiveSessions, placeBid, subscribeToAuctions } from '../../services/auctionService';
import { auctionStatusLabel, currency, formatCountdown, formatDate } from '../../lib/quirkify';
import { useSession } from '../../hooks/useSession';
import type { Auction, LiveSession } from '../../types';

export default function AuctionList() {
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [bidInputs, setBidInputs] = useState<Record<string, string>>({});
  const [busyAuctionId, setBusyAuctionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { isAuthenticated } = useSession();

  useEffect(
    () =>
      subscribeToAuctions(setAuctions, (message) => {
        setError(`Live auction data is temporarily unavailable. ${message}`);
      }),
    [],
  );

  useEffect(() => {
    let active = true;
    void listLiveSessions()
      .then((rows) => {
        if (active) setSessions(rows);
      })
      .catch(() => {
        if (active) setSessions([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const grouped = useMemo(
    () => ({
      live: auctions.filter((item) => item.status === 'live' || item.status === 'active'),
      scheduled: auctions.filter((item) => item.status === 'scheduled'),
      closed: auctions.filter((item) => item.status === 'closed' || item.status === 'ended' || item.status === 'completed').slice(0, 6),
    }),
    [auctions],
  );

  const summary = useMemo(
    () => ({
      live: grouped.live.length,
      scheduled: grouped.scheduled.length,
      totalBidCount: grouped.live.reduce((sum, auction) => sum + auction.bidCount, 0),
      liveRoomCount: sessions.filter((session) => session.status === 'live').length,
    }),
    [grouped.live, grouped.scheduled, sessions],
  );

  return (
    <section className="bg-[linear-gradient(180deg,#091019,#101823_28%,#efe8dc_28%,#efe8dc)] px-4 py-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="text-white">
            <p className="text-[11px] uppercase tracking-[0.35em] text-[#9fd3c7]">Customer View</p>
            <h1 className="mt-4 text-5xl font-black leading-[0.95]">Auctions, live rooms, and premium lot discovery</h1>
            <p className="mt-4 max-w-2xl text-white/65">
              Scheduled lots, active bidding, live-session entry points, and closed outcomes all reconcile back to inventory and order records.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { label: 'Live lots', value: String(summary.live), icon: Radio },
              { label: 'Scheduled drops', value: String(summary.scheduled), icon: TimerReset },
              { label: 'Live room count', value: String(summary.liveRoomCount), icon: Gavel },
              { label: 'Current bid volume', value: String(summary.totalBidCount), icon: Wallet },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="rounded-[1.6rem] border border-white/10 bg-white/6 p-5 text-white">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] uppercase tracking-[0.25em] text-white/55">{item.label}</p>
                    <Icon className="h-4 w-4 text-[#f6c971]" />
                  </div>
                  <p className="mt-5 text-3xl font-black">{item.value}</p>
                </div>
              );
            })}
          </div>
        </div>
        {error ? (
          <div className="mb-6 rounded-[1.5rem] border border-red-300/20 bg-red-500/10 px-5 py-4 text-sm text-red-100">
            {error}
          </div>
        ) : null}

        <div className="space-y-10">
          {([
            ['Live now', grouped.live, Radio],
            ['Scheduled', grouped.scheduled, TimerReset],
            ['Recently closed', grouped.closed, Gavel],
          ] as const).map(([title, rows, Icon]) => (
            <section key={title}>
              <div className="mb-4 flex items-center gap-3">
                <Icon className="h-5 w-5 text-[#725d34]" />
                <h2 className="text-2xl font-black">{title}</h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {rows.length === 0 ? (
                  <div className="rounded-[1.5rem] border border-dashed border-black/10 bg-white p-6 text-sm text-[#10151e]/60">
                    No {title.toLowerCase()} auctions yet.
                  </div>
                ) : rows.map((auction) => {
                  const liveSession = sessions.find((session) => session.currentAuctionId === auction.id);
                  const minimumBid = Math.max(auction.startPrice, auction.currentBid) + auction.increment;

                  return (
                    <article key={auction.id} className="rounded-[1.75rem] border border-black/8 bg-white p-5 shadow-[0_10px_40px_rgba(15,21,30,0.08)]">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.25em] text-[#725d34]">{auctionStatusLabel(auction.status)}</p>
                          <h3 className="mt-2 text-2xl font-black">{auction.title}</h3>
                        </div>
                        <span className="rounded-full bg-[#f8f4ec] px-3 py-1 text-xs font-bold text-[#10151e]">
                          {auction.status === 'scheduled' ? formatCountdown(auction.startsAt) : formatCountdown(auction.endsAt)}
                        </span>
                      </div>

                      <div className="mt-4 grid gap-3 rounded-[1.4rem] bg-[#f8f4ec] p-4 text-sm text-[#10151e]/68">
                        <div className="flex items-center justify-between gap-3">
                          <span>Starts</span>
                          <span className="font-bold text-[#10151e]">{formatDate(auction.startsAt)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span>Ends</span>
                          <span className="font-bold text-[#10151e]">{formatDate(auction.endsAt)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span>Current bid</span>
                          <span className="font-black text-[#10151e]">{currency(auction.currentBid)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span>Bid count</span>
                          <span className="font-black text-[#10151e]">{auction.bidCount}</span>
                        </div>
                      </div>

                      {liveSession ? (
                        <Link
                          to={`/live/${liveSession.id}`}
                          className="mt-4 flex items-center justify-between rounded-[1.35rem] bg-[#10151e] px-4 py-3 text-sm font-bold text-white"
                        >
                          <span>Join live room</span>
                          <span className="text-[#f6c971]">{liveSession.title}</span>
                        </Link>
                      ) : null}

                      {auction.status === 'live' || auction.status === 'active' ? (
                        <div className="mt-5">
                          {isAuthenticated ? (
                            <>
                              <div className="mb-3 flex flex-wrap gap-2">
                                {[minimumBid, minimumBid + auction.increment, minimumBid + auction.increment * 2].map((amount) => (
                                  <button
                                    key={amount}
                                    onClick={() => setBidInputs((current) => ({ ...current, [auction.id]: String(amount) }))}
                                    className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-bold text-[#10151e]"
                                  >
                                    {currency(amount)}
                                  </button>
                                ))}
                              </div>
                              <div className="flex gap-2">
                                <input
                                  value={bidInputs[auction.id] || ''}
                                  onChange={(e) => setBidInputs((current) => ({ ...current, [auction.id]: e.target.value }))}
                                  placeholder={`Min ${currency(minimumBid)}`}
                                  className="input bg-[#f8f4ec]"
                                />
                                <button
                                  onClick={async () => {
                                    setBusyAuctionId(auction.id);
                                    setError(null);
                                    const amount = Number(bidInputs[auction.id] || 0);
                                    try {
                                      const result = await placeBid(auction.id, amount);
                                      if (result.error) {
                                        setError(result.error.message);
                                      } else {
                                        setBidInputs((current) => ({ ...current, [auction.id]: '' }));
                                      }
                                    } finally {
                                      setBusyAuctionId(null);
                                    }
                                  }}
                                  disabled={busyAuctionId === auction.id}
                                  className="rounded-full bg-[#10151e] px-4 py-2 text-sm font-bold text-white"
                                >
                                  {busyAuctionId === auction.id ? 'Bidding...' : 'Place bid'}
                                </button>
                              </div>
                              <p className="mt-3 text-xs uppercase tracking-[0.22em] text-[#10151e]/45">
                                Wallet-backed settlement applies to winning bids.
                              </p>
                            </>
                          ) : (
                            <Link to="/auth?next=/auctions" className="inline-flex rounded-full bg-[#10151e] px-4 py-2 text-sm font-bold text-white">
                              Sign in to bid
                            </Link>
                          )}
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </section>
  );
}
