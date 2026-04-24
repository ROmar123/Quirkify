import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { supabase } from '../../supabase';
import { getProfileByUid, type Profile } from '../../services/profileService';
import { Star, MapPin, Twitter, Instagram, Package, Sparkles, ArrowLeft, AlertCircle } from 'lucide-react';

interface CollectionItem {
  id: string;
  productId: string;
  acquiredAt: string;
  purchasePrice: number;
  productName?: string;
  productImage?: string;
  productCategory?: string;
  productRarity?: string;
}

export default function PublicProfile() {
  const { uid } = useParams<{ uid: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [collectionItems, setCollectionItems] = useState<CollectionItem[]>([]);
  const [collectionLoading, setCollectionLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      if (!uid) return;
      try {
        const p = await getProfileByUid(uid);
        setProfile(p);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load profile');
        setProfile(null);
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, [uid]);

  useEffect(() => {
    if (!profile?.id) return;
    const loadCollection = async () => {
      setCollectionLoading(true);
      try {
        const { data } = await supabase
          .from('collection_items')
          .select('id, product_id, acquired_at, purchase_price, products(id, name, image_url, category, rarity)')
          .eq('profile_id', profile.id)
          .order('acquired_at', { ascending: false })
          .limit(24);

        const items: CollectionItem[] = (data ?? []).map((row: any) => ({
          id: row.id,
          productId: row.product_id,
          acquiredAt: row.acquired_at ?? '',
          purchasePrice: Number(row.purchase_price) || 0,
          productName: row.products?.name,
          productImage: row.products?.image_url,
          productCategory: row.products?.category,
          productRarity: row.products?.rarity,
        }));
        setCollectionItems(items);
      } catch {
        setCollectionItems([]);
      } finally {
        setCollectionLoading(false);
      }
    };
    loadCollection();
  }, [profile?.id]);

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
              {/* XP progress bar */}
              {(() => {
                const xp = profile.xp || 0;
                const level = profile.level || 1;
                const xpPerLevel = 500;
                const xpIntoLevel = xp % xpPerLevel;
                const progress = xpIntoLevel / xpPerLevel;
                return (
                  <div className="mt-3 max-w-xs">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] text-gray-400 font-semibold">{xpIntoLevel} / {xpPerLevel} XP</span>
                      <span className="text-[10px] text-purple-500 font-bold">→ Lv.{level + 1}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progress * 100}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        className="h-full rounded-full"
                        style={{ background: 'var(--gradient-primary)' }}
                      />
                    </div>
                  </div>
                );
              })()}
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
                <span className="section-label">{profile.itemsCollected || 0} items</span>
              </div>

              {collectionLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[1,2,3,4,5,6].map(i => (
                    <div key={i} className="skeleton h-36 rounded-xl" />
                  ))}
                </div>
              ) : collectionItems.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {collectionItems.map(item => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="group relative rounded-xl border border-gray-100 bg-gray-50 overflow-hidden hover:border-purple-200 hover:shadow-sm transition-all"
                    >
                      <div className="aspect-square bg-white flex items-center justify-center overflow-hidden">
                        {item.productImage ? (
                          <img
                            src={item.productImage}
                            alt={item.productName ?? 'Item'}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <Package className="w-10 h-10 text-gray-200" />
                        )}
                      </div>
                      <div className="p-2">
                        <p className="text-xs font-semibold text-gray-800 truncate">
                          {item.productName ?? 'Unknown Item'}
                        </p>
                        {item.productRarity && (
                          <span className="text-[10px] font-medium text-purple-500">{item.productRarity}</span>
                        )}
                        {item.productCategory && (
                          <p className="text-[10px] text-gray-400 truncate">{item.productCategory}</p>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="py-16 text-center rounded-xl border-2 border-dashed border-gray-100">
                  <Package className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                  <p className="text-xs text-gray-400">No items collected yet</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
