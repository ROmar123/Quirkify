import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { UserProfile, CollectionItem } from '../../types';
import { getUserProfile } from '../../services/userService';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { Trophy, Shield, Zap, Star, MapPin, Twitter, Instagram, Package, Gavel, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';
import { RARITY_COLORS, RARITY_BG } from '../../services/gamificationService';

export default function PublicProfile() {
  const { uid } = useParams<{ uid: string }>();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      if (!uid) return;
      try {
        const p = await getUserProfile(uid);
        setProfile(p);
        setError(null);

        // Load public collection
        const q = query(collection(db, 'users', uid, 'collection'));
        const snap = await getDocs(q);
        const collectionItems = snap.docs.map(d => ({ id: d.id, ...d.data() } as CollectionItem));
        setItems(collectionItems);
      } catch (error) {
        console.error('Error loading profile:', error);
        setError(error instanceof Error ? error.message : 'Failed to load profile');
        setProfile(null);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [uid]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 flex justify-center" style={{ background: '#FDF4FF' }}>
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#A855F7', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center" style={{ background: '#FDF4FF' }}>
        <h2 className="text-2xl font-black text-red-600 mb-4">Error Loading Profile</h2>
        <p className="text-red-500 text-sm mb-6">{error}</p>
        <Link to="/" className="text-purple-500 font-bold text-sm hover:text-purple-700 transition-colors">Return to Store</Link>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center" style={{ background: '#FDF4FF' }}>
        <h2 className="text-2xl font-black text-purple-900 mb-4">Collector Not Found</h2>
        <Link to="/" className="text-purple-500 font-bold text-sm hover:text-purple-700 transition-colors">Return to Store</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: '#FDF4FF' }}>
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Profile Header */}
        <div className="relative mb-16">
          {/* Banner */}
          <div
            className="h-48 rounded-3xl overflow-hidden relative"
            style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}
          >
            <div className="absolute inset-0 flex items-center justify-center opacity-10">
              <Sparkles className="w-64 h-64 text-white" />
            </div>
          </div>

          {/* Avatar + Name row */}
          <div className="absolute -bottom-12 left-8 flex items-end gap-6">
            <div className="w-32 h-32 rounded-3xl bg-white p-1 border-4 border-white shadow-xl overflow-hidden">
              {profile.photoURL ? (
                <img
                  src={profile.photoURL}
                  alt={profile.displayName}
                  className="w-full h-full object-cover rounded-2xl"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full rounded-2xl bg-purple-50 flex items-center justify-center">
                  <Star className="w-12 h-12 text-purple-300" />
                </div>
              )}
            </div>
            <div className="mb-4">
              <h1 className="text-4xl font-black text-purple-900 tracking-tighter font-display">{profile.displayName}</h1>
              <div className="flex items-center gap-4 mt-2">
                {profile.location && (
                  <span className="flex items-center gap-1 text-xs font-bold text-purple-400">
                    <MapPin className="w-3 h-3" /> {profile.location}
                  </span>
                )}
                <span
                  className="px-3 py-1 rounded-full text-white text-xs font-bold"
                  style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}
                >
                  Level {profile.stats ? Math.floor(Math.sqrt((profile.stats.itemsCollected * 100) / 100)) + 1 : 1} Collector
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
          {/* Sidebar */}
          <div className="space-y-6">
            {/* About card */}
            <div className="bg-white rounded-3xl border border-purple-100 shadow-sm p-6">
              <h3 className="text-lg font-black text-purple-900 mb-4">About Collector</h3>
              <p className="text-purple-600 text-sm leading-relaxed mb-6">
                {profile.bio || "This collector hasn't shared their story yet. They are busy hunting for the next quirky treasure."}
              </p>

              <div className="flex gap-4">
                {profile.socialLinks?.twitter && (
                  <a href={profile.socialLinks.twitter} className="text-purple-400 hover:text-purple-600 transition-colors">
                    <Twitter className="w-4 h-4" />
                  </a>
                )}
                {profile.socialLinks?.instagram && (
                  <a href={profile.socialLinks.instagram} className="text-purple-400 hover:text-purple-600 transition-colors">
                    <Instagram className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>

            {/* Stats card */}
            <div className="bg-white rounded-3xl border border-purple-100 shadow-sm p-6">
              <h3 className="text-lg font-black text-purple-900 mb-4">Stats</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: profile.stats?.itemsCollected || 0, label: 'Items' },
                  { value: profile.stats?.auctionsWon || 0, label: 'Wins' },
                  { value: profile.stats?.totalBids || 0, label: 'Bids' },
                  { value: profile.badges?.length || 0, label: 'Badges' },
                ].map(({ value, label }) => (
                  <div key={label} className="p-4 bg-purple-50 rounded-2xl border border-purple-100">
                    <div className="text-2xl font-black text-purple-900 tracking-tighter">{value}</div>
                    <div className="text-xs font-bold text-purple-400 mt-1">{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Badges card */}
            <div className="bg-white rounded-3xl border border-purple-100 shadow-sm p-6">
              <h3 className="text-lg font-black text-purple-900 mb-4">Badges</h3>
              <div className="flex flex-wrap gap-2">
                {profile.badges.map(badge => (
                  <span
                    key={badge}
                    className="px-3 py-1 bg-purple-50 border border-purple-100 rounded-full text-xs font-bold text-purple-700"
                  >
                    {badge}
                  </span>
                ))}
                {profile.badges.length === 0 && (
                  <span className="text-xs font-bold text-purple-400">No badges earned yet</span>
                )}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-black text-purple-900 flex items-center gap-3">
                  <Package className="w-5 h-5 text-purple-500" />
                  Public Collection
                </h2>
                <span className="text-xs font-bold text-purple-400">{items.length} Items</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {items.map((item, idx) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="group bg-white rounded-3xl border border-purple-100 shadow-sm p-4 hover:border-purple-300 hover:shadow-md transition-all"
                  >
                    <div className="aspect-square bg-purple-50 rounded-2xl mb-4 overflow-hidden relative">
                      {item.product?.imageUrl && (
                        <img
                          src={item.product.imageUrl}
                          alt={item.product.name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          referrerPolicy="no-referrer"
                        />
                      )}
                      <div className="absolute top-2 right-2">
                        <span className={cn(
                          "px-2 py-0.5 text-xs font-bold rounded-full",
                          RARITY_BG[item.product?.rarity || 'Common'],
                          RARITY_COLORS[item.product?.rarity || 'Common']
                        )}>
                          {item.product?.rarity || 'Common'}
                        </span>
                      </div>
                    </div>
                    <h4 className="font-black text-sm text-purple-900 tracking-tight mb-1">{item.product?.name || 'Unknown Item'}</h4>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-purple-400">
                        Acquired {new Date(item.acquiredAt).toLocaleDateString()}
                      </span>
                      <span className="text-sm font-black text-purple-600">R{item.purchasePrice}</span>
                    </div>
                  </motion.div>
                ))}
                {items.length === 0 && (
                  <div className="col-span-full py-20 text-center bg-white rounded-3xl border-2 border-dashed border-purple-100">
                    <Package className="w-12 h-12 text-purple-200 mx-auto mb-4" />
                    <p className="text-xs font-bold text-purple-400">Collection is hidden or empty</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const Sparkles = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    <path d="M5 3v4" />
    <path d="M19 17v4" />
    <path d="M3 5h4" />
    <path d="M17 19h4" />
  </svg>
);
