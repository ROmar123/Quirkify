import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getProfileByUid, type Profile } from '../../services/profileService';
import { Star, MapPin, Twitter, Instagram, Package, Sparkles } from 'lucide-react';

export default function PublicProfile() {
  const { uid } = useParams<{ uid: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      if (!uid) return;
      try {
        const p = await getProfileByUid(uid);
        setProfile(p);
        setError(null);
      } catch (error) {
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
              {profile.photoUrl ? (
                <img
                  src={profile.photoUrl}
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
                  Level {profile.level || 1} Collector
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
                {profile.socialLinks?.twitter && profile.socialLinks.twitter.startsWith('https://') && (
                  <a href={profile.socialLinks.twitter} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-600 transition-colors">
                    <Twitter className="w-4 h-4" />
                  </a>
                )}
                {profile.socialLinks?.instagram && profile.socialLinks.instagram.startsWith('https://') && (
                  <a href={profile.socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-600 transition-colors">
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
                  { value: profile.itemsCollected || 0, label: 'Items' },
                  { value: profile.auctionsWon || 0, label: 'Wins' },
                  { value: profile.totalBids || 0, label: 'Bids' },
                  { value: (profile.badges || []).length, label: 'Badges' },
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
                {(profile.badges || []).map(badge => (
                  <span
                    key={badge}
                    className="px-3 py-1 bg-purple-50 border border-purple-100 rounded-full text-xs font-bold text-purple-700"
                  >
                    {badge}
                  </span>
                ))}
                {(!profile.badges || profile.badges.length === 0) && (
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
                <span className="text-xs font-bold text-purple-400">{profile.itemsCollected} Items</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {profile.itemsCollected > 0 ? (
                  <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-purple-100">
                    <Package className="w-12 h-12 text-purple-200 mx-auto mb-4" />
                    <p className="text-sm font-black text-purple-700">{profile.itemsCollected} items collected</p>
                    <p className="text-xs font-bold text-purple-400 mt-1">Collection details coming soon</p>
                  </div>
                ) : (
                  <div className="col-span-full py-20 text-center bg-white rounded-3xl border-2 border-dashed border-purple-100">
                    <Package className="w-12 h-12 text-purple-200 mx-auto mb-4" />
                    <p className="text-xs font-bold text-purple-400">No items collected yet</p>
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
