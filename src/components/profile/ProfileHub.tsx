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
import { motion } from 'motion/react';
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

const card: React.CSSProperties = {
  background: '#fff',
  borderRadius: 24,
  border: '1px solid #F3F4F6',
  padding: '28px 24px',
  boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
};

const softRow: React.CSSProperties = {
  background: '#F9FAFB',
  borderRadius: 14,
  padding: '14px 16px',
  border: '1px solid #F3F4F6',
};

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
      { label: 'Wallet balance', value: currency(profile?.balance || 0), detail: 'Auction credit and store spend.', icon: Wallet, accent: '#7C3AED', bg: '#F5F3FF' },
      { label: 'Open orders', value: String(activeOrders.length), detail: 'In payment or fulfilment.', icon: Receipt, accent: '#2563EB', bg: '#EFF6FF' },
      { label: 'Active bids', value: String(activeBids.length), detail: 'Lots where you lead.', icon: Gavel, accent: '#EC4899', bg: '#FFF1F2' },
      { label: 'Cart total', value: currency(total), detail: `${items.length} lines staged.`, icon: ShoppingBag, accent: '#059669', bg: '#F0FDF4' },
    ],
    [activeBids.length, activeOrders.length, items.length, profile?.balance, total]
  );

  if (!profile) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', fontSize: 14 }}>
        Loading profile…
      </div>
    );
  }

  const initials = (profile.displayName || profile.email || 'Q').charAt(0).toUpperCase();

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', padding: '32px 16px 80px' }}>
      <div className="mx-auto max-w-7xl" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Hero row */}
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          {/* Identity card */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              borderRadius: 28,
              background: 'linear-gradient(135deg, #1E1B4B 0%, #4C1D95 55%, #831843 100%)',
              padding: '36px 32px',
              position: 'relative', overflow: 'hidden',
            }}
          >
            <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'rgba(244,114,182,0.15)', filter: 'blur(50px)', pointerEvents: 'none' }} />
            <div style={{ position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%',
                  background: 'var(--gradient-primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, fontWeight: 900, color: '#fff',
                  border: '3px solid rgba(255,255,255,0.2)',
                  flexShrink: 0,
                }}>
                  {initials}
                </div>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>
                    Customer profile
                  </p>
                  <h1 style={{ fontFamily: '"Nunito", sans-serif', fontSize: 'clamp(20px, 3vw, 28px)', fontWeight: 900, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                    {profile.displayName}
                  </h1>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>{profile.email}</p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {[
                  { label: 'Level', value: String(profile.level || 1) },
                  { label: 'Total spend', value: currency(profile.totalSpent || 0) },
                  { label: 'Auctions won', value: String(profile.auctionsWon || 0) },
                ].map((item) => (
                  <div key={item.label} style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: '12px 14px', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>
                      {item.label}
                    </p>
                    <p style={{ fontSize: 18, fontWeight: 900, color: '#fff' }}>{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Quick controls */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            style={{ ...card }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShieldCheck size={15} color="#7C3AED" />
              </div>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: '#111827' }}>Quick actions</h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'Review orders & delivery', to: '/orders', variant: 'soft' },
                { label: 'Open live auctions', to: '/auctions', variant: 'soft' },
                { label: 'Go to checkout', to: '/checkout', variant: 'primary' },
                ...(isAdmin ? [{ label: 'Open admin workspace', to: '/admin', variant: 'soft' }] : []),
              ].map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    borderRadius: 14, padding: '13px 16px',
                    fontSize: 14, fontWeight: 700, textDecoration: 'none',
                    background: item.variant === 'primary' ? 'var(--gradient-primary)' : '#F9FAFB',
                    color: item.variant === 'primary' ? '#fff' : '#374151',
                    border: item.variant === 'primary' ? 'none' : '1px solid #F3F4F6',
                    boxShadow: item.variant === 'primary' ? '0 4px 14px rgba(168,85,247,0.3)' : 'none',
                    transition: 'opacity 0.15s',
                  }}
                >
                  {item.label}
                  <ArrowRight size={15} />
                </Link>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Stat chips */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          {missionCards.map(({ label, value, detail, icon: Icon, accent, bg }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              style={{ ...card, padding: '20px 22px' }}
            >
              <div style={{ width: 34, height: 34, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <Icon size={16} color={accent} />
              </div>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9CA3AF', marginBottom: 4 }}>{label}</p>
              <p style={{ fontSize: 24, fontWeight: 900, color: '#111827', fontFamily: '"Nunito", sans-serif' }}>{value}</p>
              <p style={{ fontSize: 12, color: '#6B7280', marginTop: 4, lineHeight: 1.5 }}>{detail}</p>
            </motion.div>
          ))}
        </div>

        {/* Main content grid */}
        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Orders */}
            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Receipt size={15} color="#2563EB" />
                </div>
                <h2 style={{ fontSize: 16, fontWeight: 800, color: '#111827' }}>Order journey</h2>
              </div>
              {activeOrders.length === 0 ? (
                <div style={{ ...softRow, textAlign: 'center', borderStyle: 'dashed', color: '#9CA3AF', fontSize: 13, padding: '20px' }}>
                  No live orders. New store, pack, and auction wins appear here.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {activeOrders.slice(0, 3).map((order) => (
                    <div key={order.id} style={softRow}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
                        <div>
                          <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9CA3AF', marginBottom: 4 }}>{order.orderNumber}</p>
                          <p style={{ fontSize: 18, fontWeight: 900, color: '#111827' }}>{currency(order.total)}</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${statusTone(order.status)}`}>
                          {order.status.replaceAll('_', ' ')}
                        </span>
                      </div>
                      <p style={{ fontSize: 12, color: '#6B7280' }}>
                        Payment: {order.paymentStatus.replaceAll('_', ' ')} · Shipping: {order.shippingStatus.replaceAll('_', ' ')}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Active bids */}
            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: '#FFF1F2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Gavel size={15} color="#EC4899" />
                </div>
                <h2 style={{ fontSize: 16, fontWeight: 800, color: '#111827' }}>Auction exposure</h2>
              </div>
              {activeBids.length === 0 ? (
                <div style={{ ...softRow, textAlign: 'center', borderStyle: 'dashed', color: '#9CA3AF', fontSize: 13, padding: '20px' }}>
                  You're not leading any lots right now.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {activeBids.map((auction) => (
                    <div key={auction.id} style={softRow}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                        <div>
                          <p style={{ fontSize: 15, fontWeight: 800, color: '#111827', marginBottom: 2 }}>{auction.title}</p>
                          <p style={{ fontSize: 12, color: '#6B7280' }}>Ends {formatDate(auction.endsAt)}</p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ fontSize: 15, fontWeight: 800, color: '#7C3AED' }}>{currency(auction.currentBid)}</p>
                          <span className={`inline-flex mt-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusTone(auction.status)}`}>
                            {auction.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Live sessions */}
            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Radio size={15} color="#D97706" />
                </div>
                <h2 style={{ fontSize: 16, fontWeight: 800, color: '#111827' }}>Live market pulse</h2>
              </div>
              {sessions.length === 0 ? (
                <div style={{ ...softRow, textAlign: 'center', borderStyle: 'dashed', color: '#9CA3AF', fontSize: 13, padding: '20px' }}>
                  No live sessions running right now.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {sessions.slice(0, 3).map((session) => (
                    <Link
                      key={session.id}
                      to={`/live/${session.id}`}
                      style={{ ...softRow, display: 'block', textDecoration: 'none', transition: 'border-color 0.15s' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                        <div>
                          <p style={{ fontSize: 15, fontWeight: 800, color: '#111827', marginBottom: 2 }}>{session.title}</p>
                          <p style={{ fontSize: 12, color: '#6B7280' }}>{session.spotlightMessage || 'Live auction room available.'}</p>
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusTone(session.status)}`}>
                          {session.status}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Featured products + campaigns */}
            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Package size={15} color="#7C3AED" />
                </div>
                <h2 style={{ fontSize: 16, fontWeight: 800, color: '#111827' }}>
                  {isAdmin ? 'Campaigns & catalog' : 'Featured catalog'}
                </h2>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {isAdmin && campaigns.slice(0, 2).map((campaign) => (
                  <div
                    key={campaign.id}
                    style={{
                      borderRadius: 14, padding: '14px 16px',
                      background: 'linear-gradient(135deg, #1E1B4B, #4C1D95)',
                      border: '1px solid rgba(168,85,247,0.2)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
                      <p style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{campaign.recommendation.heroHeadline}</p>
                      <span style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 9999, padding: '2px 10px', fontSize: 10, fontWeight: 700, color: '#C084FC', textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {campaign.status}
                      </span>
                    </div>
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>{campaign.aiSummary}</p>
                  </div>
                ))}
                {featuredProducts.slice(0, 3).map((product) => (
                  <Link
                    key={product.id}
                    to={`/product/${product.id}`}
                    style={{ ...softRow, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, textDecoration: 'none', transition: 'border-color 0.15s' }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: '#A855F7', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>{product.category}</p>
                      <p style={{ fontSize: 14, fontWeight: 800, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product.title}</p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 800, color: '#7C3AED' }}>{currency(product.pricing?.salePrice || 0)}</p>
                      <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{product.inventory?.onHand || 0} in stock</p>
                    </div>
                  </Link>
                ))}
                {featuredProducts.length === 0 && (
                  <div style={{ ...softRow, textAlign: 'center', borderStyle: 'dashed', color: '#9CA3AF', fontSize: 13, padding: '20px' }}>
                    Featured products appear once catalog inventory is available.
                  </div>
                )}
              </div>
            </div>

            {/* XP + identity */}
            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg, #FDF4FF, #F5F3FF)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #E9D5FF' }}>
                  <Sparkles size={15} color="#A855F7" />
                </div>
                <h2 style={{ fontSize: 16, fontWeight: 800, color: '#111827' }}>Identity &amp; progress</h2>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { label: 'XP earned', value: String(profile.xp || 0) },
                  { label: 'Total bids placed', value: String(profile.totalBids || 0) },
                  { label: 'Last active', value: formatDate(profile.lastActiveAt || profile.updatedAt) },
                ].map((item) => (
                  <div
                    key={item.label}
                    style={{ ...softRow, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <span style={{ fontSize: 13, color: '#6B7280' }}>{item.label}</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: '#111827' }}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
