import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Gavel,
  Package,
  Radio,
  Receipt,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { useSession } from '../../hooks/useSession';
import { currency, formatDate } from '../../lib/quirkify';
import { fetchOrdersForCustomer } from '../../services/commerceService';
import { listCampaignDrafts, listFeaturedProducts } from '../../services/catalogService';
import { listAuctions, listLiveSessions } from '../../services/auctionService';
import { useCart } from '../../context/CartContext';
import type { Auction, CampaignDraft, LiveSession, Order, Product } from '../../types';

function statusTone(status: string) {
  if (status === 'paid' || status === 'confirmed' || status === 'approved' || status === 'live') return 'text-emerald-700 bg-emerald-50';
  if (status === 'pending' || status === 'pending_payment' || status === 'scheduled' || status === 'draft') return 'text-amber-700 bg-amber-50';
  return 'text-slate-700 bg-slate-100';
}

export default function ProfileHub() {
  const { profile, isAdmin } = useSession();
  const { items, total } = useCart();
  const [orders, setOrders] = useState<Order[]>([]);
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignDraft[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);

  useEffect(() => {
    if (!profile) return;

    void fetchOrdersForCustomer(profile.id).then(setOrders).catch(() => setOrders([]));
    void Promise.all([listAuctions(), listLiveSessions(), listFeaturedProducts()])
      .then(([auctionRows, sessionRows, productRows]) => {
        setAuctions(auctionRows);
        setSessions(sessionRows);
        setFeaturedProducts(productRows);
      })
      .catch(() => {
        setAuctions([]);
        setSessions([]);
        setFeaturedProducts([]);
      });

    if (isAdmin) {
      void listCampaignDrafts().then(setCampaigns).catch(() => setCampaigns([]));
    } else {
      setCampaigns([]);
    }
  }, [profile, isAdmin]);

  const activeOrders = useMemo(
    () => orders.filter((order) => !['delivered', 'cancelled', 'refunded'].includes(order.status)),
    [orders]
  );
  const activeBids = useMemo(
    () => auctions.filter((auction) => auction.highestBidderId === profile?.firebaseUid && ['live', 'scheduled'].includes(auction.status)),
    [auctions, profile?.firebaseUid]
  );
  const missionCards = useMemo(
    () => [
      {
        label: 'Wallet balance',
        value: currency(profile?.balance || 0),
        detail: 'Auction credit and store spend use one balance.',
        icon: Wallet,
      },
      {
        label: 'Open orders',
        value: String(activeOrders.length),
        detail: 'Orders still moving through payment or fulfilment.',
        icon: Receipt,
      },
      {
        label: 'Active bids',
        value: String(activeBids.length),
        detail: 'Lots where you currently hold the lead.',
        icon: Gavel,
      },
      {
        label: 'Cart exposure',
        value: currency(total),
        detail: `${items.length} lines currently staged for checkout.`,
        icon: ShoppingBag,
      },
    ],
    [activeBids.length, activeOrders.length, items.length, profile?.balance, total]
  );

  if (!profile) {
    return <div className="px-4 py-10 text-white">Loading profile...</div>;
  }

  return (
    <section className="bg-[linear-gradient(180deg,#091019,#101823_30%,#f4efe6_30%,#f4efe6)] px-4 py-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[2rem] border border-white/10 bg-white/6 p-8 text-white">
            <p className="text-[11px] uppercase tracking-[0.35em] text-[#f6c971]">Customer mission control</p>
            <div className="mt-4 flex flex-wrap items-start justify-between gap-6">
              <div>
                <h1 className="text-4xl font-black md:text-5xl">{profile.displayName}</h1>
                <p className="mt-2 text-white/65">{profile.email}</p>
                <p className="mt-4 max-w-2xl text-sm leading-6 text-white/72">
                  Orders, wallet value, active bids, curated campaigns, and catalog momentum are tracked here so you can move between browsing and buying without losing context.
                </p>
              </div>
              <div className="min-w-[220px] rounded-[1.5rem] border border-white/10 bg-black/15 p-5">
                <p className="text-[11px] uppercase tracking-[0.25em] text-[#9fd3c7]">Account trust</p>
                <div className="mt-4 space-y-3 text-sm text-white/75">
                  <div className="flex items-center justify-between">
                    <span>Level</span>
                    <span className="font-black text-white">{profile.level || 1}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Total spend</span>
                    <span className="font-black text-white">{currency(profile.totalSpent || 0)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Won auctions</span>
                    <span className="font-black text-white">{profile.auctionsWon || 0}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-black/8 bg-white p-8 shadow-[0_20px_70px_rgba(15,21,30,0.08)]">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-[#725d34]" />
              <h2 className="text-2xl font-black">Quick control</h2>
            </div>
            <div className="mt-6 grid gap-3">
              <Link to="/orders" className="flex items-center justify-between rounded-[1.25rem] bg-[#f8f4ec] px-4 py-4 text-sm font-bold text-[#10151e]">
                Review orders and delivery steps
                <ArrowRight className="h-4 w-4 text-[#725d34]" />
              </Link>
              <Link to="/auctions" className="flex items-center justify-between rounded-[1.25rem] bg-[#f8f4ec] px-4 py-4 text-sm font-bold text-[#10151e]">
                Open live and scheduled auctions
                <ArrowRight className="h-4 w-4 text-[#725d34]" />
              </Link>
              <Link to="/checkout" className="flex items-center justify-between rounded-[1.25rem] bg-[#10151e] px-4 py-4 text-sm font-bold text-white">
                Go to checkout
                <ArrowRight className="h-4 w-4 text-[#f6c971]" />
              </Link>
              {isAdmin ? (
                <Link to="/admin" className="flex items-center justify-between rounded-[1.25rem] border border-black/10 px-4 py-4 text-sm font-bold text-[#10151e]">
                  Open admin workspace
                  <ArrowRight className="h-4 w-4 text-[#725d34]" />
                </Link>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {missionCards.map(({ label, value, detail, icon: Icon }) => (
            <div key={label} className="rounded-[1.5rem] border border-black/8 bg-white p-5 shadow-[0_10px_40px_rgba(15,21,30,0.08)]">
              <Icon className="h-5 w-5 text-[#725d34]" />
              <p className="mt-4 text-[11px] uppercase tracking-[0.25em] text-[#725d34]">{label}</p>
              <p className="mt-2 text-3xl font-black">{value}</p>
              <p className="mt-2 text-sm leading-6 text-[#10151e]/60">{detail}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-6">
            <div className="rounded-[2rem] border border-black/8 bg-white p-8 shadow-[0_20px_70px_rgba(15,21,30,0.08)]">
              <div className="flex items-center gap-3">
                <Receipt className="h-5 w-5 text-[#725d34]" />
                <h2 className="text-2xl font-black">Order journey</h2>
              </div>
              <div className="mt-5 space-y-3">
                {activeOrders.length === 0 ? (
                  <div className="rounded-[1.25rem] border border-dashed border-black/10 bg-[#f8f4ec] p-5 text-sm text-[#10151e]/60">
                    No live customer orders right now. New store, pack, and auction wins will appear here once they enter payment or fulfilment.
                  </div>
                ) : (
                  activeOrders.slice(0, 3).map((order) => (
                    <div key={order.id} className="rounded-[1.25rem] bg-[#f8f4ec] p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.25em] text-[#725d34]">{order.orderNumber}</p>
                          <p className="mt-2 text-lg font-black">{currency(order.total)}</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] ${statusTone(order.status)}`}>
                          {order.status.replaceAll('_', ' ')}
                        </span>
                      </div>
                      <p className="mt-3 text-sm text-[#10151e]/60">
                        Payment: {order.paymentStatus.replaceAll('_', ' ')}. Shipping: {order.shippingStatus.replaceAll('_', ' ')}.
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-[2rem] border border-black/8 bg-white p-8 shadow-[0_20px_70px_rgba(15,21,30,0.08)]">
              <div className="flex items-center gap-3">
                <Gavel className="h-5 w-5 text-[#725d34]" />
                <h2 className="text-2xl font-black">Auction exposure</h2>
              </div>
              <div className="mt-5 space-y-3">
                {activeBids.length === 0 ? (
                  <div className="rounded-[1.25rem] border border-dashed border-black/10 bg-[#f8f4ec] p-5 text-sm text-[#10151e]/60">
                    You are not leading any live or scheduled lots right now.
                  </div>
                ) : (
                  activeBids.map((auction) => (
                    <div key={auction.id} className="rounded-[1.25rem] bg-[#f8f4ec] p-5">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-lg font-black">{auction.title}</p>
                          <p className="mt-1 text-sm text-[#10151e]/60">Ends {formatDate(auction.endsAt)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-[#10151e]">{currency(auction.currentBid)}</p>
                          <span className={`mt-2 inline-flex rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] ${statusTone(auction.status)}`}>
                            {auction.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[2rem] border border-black/8 bg-white p-8 shadow-[0_20px_70px_rgba(15,21,30,0.08)]">
              <div className="flex items-center gap-3">
                <Radio className="h-5 w-5 text-[#725d34]" />
                <h2 className="text-2xl font-black">Live market pulse</h2>
              </div>
              <div className="mt-5 space-y-3">
                {sessions.length === 0 ? (
                  <div className="rounded-[1.25rem] border border-dashed border-black/10 bg-[#f8f4ec] p-5 text-sm text-[#10151e]/60">
                    No live sessions are running at the moment.
                  </div>
                ) : (
                  sessions.slice(0, 3).map((session) => (
                    <Link key={session.id} to={`/live/${session.id}`} className="block rounded-[1.25rem] bg-[#f8f4ec] p-5 transition hover:bg-[#efe7d9]">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-lg font-black">{session.title}</p>
                          <p className="mt-1 text-sm text-[#10151e]/60">{session.spotlightMessage || 'Live auction room available now.'}</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] ${statusTone(session.status)}`}>
                          {session.status}
                        </span>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-[2rem] border border-black/8 bg-white p-8 shadow-[0_20px_70px_rgba(15,21,30,0.08)]">
              <div className="flex items-center gap-3">
                <Package className="h-5 w-5 text-[#725d34]" />
                <h2 className="text-2xl font-black">{isAdmin ? 'Campaigns and featured catalog' : 'Featured catalog'}</h2>
              </div>
              <div className="mt-5 space-y-3">
                {isAdmin && campaigns.length > 0 ? (
                  campaigns.slice(0, 2).map((campaign) => (
                    <div key={campaign.id} className="rounded-[1.25rem] bg-[#10151e] p-5 text-white">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-lg font-black">{campaign.recommendation.heroHeadline}</p>
                        <span className="rounded-full bg-white/8 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-[#f6c971]">
                          {campaign.status}
                        </span>
                      </div>
                      <p className="mt-3 text-sm text-white/68">{campaign.aiSummary}</p>
                    </div>
                  ))
                ) : null}
                {featuredProducts.slice(0, 3).map((product) => (
                  <Link key={product.id} to={`/product/${product.id}`} className="flex items-center justify-between gap-4 rounded-[1.25rem] bg-[#f8f4ec] p-4 transition hover:bg-[#efe7d9]">
                    <div>
                      <p className="text-sm font-bold text-[#725d34]">{product.category}</p>
                      <p className="mt-1 text-lg font-black">{product.title}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-[#10151e]">{currency(product.pricing?.salePrice || 0)}</p>
                      <p className="mt-1 text-xs text-[#10151e]/55">{product.inventory?.onHand || 0} on hand</p>
                    </div>
                  </Link>
                ))}
                {featuredProducts.length === 0 ? (
                  <div className="rounded-[1.25rem] border border-dashed border-black/10 bg-[#f8f4ec] p-5 text-sm text-[#10151e]/60">
                    Featured products will appear here once catalog inventory is available.
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-[2rem] border border-black/8 bg-white p-8 shadow-[0_20px_70px_rgba(15,21,30,0.08)]">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-[#725d34]" />
                <h2 className="text-2xl font-black">Identity and access</h2>
              </div>
              <div className="mt-5 grid gap-3 text-sm text-[#10151e]/65">
                <div className="rounded-[1.25rem] bg-[#f8f4ec] p-4">XP: <span className="font-black text-[#10151e]">{profile.xp}</span></div>
                <div className="rounded-[1.25rem] bg-[#f8f4ec] p-4">Total bids placed: <span className="font-black text-[#10151e]">{profile.totalBids || 0}</span></div>
                <div className="rounded-[1.25rem] bg-[#f8f4ec] p-4">Last active: <span className="font-black text-[#10151e]">{formatDate(profile.lastActiveAt || profile.updatedAt)}</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
