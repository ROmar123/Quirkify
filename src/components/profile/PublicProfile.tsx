import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { getProfileByUid, type Profile } from '../../services/profileService';
import { listProductsByAuthor } from '../../services/catalogService';
import { listAuctionsByCreator } from '../../services/auctionService';
import { currency, formatDate, labelCondition } from '../../lib/quirkify';
import type { Auction, Product } from '../../types';
import { Star, MapPin, Twitter, Instagram, Package, Sparkles, ArrowLeft, AlertCircle, Gavel, ShieldCheck } from 'lucide-react';

export default function PublicProfile() {
  const { uid } = useParams<{ uid: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      if (!uid) return;
      try {
        const p = await getProfileByUid(uid);
        setProfile(p);
        if (p?.firebaseUid) {
          const [productRows, auctionRows] = await Promise.all([
            listProductsByAuthor(p.firebaseUid).catch(() => []),
            listAuctionsByCreator(p.firebaseUid).catch(() => []),
          ]);
          setProducts(productRows);
          setAuctions(auctionRows);
        } else {
          setProducts([]);
          setAuctions([]);
        }
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load profile');
        setProfile(null);
        setProducts([]);
        setAuctions([]);
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, [uid]);

  const liveAuctions = useMemo(
    () => auctions.filter((auction) => ['live', 'scheduled'].includes(auction.status)).slice(0, 6),
    [auctions],
  );

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="skeleton h-40 rounded-2xl mb-6" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map(i => <div key={i} className="skeleton h-32 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-6 h-6 text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Failed to load profile</h2>
        <p className="text-gray-500 text-sm mb-6">{error}</p>
        <Link to="/" className="btn-secondary py-2 px-5 inline-flex">
          <ArrowLeft className="w-4 h-4" /> Back to Store
        </Link>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center">
        <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
          <Package className="w-6 h-6 text-gray-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Collector not found</h2>
        <p className="text-gray-500 text-sm mb-6">This profile doesn't exist or has been removed.</p>
        <Link to="/" className="btn-secondary py-2 px-5 inline-flex">
          <ArrowLeft className="w-4 h-4" /> Back to Store
        </Link>
      </div>
    );
  }

  return (
    <div className="hero-bg min-h-screen">
      <div className="max-w-4xl mx-auto px-4 py-8 pb-28 md:pb-12">

        {/* Profile banner + avatar */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="relative mb-16"
        >
          {/* Banner */}
          <div
            className="h-44 rounded-2xl overflow-hidden noise"
            style={{ background: 'var(--gradient-deep)' }}
          >
            <div className="absolute inset-0 flex items-center justify-center opacity-5">
              <Sparkles className="w-64 h-64 text-white" />
            </div>
          </div>

          {/* Avatar + name row */}
          <div className="absolute -bottom-10 left-6 flex items-end gap-4">
            <div className="w-24 h-24 rounded-2xl bg-white p-0.5 border-2 border-white shadow-lg overflow-hidden flex-shrink-0">
              {profile.photoUrl ? (
                <img
                  src={profile.photoUrl}
                  alt={profile.displayName}
                  className="w-full h-full object-cover rounded-xl"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full rounded-xl bg-gray-100 flex items-center justify-center">
                  <Star className="w-8 h-8 text-gray-300" />
                </div>
              )}
            </div>
            <div className="mb-2">
              <h1 className="text-2xl font-extrabold text-gray-900 leading-tight" style={{ fontFamily: 'Nunito, sans-serif' }}>
                {profile.displayName}
              </h1>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                {profile.location && (
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <MapPin className="w-3 h-3" /> {profile.location}
                  </span>
                )}
                <span className="badge">
                  Level {profile.level || 1} Collector
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-4">
          {/* Sidebar */}
          <div className="space-y-4">
            {/* About card */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"
            >
              <h3 className="text-sm font-bold text-gray-900 mb-3">About</h3>
              <p className="text-gray-500 text-xs leading-relaxed mb-4">
                {profile.bio || "This collector hasn't shared their story yet."}
              </p>
              <div className="flex gap-3">
                {profile.socialLinks?.twitter && profile.socialLinks.twitter.startsWith('https://') && (
                  <a href={profile.socialLinks.twitter} target="_blank" rel="noopener noreferrer"
                    className="text-gray-400 hover:text-gray-600 transition-colors">
                    <Twitter className="w-4 h-4" />
                  </a>
                )}
                {profile.socialLinks?.instagram && profile.socialLinks.instagram.startsWith('https://') && (
                  <a href={profile.socialLinks.instagram} target="_blank" rel="noopener noreferrer"
                    className="text-gray-400 hover:text-gray-600 transition-colors">
                    <Instagram className="w-4 h-4" />
                  </a>
                )}
              </div>
            </motion.div>

            {/* Stats card */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"
            >
              <h3 className="text-sm font-bold text-gray-900 mb-3">Stats</h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: profile.itemsCollected || 0, label: 'Items' },
                  { value: profile.auctionsWon || 0, label: 'Wins' },
                  { value: profile.totalBids || 0, label: 'Bids' },
                  { value: (profile.badges || []).length, label: 'Badges' },
                ].map(({ value, label }) => (
                  <div key={label} className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-center">
                    <div className="text-xl font-bold text-gray-900">{value}</div>
                    <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mt-0.5">{label}</div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Badges card */}
            {profile.badges && profile.badges.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"
              >
                <h3 className="text-sm font-bold text-gray-900 mb-3">Badges</h3>
                <div className="flex flex-wrap gap-1.5">
                  {profile.badges.map(badge => (
                    <span key={badge} className="badge">
                      {badge}
                    </span>
                  ))}
                </div>
              </motion.div>
            )}
          </div>

          {/* Main content */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="lg:col-span-2"
          >
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-purple-500" />
                  <h2 className="text-sm font-bold text-gray-900">Public Collection</h2>
                </div>
                <span className="section-label">{products.length} listings</span>
              </div>

              {products.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {products.map((product) => (
                    <Link
                      key={product.id}
                      to={`/product/${product.id}`}
                      className="group rounded-xl border border-gray-100 bg-[#fbfaf8] p-4 transition hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <div className="aspect-[4/3] overflow-hidden rounded-xl bg-gray-100">
                        {product.imageUrl ? (
                          <img src={product.imageUrl} alt={product.title || product.name || 'Listing'} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <Package className="h-8 w-8 text-gray-300" />
                          </div>
                        )}
                      </div>
                      <div className="mt-4 flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-gray-400">{product.category}</p>
                          <h3 className="mt-1 text-sm font-bold text-gray-900">{product.title || product.name}</h3>
                        </div>
                        <span className="badge whitespace-nowrap">{labelCondition(product.condition)}</span>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-sm">
                        <span className="font-bold text-gray-900">{currency(product.pricing?.salePrice || product.retailPrice || 0)}</span>
                        <span className="text-xs text-gray-500">{product.inventory?.onHand || 0} available</span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="py-16 text-center rounded-xl border-2 border-dashed border-gray-100">
                  <Package className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-gray-700">No public listings yet</p>
                  <p className="text-xs text-gray-400 mt-1">This collector has not published store inventory yet.</p>
                </div>
              )}
            </div>

            <div className="mt-5 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Gavel className="w-4 h-4 text-purple-500" />
                  <h2 className="text-sm font-bold text-gray-900">Auction listings</h2>
                </div>
                <span className="section-label">{liveAuctions.length} live or scheduled</span>
              </div>

              {liveAuctions.length > 0 ? (
                <div className="space-y-3">
                  {liveAuctions.map((auction) => (
                    <Link
                      key={auction.id}
                      to="/auctions"
                      className="flex items-center justify-between gap-4 rounded-xl border border-gray-100 bg-[#fbfaf8] p-4 transition hover:shadow-sm"
                    >
                      <div>
                        <p className="text-sm font-bold text-gray-900">{auction.title}</p>
                        <p className="mt-1 text-xs text-gray-500">
                          {auction.status === 'live' ? 'Live now' : `Starts ${formatDate(auction.startsAt)}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-gray-900">{currency(auction.currentBid)}</p>
                        <span className="mt-1 inline-flex rounded-full bg-gray-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                          {auction.status}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center rounded-xl border-2 border-dashed border-gray-100">
                  <ShieldCheck className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-gray-700">No public auction listings</p>
                  <p className="text-xs text-gray-400 mt-1">Live or scheduled lots from this collector will appear here.</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
