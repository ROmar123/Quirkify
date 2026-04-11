import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, getDoc, where, updateDoc, serverTimestamp, addDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../../firebase';

import { CollectionItem, Product, UserProgress, Auction, UserProfile } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Star, Shield, Zap, Gavel, Box, Bell, Settings, Wallet, CreditCard, User as UserIcon, LogIn, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { ensureUserProgress } from '../../services/gamificationService';
import { subscribeToNotifications, Notification, markAsRead, deleteNotification } from '../../services/notificationService';
import { getUserProfile, createOrUpdateProfile } from '../../services/userService';
import { uploadProfilePicture } from '../../services/storageService';
import { initiateYocoCheckout } from '../../services/paymentService';
import { createOrder } from '../../services/orderService';
import { getProfileByUid, type Profile as CommerceProfile } from '../../services/profileService';
type CollectionTab = 'vault' | 'bids' | 'profile';

const TABS: { id: CollectionTab; label: string; icon: React.ElementType }[] = [
  { id: 'vault', label: 'Vault', icon: Box },
  { id: 'bids', label: 'Bids', icon: Gavel },
  { id: 'profile', label: 'Profile', icon: Settings },
];

export default function Collection() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<CollectionTab>('vault');
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [activeBids, setActiveBids] = useState<Auction[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [userProgress, setUserProgress] = useState<UserProgress | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [commerceProfile, setCommerceProfile] = useState<CommerceProfile | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [topUpError, setTopUpError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showTopUp, setShowTopUp] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState(100);

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');

  useEffect(() => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;

    ensureUserProgress(uid)
      .then(setUserProgress)
      .catch(() => {
        // Silently fail - user progress will be created on first interaction
      });

    getProfileByUid(uid)
      .then(setCommerceProfile)
      .catch(() => {
        // Silently fail - commerce profile is synced elsewhere
      });

    getUserProfile(uid)
      .then(p => {
        setProfile(p);
        if (p) {
          setDisplayName(p.displayName || '');
          setBio(p.bio || '');
          setLocation(p.location || '');
        }
      })
      .catch(() => {
        // Silently fail - profile will be created on first update
      });

    let isMounted = true;

    const qVault = query(collection(db, 'users', uid, 'collection'));
    const unsubscribeVault = onSnapshot(qVault, async (snapshot) => {
      if (!isMounted) return; // Prevent setState on unmounted component

      try {
        const collectionItems: CollectionItem[] = [];
        for (const d of snapshot.docs) {
          if (!isMounted) break; // Check again during async loop

          const itemData = d.data() as CollectionItem;
          const productRef = doc(db, 'products', itemData.productId);
          const productSnap = await getDoc(productRef);
          if (productSnap.exists()) {
            collectionItems.push({ id: d.id, ...itemData, product: { id: productSnap.id, ...productSnap.data() } as Product });
          }
        }

        if (isMounted) {
          setItems(collectionItems);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          // Silently fail - vault items will show empty
          setLoading(false);
        }
      }
    }, (error) => {
      if (isMounted) {
        handleFirestoreError(error, OperationType.GET, `users/${uid}/collection`);
        setLoading(false);
      }
    });

    const qBids = query(collection(db, 'auctions'), where('highestBidderId', '==', uid), where('status', '==', 'active'));
    const unsubscribeBids = onSnapshot(qBids, (snapshot) => {
      setActiveBids(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Auction)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'auctions');
    });

    const unsubscribeNotifications = subscribeToNotifications(uid, setNotifications);

    return () => {
      isMounted = false; // Prevent setState after unmount
      unsubscribeVault();
      unsubscribeBids();
      unsubscribeNotifications();
    };
  }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    setSaving(true);
    setUpdateError(null);
    try {
      await createOrUpdateProfile(auth.currentUser.uid, { displayName, bio, location });
      const p = await getUserProfile(auth.currentUser.uid);
      setProfile(p);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to update profile';
      setUpdateError(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !auth.currentUser) return;
    setUploading(true);
    try {
      const url = await uploadProfilePicture(auth.currentUser.uid, file);
      await createOrUpdateProfile(auth.currentUser.uid, { photoURL: url });
      const p = await getUserProfile(auth.currentUser.uid);
      setProfile(p);
    } finally {
      setUploading(false);
    }
  };

  const handleTopUp = async () => {
    if (!auth.currentUser) return;
    setTopUpError(null);
    try {
      if (!Number.isFinite(topUpAmount) || topUpAmount <= 0) {
        throw new Error('Enter a valid top-up amount.');
      }

      const supabaseProfile = commerceProfile || await getProfileByUid(auth.currentUser.uid);
      if (!supabaseProfile) {
        throw new Error('Your account profile is not ready yet. Please sign in again.');
      }

      const order = await createOrder({
        profileId: supabaseProfile.id,
        customerEmail: auth.currentUser.email || supabaseProfile.email,
        customerName: profile?.displayName || supabaseProfile.displayName || auth.currentUser.email || 'Quirkify Customer',
        customerPhone: supabaseProfile.phone || undefined,
        channel: 'manual',
        sourceRef: 'wallet_topup',
        items: [{
          productId: null,
          productName: 'Wallet Top Up',
          unitPrice: topUpAmount,
          quantity: 1,
        }],
        paymentMethod: 'yoco',
      });
      await initiateYocoCheckout(topUpAmount, 'Wallet Top Up', order.id);
    } catch (error: any) {
      const errorMsg = error?.message || 'Wallet top-up failed. Please try again.';
      setTopUpError(errorMsg);
    }
  };

  if (!auth.currentUser) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 pb-32 text-center md:py-32 md:pb-20">
        <div className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}>
          <LogIn className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-3xl font-black mb-3 gradient-text">Sign in to view your vault</h2>
        <p className="text-purple-400 text-sm font-semibold mb-8">Your collection is waiting.</p>
        <button onClick={() => navigate('/auth?next=%2Fcollection')} className="btn-primary px-10 py-4 text-base">Sign In or Create Account</button>
      </div>
    );
  }

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 pb-32 md:pb-12">
      {/* Header */}
      <header className="mb-12">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-6xl md:text-8xl font-black mb-3 leading-tight gradient-text"
        >
          My Vault
        </motion.h1>
        <p className="text-purple-400 text-sm font-semibold">Your collection of unique items, bids and profile.</p>
      </header>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-10 overflow-x-auto pb-2">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const badge = tab.id === 'vault' ? items.length : tab.id === 'bids' ? activeBids.length : 0;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all whitespace-nowrap relative',
                isActive ? 'text-white shadow-md' : 'text-purple-400 bg-white border border-purple-100 hover:border-purple-300'
              )}
              style={isActive ? { background: 'linear-gradient(135deg, #F472B6, #A855F7)' } : {}}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {badge > 0 && (
                <span className={cn(
                  'w-5 h-5 rounded-full text-[9px] font-bold flex items-center justify-center',
                  isActive ? 'bg-white/30 text-white' : 'bg-purple-100 text-purple-500'
                )}>
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Wallet Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          <div className="rounded-3xl p-6 text-white relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #A855F7, #F472B6)' }}>
            <Wallet className="absolute top-4 right-4 w-12 h-12 opacity-20" />
            <p className="text-[9px] font-bold uppercase tracking-widest text-white/70 mb-1">Quirkify Wallet</p>
            <p className="text-4xl font-black mb-6">R{commerceProfile?.balance ?? userProgress?.balance ?? 0}</p>
            <button
              onClick={() => setShowTopUp(true)}
              className="w-full py-2.5 bg-white/20 hover:bg-white/30 border border-white/30 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2"
            >
              <CreditCard className="w-3 h-3" />
              Top Up
            </button>
          </div>

          {/* Stats */}
          <div className="bg-white rounded-3xl border border-purple-100 p-6 space-y-4">
            <h3 className="text-[9px] font-bold uppercase tracking-widest text-purple-400">Collector Stats</h3>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-black shadow" style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}>
                {userProgress?.level || 1}
              </div>
              <div className="flex-1">
                <p className="text-[9px] font-bold text-purple-400 mb-1">Level {userProgress?.level || 1} · {userProgress?.xp || 0} XP</p>
                <div className="h-2 bg-purple-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${(userProgress?.xp || 0) % 100}%`, background: 'linear-gradient(90deg, #F472B6, #A855F7)' }} />
                </div>
              </div>
            </div>
            <div className="pt-3 border-t border-purple-50 flex justify-between items-center">
              <span className="text-[9px] font-bold text-purple-400 uppercase tracking-widest">Collection Value</span>
              <span className="text-sm font-black text-purple-800">R{items.reduce((acc, item) => acc + item.purchasePrice, 0)}</span>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          <AnimatePresence mode="wait">
            {activeTab === 'vault' && (
              <motion.div key="vault" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                {loading ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => <div key={i} className="aspect-[3/4] bg-purple-50 animate-pulse rounded-3xl" />)}
                  </div>
                ) : items.length === 0 ? (
                  <div className="text-center py-32 rounded-3xl border border-purple-100 bg-purple-50">
                    <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #A855F7, #6366F1)' }}>
                      <Shield className="w-8 h-8 text-white" />
                    </div>
                    <p className="text-purple-400 font-bold text-sm mb-4">Your vault is empty</p>
                    <Link to="/" className="btn-primary px-8 py-3 text-sm">Start Shopping</Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {items.map((item) => (
                      <motion.div key={item.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="group bg-white rounded-3xl border border-purple-100 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300">
                        <div className="aspect-[3/4] overflow-hidden relative">
                          <img src={item.product?.imageUrl} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt="" referrerPolicy="no-referrer" />
                          <div className="absolute top-3 left-3 px-2 py-1 text-[8px] font-bold uppercase tracking-widest rounded-full text-white"
                            style={{
                              background: item.product?.rarity === 'Unique' ? 'linear-gradient(135deg,#FBBF24,#F59E0B)' :
                                item.product?.rarity === 'Super Rare' ? 'linear-gradient(135deg,#F472B6,#EC4899)' :
                                item.product?.rarity === 'Rare' ? 'linear-gradient(135deg,#A855F7,#6366F1)' : '#4B5563',
                              color: item.product?.rarity === 'Unique' ? '#000' : '#fff',
                            }}>
                            {item.product?.rarity}
                          </div>
                        </div>
                        <div className="p-4">
                          <h3 className="font-bold text-sm truncate mb-1">{item.product?.name}</h3>
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-bold text-purple-400">#{item.product?.serialNumber || '000'}</span>
                            <span className="text-sm font-black" style={{ color: '#A855F7' }}>R{item.purchasePrice}</span>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'bids' && (
              <motion.div key="bids" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                {activeBids.length === 0 ? (
                  <div className="text-center py-32 rounded-3xl border border-purple-100 bg-purple-50">
                    <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #FBBF24, #FB923C)' }}>
                      <Gavel className="w-8 h-8 text-white" />
                    </div>
                    <p className="text-purple-400 font-bold text-sm mb-4">No active bids</p>
                    <Link to="/auctions" className="btn-primary px-8 py-3 text-sm">Browse Auctions</Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {activeBids.map((auction) => (
                      <div key={auction.id} className="bg-white rounded-3xl border border-purple-100 p-5 flex gap-5 shadow-sm hover:shadow-md transition-all group">
                        <div className="w-24 h-24 rounded-2xl overflow-hidden flex-shrink-0 bg-purple-50">
                          <img src={auction.product?.imageUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="" referrerPolicy="no-referrer" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-2">
                            <span className="px-2 py-0.5 bg-green-50 text-green-600 text-[8px] font-bold uppercase tracking-widest rounded-full border border-green-100">Winning</span>
                            <span className="text-[8px] font-bold text-purple-400">Ends {new Date(auction.endTime).toLocaleDateString()}</span>
                          </div>
                          <h4 className="font-bold text-sm truncate mb-3">{auction.product?.name}</h4>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-[8px] font-bold text-purple-400 uppercase tracking-widest">Current Bid</p>
                              <p className="text-lg font-black">R{auction.currentBid}</p>
                            </div>
                            <Link to="/auctions" className="btn-primary px-4 py-2 text-xs">View</Link>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'profile' && (
              <motion.div key="profile" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <form onSubmit={handleUpdateProfile} className="bg-white rounded-3xl border border-purple-100 p-8 max-w-xl shadow-sm">
                  {/* Avatar */}
                  <div className="flex items-center gap-6 mb-8">
                    <div className="w-20 h-20 rounded-full overflow-hidden relative group flex-shrink-0 border-4 border-purple-100">
                      {profile?.photoURL ? (
                        <img src={profile.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}>
                          <UserIcon className="w-8 h-8 text-white" />
                        </div>
                      )}
                      <label className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer rounded-full">
                        <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} disabled={uploading} />
                        <span className="text-[9px] font-bold text-white uppercase">{uploading ? '...' : 'Change'}</span>
                      </label>
                    </div>
                    <div>
                      <h3 className="text-xl font-black">{profile?.displayName || 'Collector'}</h3>
                      <p className="text-purple-400 text-xs font-semibold">{auth.currentUser?.email}</p>
                      <Link to={`/profile/${auth.currentUser?.uid}`} className="text-[9px] font-bold text-purple-500 hover:underline mt-1 inline-block">
                        View Public Profile →
                      </Link>
                    </div>
                  </div>

                  <div className="space-y-5">
                    {[
                      { label: 'Display Name', value: displayName, set: setDisplayName, type: 'text', placeholder: 'Your display name' },
                      { label: 'Location', value: location, set: setLocation, type: 'text', placeholder: 'e.g. Cape Town, SA' },
                    ].map(field => (
                      <div key={field.label}>
                        <label className="text-[9px] font-bold text-purple-400 uppercase tracking-widest block mb-1.5">{field.label}</label>
                        <input
                          type={field.type}
                          value={field.value}
                          onChange={e => field.set(e.target.value)}
                          placeholder={field.placeholder}
                          className="w-full p-3 bg-purple-50 border-2 border-purple-100 rounded-2xl text-sm font-semibold text-purple-800 focus:outline-none focus:border-purple-400 transition-colors"
                        />
                      </div>
                    ))}
                    <div>
                      <label className="text-[9px] font-bold text-purple-400 uppercase tracking-widest block mb-1.5">Bio</label>
                      <textarea
                        value={bio}
                        onChange={e => setBio(e.target.value)}
                        rows={3}
                        placeholder="Tell the community about your collection..."
                        className="w-full p-3 bg-purple-50 border-2 border-purple-100 rounded-2xl text-sm font-semibold text-purple-800 focus:outline-none focus:border-purple-400 transition-colors resize-none"
                      />
                    </div>
                  </div>

                  {updateError && (
                    <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
                      {updateError}
                    </div>
                  )}
                  <button type="submit" disabled={saving} className="btn-primary mt-4 px-8 py-3 text-sm disabled:opacity-40">
                    {saving ? 'Saving...' : 'Update Profile'}
                  </button>
                </form>

                {/* Seller signup */}
                <div className="mt-6 p-5 rounded-3xl border-2 border-dashed border-purple-200 text-center">
                  <p className="text-sm font-black text-purple-900 mb-1">Want to sell on Quirkify?</p>
                  <p className="text-xs text-purple-400 font-semibold mb-4">Join our seller community and start listing your products.</p>
                  <Link to="/seller/onboarding"
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-black text-white hover:opacity-90 transition-all"
                    style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}>
                    Become a Seller
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Top Up Modal */}
      <AnimatePresence>
        {showTopUp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowTopUp(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl border border-purple-100">
              <button onClick={() => setShowTopUp(false)} className="absolute top-5 right-5 p-2 rounded-full hover:bg-purple-50 text-purple-400">
                <X className="w-4 h-4" />
              </button>
              <h3 className="text-2xl font-black gradient-text mb-6">Top Up Wallet</h3>
              <div className="grid grid-cols-3 gap-3 mb-5">
                {[100, 500, 1000].map(amount => (
                  <button key={amount} onClick={() => setTopUpAmount(amount)} className={cn(
                    'py-3 rounded-2xl text-sm font-bold border-2 transition-all',
                    topUpAmount === amount ? 'border-purple-400 text-white' : 'border-purple-100 text-purple-500 hover:border-purple-300'
                  )} style={topUpAmount === amount ? { background: 'linear-gradient(135deg, #F472B6, #A855F7)', borderColor: 'transparent' } : {}}>
                    R{amount}
                  </button>
                ))}
              </div>
              <div className="mb-6">
                <label className="text-[9px] font-bold text-purple-400 uppercase tracking-widest block mb-1.5">Custom Amount</label>
                <input type="number" value={topUpAmount} onChange={e => setTopUpAmount(Number(e.target.value))} className="w-full p-3 bg-purple-50 border-2 border-purple-100 rounded-2xl text-lg font-bold text-purple-800 focus:outline-none focus:border-purple-400 transition-colors" />
              </div>
              {topUpError && (
                <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
                  {topUpError}
                </div>
              )}
              <button onClick={handleTopUp} className="btn-primary w-full py-4 text-sm justify-center">
                <CreditCard className="w-4 h-4" />
                Proceed to Yoco
              </button>
              <p className="text-[9px] text-purple-300 font-bold text-center mt-3">Secure payment via Yoco</p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
