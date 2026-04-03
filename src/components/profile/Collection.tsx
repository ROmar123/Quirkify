import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, getDoc, where, updateDoc, serverTimestamp, addDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../../firebase';

import { CollectionItem, Product, UserProgress, Auction, UserProfile } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Star, Shield, Zap, ArrowLeft, Gavel, Box, Bell, Settings, Wallet, CreditCard, User as UserIcon, LogOut, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { ensureUserProgress } from '../../services/gamificationService';
import { subscribeToNotifications, Notification, markAsRead, deleteNotification } from '../../services/notificationService';
import { getUserProfile, createOrUpdateProfile } from '../../services/userService';

import { uploadProfilePicture } from '../../services/storageService';
import { initiateYocoCheckout } from '../../services/paymentService';

type CollectionTab = 'vault' | 'bids' | 'notifications' | 'profile';

export default function Collection() {
  const [activeTab, setActiveTab] = useState<CollectionTab>('vault');
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [activeBids, setActiveBids] = useState<Auction[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [userProgress, setUserProgress] = useState<UserProgress | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showTopUp, setShowTopUp] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState(100);

  // Profile Form State
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');

  useEffect(() => {
    if (!auth.currentUser) return;

    const uid = auth.currentUser.uid;
    ensureUserProgress(uid).then(setUserProgress);
    getUserProfile(uid).then(p => {
      setProfile(p);
      if (p) {
        setDisplayName(p.displayName || '');
        setBio(p.bio || '');
        setLocation(p.location || '');
      }
    });

    // Vault Items
    const qVault = query(collection(db, 'users', uid, 'collection'));
    const unsubscribeVault = onSnapshot(qVault, async (snapshot) => {
      const collectionItems: CollectionItem[] = [];
      for (const d of snapshot.docs) {
        const itemData = d.data() as CollectionItem;
        const productRef = doc(db, 'products', itemData.productId);
        const productSnap = await getDoc(productRef);
        if (productSnap.exists()) {
          collectionItems.push({
            id: d.id,
            ...itemData,
            product: { id: productSnap.id, ...productSnap.data() } as Product
          });
        }
      }
      setItems(collectionItems);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${uid}/collection`);
      setLoading(false);
    });

    // Active Bids
    const qBids = query(
      collection(db, 'auctions'), 
      where('highestBidderId', '==', uid),
      where('status', '==', 'active')
    );
    const unsubscribeBids = onSnapshot(qBids, (snapshot) => {
      setActiveBids(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Auction)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'auctions');
    });

    // Notifications
    const unsubscribeNotifications = subscribeToNotifications(uid, setNotifications);

    return () => {
      unsubscribeVault();
      unsubscribeBids();
      unsubscribeNotifications();
    };
  }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    setSaving(true);
    try {
      await createOrUpdateProfile(auth.currentUser.uid, {
        displayName,
        bio,
        location
      });
      const p = await getUserProfile(auth.currentUser.uid);
      setProfile(p);
    } catch (error) {
      console.error('Failed to update profile:', error);
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
    } catch (error) {
      console.error('Failed to upload photo:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleTopUp = async () => {
    if (!auth.currentUser) return;
    try {
      // Create a pending top-up order
      const orderData = {
        userId: auth.currentUser.uid,
        userEmail: auth.currentUser.email,
        total: topUpAmount,
        status: 'pending_payment',
        createdAt: serverTimestamp(),
        orderType: 'topup'
      };

      const orderRef = await addDoc(collection(db, 'orders'), orderData);
      try {
        await initiateYocoCheckout(topUpAmount, 'Wallet Top Up', orderRef.id);
      } catch (paymentError: any) {
        console.error('Yoco Top-up initiation error:', paymentError);
        // We could show a toast or alert here
        throw new Error(`Top-up failed: ${paymentError.message}`);
      }
    } catch (error: any) {
      console.error('Failed to initiate top up:', error);
      // Handle firestore or other errors
      try {
        handleFirestoreError(error, OperationType.WRITE, 'orders');
      } catch (fErr) {
        // Fallback if handleFirestoreError is not what we want here
      }
    }
  };

  if (!auth.currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Please sign in to view your vault.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <Link to="/" className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400 hover:text-black mb-12 transition-colors">
        <ArrowLeft className="w-3 h-3" /> Back to Store
      </Link>

      <header className="mb-24 flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div>
          <h1 className="text-7xl md:text-9xl font-bold tracking-tighter mb-4 text-black leading-[0.8] font-display uppercase">
            THE <br />
            <span className="text-quirky italic">VAULT.</span>
          </h1>
          <p className="text-zinc-500 max-w-md text-[10px] font-bold uppercase tracking-[0.4em] mt-8">
            Your collection of unique digital and physical assets.
          </p>
        </div>

        <div className="flex flex-col items-end gap-6">
          <div className="flex bg-zinc-50 p-1 border border-zinc-100 overflow-x-auto no-scrollbar">
            <button 
              onClick={() => setActiveTab('vault')}
              className={cn(
                "px-6 py-2 text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap",
                activeTab === 'vault' ? "bg-black text-white" : "text-zinc-400 hover:text-black"
              )}
            >
              <Box className="w-3 h-3" />
              Vault ({items.length})
            </button>
            <button 
              onClick={() => setActiveTab('bids')}
              className={cn(
                "px-6 py-2 text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap",
                activeTab === 'bids' ? "bg-black text-white" : "text-zinc-400 hover:text-black"
              )}
            >
              <Gavel className="w-3 h-3" />
              Bids ({activeBids.length})
            </button>
            <button 
              onClick={() => setActiveTab('notifications')}
              className={cn(
                "px-6 py-2 text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap relative",
                activeTab === 'notifications' ? "bg-black text-white" : "text-zinc-400 hover:text-black"
              )}
            >
              <Bell className="w-3 h-3" />
              Alerts
              {notifications.some(n => !n.read) && (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-hot rounded-full" />
              )}
            </button>
            <button 
              onClick={() => setActiveTab('profile')}
              className={cn(
                "px-6 py-2 text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap",
                activeTab === 'profile' ? "bg-black text-white" : "text-zinc-400 hover:text-black"
              )}
            >
              <Settings className="w-3 h-3" />
              Profile
            </button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
        {/* Wallet Sidebar */}
        <div className="lg:col-span-1 space-y-8">
          <div className="bg-black text-white p-8 border-l-8 border-quirky">
            <div className="flex items-center justify-between mb-6">
              <Wallet className="w-5 h-5 text-quirky" />
              <span className="text-[8px] font-bold uppercase tracking-widest text-zinc-500">Quirkify Wallet</span>
            </div>
            <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Available Balance</p>
            <p className="text-4xl font-bold font-display mb-8">R{userProgress?.balance || 0}</p>
            
            <div className="space-y-4">
              <button 
                onClick={() => setShowTopUp(true)}
                className="w-full py-3 bg-quirky text-white text-[10px] font-bold uppercase tracking-widest hover:bg-white hover:text-black transition-all flex items-center justify-center gap-2"
              >
                <CreditCard className="w-3 h-3" />
                Top Up
              </button>
              <p className="text-[6px] text-zinc-500 uppercase font-bold text-center">Secure payments via Yoco</p>
            </div>
          </div>

          {/* Top Up Modal */}
          <AnimatePresence>
            {showTopUp && (
              <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowTopUp(false)}
                  className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                />
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 20 }}
                  className="relative w-full max-w-md bg-white p-12 shadow-2xl border-l-[12px] border-quirky"
                >
                  <button 
                    onClick={() => setShowTopUp(false)}
                    className="absolute top-6 right-6 text-zinc-400 hover:text-black"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  
                  <h3 className="text-4xl font-bold tracking-tighter uppercase mb-8 font-display">TOP UP <span className="text-quirky">WALLET.</span></h3>
                  
                  <div className="space-y-8">
                    <div>
                      <label className="block text-[8px] font-bold text-zinc-400 uppercase tracking-widest mb-4">Select Amount (ZAR)</label>
                      <div className="grid grid-cols-3 gap-4">
                        {[100, 500, 1000].map(amount => (
                          <button
                            key={amount}
                            onClick={() => setTopUpAmount(amount)}
                            className={cn(
                              "py-4 text-xs font-bold transition-all border",
                              topUpAmount === amount ? "bg-black text-white border-black" : "bg-zinc-50 text-zinc-400 border-zinc-100 hover:border-black hover:text-black"
                            )}
                          >
                            R{amount}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-[8px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Custom Amount</label>
                      <input 
                        type="number" 
                        value={topUpAmount}
                        onChange={(e) => setTopUpAmount(Number(e.target.value))}
                        className="w-full px-4 py-4 bg-zinc-50 border border-zinc-100 text-xl font-bold focus:outline-none focus:border-quirky transition-colors"
                      />
                    </div>

                    <button 
                      onClick={handleTopUp}
                      className="w-full py-4 bg-black text-white text-[10px] font-bold uppercase tracking-widest hover:bg-quirky transition-all flex items-center justify-center gap-2"
                    >
                      <CreditCard className="w-4 h-4" />
                      Proceed to Yoco
                    </button>
                    
                    <p className="text-[8px] text-zinc-400 uppercase font-bold text-center leading-relaxed">
                      You will be redirected to Yoco to complete your transaction securely.
                    </p>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          <div className="bg-zinc-50 p-8 border border-zinc-100">
            <h3 className="text-[10px] font-bold uppercase tracking-widest mb-6 text-zinc-400">Collector Stats</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-[8px] font-bold uppercase tracking-widest text-zinc-500">XP Progress</span>
                <span className="text-[8px] font-bold">{userProgress?.xp || 0} XP</span>
              </div>
              <div className="h-1 bg-zinc-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-quirky transition-all duration-1000" 
                  style={{ width: `${(userProgress?.xp || 0) % 100}%` }} 
                />
              </div>
              <div className="flex justify-between items-center pt-4 border-t border-zinc-200">
                <span className="text-[8px] font-bold uppercase tracking-widest text-zinc-500">Collection Value</span>
                <span className="text-[10px] font-bold">R{items.reduce((acc, item) => acc + item.purchasePrice, 0)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="lg:col-span-3">
          <AnimatePresence mode="wait">
            {activeTab === 'vault' && (
              <motion.div
                key="vault"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                {loading ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {[1, 2, 3].map(i => (
                      <div key={`skeleton-${i}`} className="aspect-[3/4] bg-zinc-50 animate-pulse" />
                    ))}
                  </div>
                ) : items.length === 0 ? (
                  <div className="text-center py-32 border border-zinc-100 bg-zinc-50">
                    <Shield className="w-12 h-12 mx-auto mb-4 text-zinc-300" />
                    <p className="text-zinc-400 font-bold uppercase tracking-widest text-xs">Your vault is empty. Start bidding!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {items.map((item) => (
                      <motion.div 
                        key={item.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="group relative"
                      >
                        <div className={cn(
                          "aspect-[3/4] overflow-hidden mb-6 relative border-2 transition-all duration-500 group-hover:shadow-2xl",
                          item.product?.rarity === 'Unique' ? 'border-cyber shadow-cyber/20' : 
                          item.product?.rarity === 'Super Rare' ? 'border-hot shadow-hot/20' : 
                          item.product?.rarity === 'Rare' ? 'border-quirky shadow-quirky/20' : 'border-zinc-100'
                        )}>
                          <img 
                            src={item.product?.imageUrl} 
                            className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700"
                            alt=""
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent p-6 flex flex-col justify-end">
                            <p className="text-white text-[10px] font-bold uppercase tracking-widest mb-1">{item.product?.rarity}</p>
                            <h3 className="text-white text-lg font-bold uppercase tracking-tight font-display">{item.product?.name}</h3>
                          </div>
                        </div>
                        <div className="flex items-center justify-between px-2">
                          <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest">#{item.product?.serialNumber || '000'}</span>
                          <span className="text-[10px] font-bold text-quirky">R{item.purchasePrice}</span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'bids' && (
              <motion.div
                key="bids"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                {activeBids.length === 0 ? (
                  <div className="text-center py-32 border border-zinc-100 bg-zinc-50">
                    <Gavel className="w-12 h-12 mx-auto mb-4 text-zinc-300" />
                    <p className="text-zinc-400 font-bold uppercase tracking-widest text-xs">You are not winning any auctions currently.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {activeBids.map((auction) => (
                      <div key={auction.id} className="p-6 bg-white border border-zinc-100 flex gap-6 group">
                        <div className="w-32 h-32 bg-zinc-50 border border-zinc-100 overflow-hidden flex-shrink-0">
                          <img src={auction.product?.imageUrl} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all" alt="" referrerPolicy="no-referrer" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-4">
                            <span className="px-2 py-0.5 bg-green-50 text-green-600 text-[6px] font-bold uppercase tracking-widest border border-green-100">Winning</span>
                            <span className="text-[8px] font-bold text-zinc-400 uppercase">Ends {new Date(auction.endTime).toLocaleDateString()}</span>
                          </div>
                          <h4 className="font-bold text-sm uppercase tracking-tight truncate mb-2">{auction.product?.name}</h4>
                          <div className="p-3 bg-zinc-50 border border-zinc-100">
                            <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Your Hold Amount</p>
                            <p className="text-xl font-bold text-black">R{auction.currentBid}</p>
                          </div>
                          <Link to="/auctions" className="mt-4 inline-block text-[8px] font-bold uppercase tracking-widest text-quirky hover:underline">View Auction</Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'notifications' && (
              <motion.div
                key="notifications"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                {notifications.length === 0 ? (
                  <div className="text-center py-32 border border-zinc-100 bg-zinc-50">
                    <Bell className="w-12 h-12 mx-auto mb-4 text-zinc-300" />
                    <p className="text-zinc-400 font-bold uppercase tracking-widest text-xs">No alerts at this time.</p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div 
                      key={n.id} 
                      className={cn(
                        "p-6 border flex items-start justify-between group transition-all",
                        n.read ? "bg-white border-zinc-100" : "bg-quirky/5 border-quirky/20"
                      )}
                    >
                      <div className="flex items-start gap-4">
                        <div className={cn(
                          "w-10 h-10 flex items-center justify-center rounded-none",
                          n.type === 'outbid' ? "bg-hot/10 text-hot" : "bg-quirky/10 text-quirky"
                        )}>
                          {n.type === 'outbid' ? <Zap className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
                        </div>
                        <div>
                          <h4 className="font-bold text-xs uppercase tracking-tight mb-1">{n.title}</h4>
                          <p className="text-zinc-500 text-[10px] leading-relaxed mb-3">{n.message}</p>
                          <div className="flex items-center gap-4">
                            <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest">
                              {new Date(n.createdAt?.seconds * 1000).toLocaleString()}
                            </span>
                            {n.link && (
                              <Link to={n.link} className="text-[8px] font-bold text-quirky uppercase tracking-widest hover:underline">View Details</Link>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!n.read && (
                          <button onClick={() => markAsRead(n.id)} className="p-2 hover:bg-zinc-100 text-zinc-400 hover:text-black transition-colors">
                            <Star className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={() => deleteNotification(n.id)} className="p-2 hover:bg-zinc-100 text-zinc-400 hover:text-red-500 transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </motion.div>
            )}

            {activeTab === 'profile' && (
              <motion.div
                key="profile"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <form onSubmit={handleUpdateProfile} className="max-w-xl space-y-8">
                  <div className="flex items-center gap-8 mb-12">
                    <div className="w-24 h-24 bg-zinc-100 border border-zinc-200 flex items-center justify-center relative group overflow-hidden">
                      {profile?.photoURL ? (
                        <img src={profile.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <UserIcon className="w-8 h-8 text-zinc-300" />
                      )}
                      <label className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                        <input 
                          type="file" 
                          className="hidden" 
                          accept="image/*"
                          onChange={handlePhotoUpload}
                          disabled={uploading}
                        />
                        <span className="text-[8px] font-bold text-white uppercase tracking-widest">
                          {uploading ? '...' : 'Change'}
                        </span>
                      </label>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold tracking-tighter uppercase font-display">{profile?.displayName || 'Collector'}</h3>
                      <p className="text-zinc-400 text-[8px] font-bold uppercase tracking-widest">{auth.currentUser?.email}</p>
                      <Link 
                        to={`/profile/${auth.currentUser?.uid}`} 
                        className="mt-2 inline-block text-[8px] font-bold text-quirky uppercase tracking-widest hover:underline"
                      >
                        View Public Profile
                      </Link>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <label className="block text-[8px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Display Name</label>
                      <input 
                        type="text" 
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="w-full px-4 py-3 bg-zinc-50 border border-zinc-100 text-xs font-bold focus:outline-none focus:border-quirky transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-[8px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Bio</label>
                      <textarea 
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        rows={4}
                        className="w-full px-4 py-3 bg-zinc-50 border border-zinc-100 text-xs font-bold focus:outline-none focus:border-quirky transition-colors resize-none"
                        placeholder="Tell the community about your collection strategy..."
                      />
                    </div>
                    <div>
                      <label className="block text-[8px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Location</label>
                      <input 
                        type="text" 
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        className="w-full px-4 py-3 bg-zinc-50 border border-zinc-100 text-xs font-bold focus:outline-none focus:border-quirky transition-colors"
                        placeholder="e.g. Cape Town, SA"
                      />
                    </div>
                  </div>

                  <div className="pt-8 border-t border-zinc-100">
                    <button 
                      type="submit"
                      disabled={saving}
                      className="px-12 py-4 bg-black text-white text-[10px] font-bold uppercase tracking-widest hover:bg-quirky transition-all disabled:bg-zinc-100 disabled:text-zinc-400"
                    >
                      {saving ? 'SAVING...' : 'UPDATE PROFILE'}
                    </button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
