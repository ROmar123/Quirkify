import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { UserProfile } from '../types';

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) {
    return { uid: userSnap.id, ...userSnap.data() } as UserProfile;
  }
  return null;
};

export const createOrUpdateProfile = async (uid: string, data: Partial<UserProfile>) => {
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    const newProfile: UserProfile = {
      uid,
      displayName: data.displayName || 'New Collector',
      email: data.email || '',
      photoURL: data.photoURL || '',
      stats: {
        itemsCollected: 0,
        auctionsWon: 0,
        totalBids: 0
      },
      badges: [],
      createdAt: new Date().toISOString(),
      ...data
    };
    await setDoc(userRef, newProfile);
  } else {
    await updateDoc(userRef, {
      ...data,
      updatedAt: serverTimestamp()
    });
  }
};

export const updateProfileStats = async (uid: string, stats: Partial<UserProfile['stats']>) => {
  const userRef = doc(db, 'users', uid);
  const updateData: Record<string, number> = {};
  if (stats.itemsCollected !== undefined) updateData['stats.itemsCollected'] = stats.itemsCollected;
  if (stats.auctionsWon !== undefined) updateData['stats.auctionsWon'] = stats.auctionsWon;
  if (stats.totalBids !== undefined) updateData['stats.totalBids'] = stats.totalBids;
  
  await updateDoc(userRef, updateData);
};
