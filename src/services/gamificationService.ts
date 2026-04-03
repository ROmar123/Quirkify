import { doc, getDoc, setDoc, updateDoc, increment, serverTimestamp, collection, addDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { UserProgress, Rarity, Product } from '../types';

export const INITIAL_PROGRESS: Omit<UserProgress, 'uid'> = {
  xp: 0,
  level: 1,
  balance: 1000, // Starting balance for gamification
  collectionCount: 0,
  badges: ['Newcomer'],
  lastActive: new Date().toISOString(),
};

export async function ensureUserProgress(uid: string) {
  const progressRef = doc(db, 'user_progress', uid);
  const snap = await getDoc(progressRef);
  
  if (!snap.exists()) {
    await setDoc(progressRef, {
      uid,
      ...INITIAL_PROGRESS,
      lastActive: serverTimestamp(),
    });
    return { uid, ...INITIAL_PROGRESS };
  }
  
  return { uid, ...snap.data() } as UserProgress;
}

export async function addXP(uid: string, amount: number) {
  const progressRef = doc(db, 'user_progress', uid);
  const snap = await getDoc(progressRef);
  
  if (snap.exists()) {
    const data = snap.data() as UserProgress;
    const newXP = data.xp + amount;
    const newLevel = Math.floor(Math.sqrt(newXP / 100)) + 1;
    
    await updateDoc(progressRef, {
      xp: increment(amount),
      level: newLevel,
      lastActive: serverTimestamp(),
    });
    
    if (newLevel > data.level) {
      // Level up logic (e.g., unlock badge)
      console.log(`Level up! New level: ${newLevel}`);
    }
  }
}

export async function updateBalance(uid: string, amount: number) {
  const progressRef = doc(db, 'user_progress', uid);
  await updateDoc(progressRef, {
    balance: increment(amount),
    lastActive: serverTimestamp(),
  });
}

export async function addToCollection(uid: string, product: Product, price: number) {
  const collectionRef = collection(db, 'users', uid, 'collection');
  await addDoc(collectionRef, {
    ownerId: uid,
    productId: product.id,
    acquiredAt: serverTimestamp(),
    purchasePrice: price,
  });
  
  const progressRef = doc(db, 'user_progress', uid);
  await updateDoc(progressRef, {
    collectionCount: increment(1),
    xp: increment(50), // XP for adding to collection
  });
}

export const RARITY_COLORS: { [key in Rarity]: string } = {
  'Common': 'text-zinc-400',
  'Limited': 'text-blue-500',
  'Rare': 'text-quirky',
  'Super Rare': 'text-hot',
  'Unique': 'text-cyber',
};

export const RARITY_BG: { [key in Rarity]: string } = {
  'Common': 'bg-zinc-100',
  'Limited': 'bg-blue-50',
  'Rare': 'bg-quirky/10',
  'Super Rare': 'bg-hot/10',
  'Unique': 'bg-cyber/20',
};
