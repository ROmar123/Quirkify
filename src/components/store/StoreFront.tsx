import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Boxes, Gavel, Radio, ShoppingBag, Sparkles, Stars, Zap } from 'lucide-react';
import { listActiveProducts, listFeaturedProducts, listPacks } from '../../services/catalogService';
import { listAuctions, listLiveSessions } from '../../services/auctionService';
import { useCart } from '../../context/CartContext';
import { useSession } from '../../hooks/useSession';
import { availableUnits, auctionStatusLabel, currency, formatCountdown, totalReservedUnits } from '../../lib/quirkify';
import type { Auction, LiveSession, Pack, Product } from '../../types';

const PUBLIC_DATA_TIMEOUT_MS = 4500;

function withTimeout<T>(promise: Promise<T>, message: string, timeoutMs = PUBLIC_DATA_TIMEOUT_MS) {
  return Promise.race<T>([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]);
}

export default function StoreFront() {
  const [products, setProducts] = useState<Product[]>([]);
  const [featured, setFeatured] = useState<Product[]>([]);
  const [packs, setPacks] = useState<Pack[]>([]);
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [sessionWarning, setSessionWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { addToCart, addPackToCart } = useCart();
  const { isAdmin } = useSession();

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);
      setSessionWarning(null);
      try {
        const [productRowsResult, featuredRowsResult, packRowsResult, sessionRowsResult, auctionRowsResult] = await Promise.allSettled([
          withTimeout(listActiveProducts(), 'Store inventory request timed out'),
          withTimeout(listFeaturedProducts(), 'Featured product request timed out'),
          withTimeout(listPacks(), 'Pack inventory request timed out'),
          withTimeout(listLiveSessions(), 'Live auction data timed out'),
          withTimeout(listAuctions(), 'Auction feed request timed out'),
        ]);

        if (!active) return;

        const productRows = productRowsResult.status === 'fulfilled' ? productRowsResult.value : [];
        const featuredRows = featuredRowsResult.status === 'fulfilled' ? featuredRowsResult.value : [];
        const packRows = packRowsResult.status === 'fulfilled' ? packRowsResult.value : [];
        const sessionRows = sessionRowsResult.status === 'fulfilled' ? sessionRowsResult.value : [];
        const auctionRows = auctionRowsResult.status === 'fulfilled' ? auctionRowsResult.value : [];

        setProducts(productRows);
        setFeatured(featuredRows.length ? featuredRows : productRows.slice(0, 6));
        setPacks(packRows);
        setSessions(sessionRows.slice(0, 3));
        setAuctions(auctionRows);

        const catalogFailure =
          productRowsResult.status === 'rejected'
            ? productRowsResult.reason
            : featuredRowsResult.status === 'rejected' && productRows.length === 0
              ? featuredRowsResult.reason
              : packRowsResult.status === 'rejected' && productRows.length === 0 && featuredRows.length === 0
                ? packRowsResult.reason
                : null;

        if (catalogFailure) {
          throw catalogFailure;
        }

        if (sessionRowsResult.status === 'rejected') {
          setSessionWarning(
            sessionRowsResult.reason instanceof Error
              ? sessionRowsResult.reason.message
              : 'Live session data is temporarily unavailable',
          );
        }
      } catch (loadError) {
        if (!active) return;
        setProducts([]);
        setFeatured([]);
        setPacks([]);
        setSessions([]);
        setAuctions([]);
        setSessionWarning(null);
        setError(loadError instanceof Error ? loadError.message : 'Failed to load storefront data');
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  const liveAuctions = useMemo(() => auctions.filter((auction) => auction.status === 'live' || auction.status === 'active').slice(0, 3), [auctions]);
  const scheduledAuctions = useMemo(() => auctions.filter((auction) => auction.status === 'scheduled').slice(0, 3), [auctions]);
  const storeReadyProducts = useMemo(
    () => products.filter((product) => availableUnits(product, 'store') > 0).slice(0, 4),
    [products],
  );
  const discoveryMetrics = useMemo(() => {
    const readyStoreUnits = products.reduce((sum, product) => sum + availableUnits(product, 'store'), 0);
    const readyAuctionLots = auctions.filter((auction) => auction.status === 'scheduled' || auction.status === 'live' || auction.status === 'active').length;
    const reservedUnits = products.reduce((sum, product) => sum + totalReservedUnits(product), 0);
    return {
      readyStoreUnits,
      readyAuctionLots,
      reservedUnits,
      activePacks: packs.filter((pack) => pack.active).length,
    };
  }, [auctions, packs, products]);

  return (
    <div className="bg-[linear-gradient(180deg,#091019,#101823_34%,#efe8dc_34%,#efe8dc_100%)] text-[#10151e]">
      <section className="px-4 pb-12 pt-10 text-white">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="text-[11px] uppercase tracking-[0.4em] text-[#f6c971]">Customer View</p>
            <h1 className="mt-4 max-w-4xl text-5xl font-black leading-[0.93] md:text-7xl">
              One marketplace for product drops, premium bidding, and pack-led discovery.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-white/68">
              Quirkify keeps storefront products, auction lots, and bundles aligned to the same stock picture so you can browse publicly and buy with confidence when you are ready.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/auctions" className="rounded-full bg-[#f6c971] px-5 py-3 text-sm font-bold text-[#10151e]">
                Explore auctions
              </Link>
              <Link to="/checkout" className="rounded-full border border-white/12 bg-white/5 px-5 py-3 text-sm font-bold text-white">
                Open checkout
              </Link>
              <Link to="/profile" className="rounded-full border border-white/12 bg-white/5 px-5 py-3 text-sm font-bold text-white">
                Your profile
              </Link>
              {isAdmin ? (
                <Link to="/admin" className="rounded-full border border-white/12 bg-white/5 px-5 py-3 text-sm font-bold text-white">
                  Open admin
                </Link>
              ) : null}
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: 'Store-ready units', value: String(discoveryMetrics.readyStoreUnits), icon: ShoppingBag },
                { label: 'Auction lots', value: String(discoveryMetrics.readyAuctionLots), icon: Gavel },
                { label: 'Pack offers', value: String(discoveryMetrics.activePacks), icon: Boxes },
                { label: 'Reserved units', value: String(discoveryMetrics.reservedUnits), icon: Zap },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="rounded-[1.6rem] border border-white/10 bg-white/6 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] uppercase tracking-[0.25em] text-white/55">{item.label}</p>
                      <Icon className="h-4 w-4 text-[#f6c971]" />
                    </div>
                    <p className="mt-5 text-3xl font-black">{item.value}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {[
              { title: 'Unified stock engine', copy: 'Store, auctions, and packs allocate from one inventory ledger.', tone: 'bg-[#f6c971] text-[#10151e]' },
              { title: 'Public-first browsing', copy: 'Customers can browse live stock and auction momentum before signing in.', tone: 'bg-white/6 text-white' },
              { title: 'Human-gated AI intake', copy: 'AI drafts listings, but approval stays with operators before anything goes live.', tone: 'bg-white/6 text-white' },
              { title: 'Campaign-led merchandising', copy: 'Growth planning surfaces stale stock, auction pressure, and pack opportunities.', tone: 'bg-[#142231] text-white' },
            ].map((item) => (
              <div key={item.title} className={`rounded-[1.75rem] border border-white/10 p-5 ${item.tone}`}>
                <p className="text-sm font-black">{item.title}</p>
                <p className={`mt-3 text-sm leading-6 ${item.title === 'Unified stock engine' ? 'text-[#10151e]/75' : 'text-white/68'}`}>
                  {item.copy}
                </p>
              </div>
            ))}
          </div>
        </div>
        {error ? (
          <div className="mx-auto mt-6 max-w-7xl rounded-[1.5rem] border border-red-300/20 bg-red-500/10 px-5 py-4 text-sm text-red-100">
            Storefront data could not be loaded from the catalogue source of truth. {error}
          </div>
        ) : null}
      </section>

      <section className="px-4 pb-12">
        <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[2rem] bg-[#10151e] p-6 text-white shadow-[0_25px_80px_rgba(0,0,0,0.35)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.35em] text-[#9fd3c7]">Live right now</p>
                <h2 className="mt-2 text-2xl font-black">Live auction sessions</h2>
              </div>
              <Link to="/auctions" className="text-sm font-bold text-[#f6c971]">See all</Link>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {sessions.length === 0 ? (
                <div className="rounded-[1.5rem] border border-dashed border-white/10 p-6 text-sm text-white/55 md:col-span-3">
                  {loading
                    ? 'Loading live session state…'
                    : sessionWarning
                      ? `Live session data is temporarily unavailable. ${sessionWarning}`
                      : 'No live session is running yet. Scheduled and live auctions still appear in the auctions feed.'}
                </div>
              ) : sessions.map((session) => (
                <Link key={session.id} to={`/live/${session.id}`} className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5 transition hover:bg-white/8">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs uppercase tracking-[0.25em] text-[#9fd3c7]">{session.status}</p>
                    <Radio className="h-4 w-4 text-[#f6c971]" />
                  </div>
                  <h3 className="mt-3 text-xl font-black">{session.title}</h3>
                  <p className="mt-2 text-sm text-white/60">{session.spotlightMessage || 'Join the live room to watch the active lot and place bids.'}</p>
                  <p className="mt-5 text-xs font-semibold uppercase tracking-[0.22em] text-white/45">Enter live room</p>
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-black/8 bg-white p-6 shadow-[0_15px_50px_rgba(15,21,30,0.08)]">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-[#725d34]" />
              <div>
                <p className="text-[11px] uppercase tracking-[0.3em] text-[#725d34]">Discovery mix</p>
                <h2 className="mt-1 text-2xl font-black">What is moving across the marketplace</h2>
              </div>
            </div>
            <div className="mt-6 space-y-4">
              {[
                {
                  title: 'Storefront pressure',
                  value: `${storeReadyProducts.length} featured products`,
                  copy: 'Approved catalogue items with immediate store availability.',
                },
                {
                  title: 'Auction momentum',
                  value: `${liveAuctions.length} live / ${scheduledAuctions.length} scheduled`,
                  copy: 'Bidding surfaces and upcoming drops are visible from the same browse flow.',
                },
                {
                  title: 'Pack-led merchandising',
                  value: `${packs.filter((pack) => pack.active).length} active bundles`,
                  copy: 'Bundles pull from linked inventory lines rather than a duplicate stock pool.',
                },
              ].map((item) => (
                <div key={item.title} className="rounded-[1.4rem] bg-[#f8f4ec] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-black text-[#10151e]">{item.title}</p>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#725d34]">{item.value}</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[#10151e]/62">{item.copy}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-14">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.35em] text-[#725d34]">Merchandised store</p>
            <h2 className="mt-2 text-3xl font-black text-[#10151e]">Featured products</h2>
          </div>
          <Link to="/auctions" className="inline-flex items-center gap-2 text-sm font-bold text-[#10151e]">
            Auction feed <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {featured.length === 0 ? (
            <div className="rounded-[1.75rem] border border-dashed border-black/10 bg-white p-8 text-sm text-[#10151e]/60 xl:col-span-4">
              {loading ? 'Loading approved store products…' : 'No approved store products are live yet. Once inventory is approved in admin, featured catalogue items will populate here automatically.'}
            </div>
          ) : (
            featured.map((product) => {
              const storeAvailable = availableUnits(product, 'store');
              return (
                <article key={product.id} className="overflow-hidden rounded-[1.75rem] border border-black/8 bg-white shadow-[0_10px_40px_rgba(15,21,30,0.08)]">
                  <Link to={`/product/${product.id}`} className="block aspect-[4/4.8] bg-[#ece5d8]">
                    {product.media?.[0]?.url ? <img src={product.media[0].url} alt={product.title} className="h-full w-full object-cover" /> : null}
                  </Link>
                  <div className="space-y-4 p-5">
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-[#f8f4ec] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#725d34]">
                        {product.category}
                      </span>
                      <span className="rounded-full bg-[#eef5f1] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#35664a]">
                        {storeAvailable > 0 ? `${storeAvailable} ready` : 'Awaiting restock'}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-lg font-black">{product.title}</h3>
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#10151e]/62">{product.description}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 rounded-[1.25rem] bg-[#f8f4ec] p-3 text-sm">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.22em] text-[#725d34]">Store price</p>
                        <p className="mt-1 font-black">{currency(product.pricing?.salePrice || 0)}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.22em] text-[#725d34]">Auction ceiling</p>
                        <p className="mt-1 font-black">{currency(product.priceRange?.max || product.pricing?.listPrice || 0)}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs text-[#10151e]/50">Reserved across channels</p>
                        <p className="text-sm font-bold text-[#10151e]">{totalReservedUnits(product)} units</p>
                      </div>
                      <button
                        onClick={() => addToCart(product)}
                        disabled={storeAvailable <= 0}
                        className="rounded-full bg-[#10151e] px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-14">
        <div className="flex items-center gap-3">
          <Gavel className="h-5 w-5 text-[#725d34]" />
          <h2 className="text-3xl font-black">Auction pulse</h2>
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {([['Live lots', liveAuctions], ['Upcoming lots', scheduledAuctions]] as const).map(([title, rows]) => (
            <div key={title} className="rounded-[1.8rem] border border-black/8 bg-white p-6 shadow-[0_12px_40px_rgba(15,21,30,0.08)]">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-2xl font-black">{title}</h3>
                <Link to="/auctions" className="text-sm font-bold text-[#725d34]">Open feed</Link>
              </div>
              <div className="mt-5 space-y-3">
                {rows.length === 0 ? (
                  <div className="rounded-[1.4rem] border border-dashed border-black/10 p-5 text-sm text-[#10151e]/55">
                    {loading ? 'Loading auction state…' : `No ${title.toLowerCase()} yet.`}
                  </div>
                ) : rows.map((auction) => (
                  <div key={auction.id} className="rounded-[1.4rem] bg-[#f8f4ec] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.22em] text-[#725d34]">{auctionStatusLabel(auction.status)}</p>
                        <p className="mt-1 text-lg font-black text-[#10151e]">{auction.title}</p>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#10151e]">
                        {title === 'Live lots' ? formatCountdown(auction.endsAt) : formatCountdown(auction.startsAt)}
                      </span>
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-3 text-sm">
                      <div>
                        <p className="text-[#10151e]/55">Current bid</p>
                        <p className="font-black text-[#10151e]">{currency(auction.currentBid)}</p>
                      </div>
                      <div>
                        <p className="text-[#10151e]/55">Bid count</p>
                        <p className="font-black text-[#10151e]">{auction.bidCount}</p>
                      </div>
                      <div>
                        <p className="text-[#10151e]/55">Entry</p>
                        <p className="font-black text-[#10151e]">{sessions.find((session) => session.currentAuctionId === auction.id) ? 'Live room' : 'Feed'}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-18">
        <div className="flex items-center gap-3">
          <Stars className="h-5 w-5 text-[#725d34]" />
          <h2 className="text-3xl font-black">Packs and bundles</h2>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {packs.length === 0 ? (
            <div className="rounded-[1.75rem] border border-dashed border-black/10 bg-white p-8 text-sm text-[#10151e]/60">
              {loading ? 'Loading pack inventory…' : 'Pack inventory is configured from admin inventory operations. Once packs are created they appear here as purchasable store items.'}
            </div>
          ) : packs.map((pack) => (
            <article key={pack.id} className="rounded-[1.75rem] border border-black/8 bg-white p-6 shadow-[0_10px_40px_rgba(15,21,30,0.08)]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.25em] text-[#725d34]">Pack</p>
                  <h3 className="mt-2 text-2xl font-black">{pack.title}</h3>
                </div>
                <Boxes className="h-6 w-6 text-[#725d34]" />
              </div>
              <p className="mt-3 text-sm leading-6 text-[#10151e]/65">{pack.description}</p>
              <div className="mt-5 rounded-[1.35rem] bg-[#f8f4ec] p-4 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[#10151e]/55">Linked inventory lines</p>
                  <p className="font-black text-[#10151e]">{pack.componentCount}</p>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="text-[#10151e]/55">Status</p>
                  <p className="font-black text-[#10151e]">{pack.active ? 'Available' : 'Draft'}</p>
                </div>
              </div>
              <div className="mt-6 flex items-center justify-between">
                <div>
                  <p className="text-lg font-black">{currency(pack.price)}</p>
                  <p className="text-xs text-[#10151e]/50">Curated bundle offer</p>
                </div>
                <button
                  onClick={() => addPackToCart(pack)}
                  disabled={!pack.active}
                  className="rounded-full bg-[#9fd3c7] px-4 py-2 text-sm font-bold text-[#10151e] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Add pack
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
