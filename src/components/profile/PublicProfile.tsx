import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { UserProfile, CollectionItem } from '../../types';
import { getUserProfile } from '../../services/userService';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { Trophy, Shield, Zap, Star, MapPin, Twitter, Instagram, Package, Gavel } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';
import { RARITY_COLORS, RARITY_BG } from '../../services/gamificationService';

export default function PublicProfile() {
  const { uid } = useParams<{ uid: string }>();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      if (!uid) return;
      try {
        const p = await getUserProfile(uid);
        setProfile(p);

        // Load public collection
        const q = query(collection(db, 'users', uid, 'collection'));
        const snap = await getDocs(q);
        const collectionItems = snap.docs.map(d => ({ id: d.id, ...d.data() } as CollectionItem));
        setItems(collectionItems);
      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [uid]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 flex justify-center">
        <div className="w-8 h-8 border-2 border-quirky border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-bold mb-4">Collector Not Found</h2>
        <Link to="/" className="text-quirky font-bold uppercase text-[10px] tracking-widest">Return to Store</Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      {/* Profile Header */}
      <div className="relative mb-12">
        <div className="h-48 bg-zinc-100 rounded-none overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-quirky/20 to-cyber/20 opacity-50" />
          <div className="absolute inset-0 flex items-center justify-center opacity-5">
            <Sparkles className="w-64 h-64" />
          </div>
        </div>
        
        <div className="absolute -bottom-12 left-8 flex items-end gap-6">
          <div className="w-32 h-32 bg-white p-1 border border-zinc-100 shadow-xl">
            {profile.photoURL ? (
              <img src={profile.photoURL} alt={profile.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-full h-full bg-zinc-50 flex items-center justify-center text-zinc-300">
                <Star className="w-12 h-12" />
              </div>
            )}
          </div>
          <div className="mb-4">
            <h1 className="text-4xl font-bold tracking-tighter uppercase font-display">{profile.displayName}</h1>
            <div className="flex items-center gap-4 mt-2">
              {profile.location && (
                <span className="flex items-center gap-1 text-[8px] font-bold text-zinc-400 uppercase tracking-widest">
                  <MapPin className="w-3 h-3" /> {profile.location}
                </span>
              )}
              <span className="px-2 py-0.5 bg-quirky text-white text-[8px] font-bold uppercase tracking-widest">
                Level {profile.stats ? Math.floor(Math.sqrt((profile.stats.itemsCollected * 100) / 100)) + 1 : 1} Collector
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 mt-20">
        {/* Sidebar */}
        <div className="space-y-8">
          <div className="bg-zinc-50 p-8 border border-zinc-100">
            <h3 className="text-[10px] font-bold uppercase tracking-widest mb-6 text-zinc-400">About Collector</h3>
            <p className="text-zinc-600 text-sm leading-relaxed mb-6">
              {profile.bio || "This collector hasn't shared their story yet. They are busy hunting for the next quirky treasure."}
            </p>
            
            <div className="flex gap-4">
              {profile.socialLinks?.twitter && (
                <a href={profile.socialLinks.twitter} className="text-zinc-400 hover:text-quirky transition-colors">
                  <Twitter className="w-4 h-4" />
                </a>
              )}
              {profile.socialLinks?.instagram && (
                <a href={profile.socialLinks.instagram} className="text-zinc-400 hover:text-quirky transition-colors">
                  <Instagram className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>

          <div className="bg-zinc-50 p-8 border border-zinc-100">
            <h3 className="text-[10px] font-bold uppercase tracking-widest mb-6 text-zinc-400">Stats</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-white border border-zinc-100">
                <div className="text-2xl font-bold tracking-tighter">{profile.stats?.itemsCollected || 0}</div>
                <div className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Items</div>
              </div>
              <div className="p-4 bg-white border border-zinc-100">
                <div className="text-2xl font-bold tracking-tighter">{profile.stats?.auctionsWon || 0}</div>
                <div className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Wins</div>
              </div>
              <div className="p-4 bg-white border border-zinc-100">
                <div className="text-2xl font-bold tracking-tighter">{profile.stats?.totalBids || 0}</div>
                <div className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Bids</div>
              </div>
              <div className="p-4 bg-white border border-zinc-100">
                <div className="text-2xl font-bold tracking-tighter">{profile.badges?.length || 0}</div>
                <div className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Badges</div>
              </div>
            </div>
          </div>

          <div className="bg-zinc-50 p-8 border border-zinc-100">
            <h3 className="text-[10px] font-bold uppercase tracking-widest mb-6 text-zinc-400">Badges</h3>
            <div className="flex flex-wrap gap-2">
              {profile.badges.map(badge => (
                <span key={badge} className="px-3 py-1 bg-white border border-zinc-200 text-[8px] font-bold uppercase tracking-widest">
                  {badge}
                </span>
              ))}
              {profile.badges.length === 0 && (
                <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest">No badges earned yet</span>
              )}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-2 space-y-12">
          <div>
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold tracking-tighter uppercase font-display flex items-center gap-3">
                <Package className="w-6 h-6 text-quirky" />
                Public Collection
              </h2>
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{items.length} Items</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {items.map((item, idx) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="group bg-white border border-zinc-100 p-4 hover:border-quirky transition-all"
                >
                  <div className="aspect-square bg-zinc-50 mb-4 overflow-hidden relative">
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
                        "px-2 py-0.5 text-[8px] font-bold uppercase tracking-widest",
                        RARITY_BG[item.product?.rarity || 'Common'],
                        RARITY_COLORS[item.product?.rarity || 'Common']
                      )}>
                        {item.product?.rarity || 'Common'}
                      </span>
                    </div>
                  </div>
                  <h4 className="font-bold text-sm tracking-tight mb-1">{item.product?.name || 'Unknown Item'}</h4>
                  <div className="flex items-center justify-between">
                    <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest">
                      Acquired {new Date(item.acquiredAt).toLocaleDateString()}
                    </span>
                    <span className="text-[10px] font-bold text-quirky">R{item.purchasePrice}</span>
                  </div>
                </motion.div>
              ))}
              {items.length === 0 && (
                <div className="col-span-full py-20 text-center bg-zinc-50 border border-zinc-100 border-dashed">
                  <Package className="w-12 h-12 text-zinc-200 mx-auto mb-4" />
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Collection is hidden or empty</p>
                </div>
              )}
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
