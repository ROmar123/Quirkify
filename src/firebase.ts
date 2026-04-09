import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInWithRedirect, signOut as firebaseSignOut, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, onSnapshot, query, where, orderBy, limit, serverTimestamp, increment, deleteField, writeBatch, DocumentReference } from 'firebase/firestore';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyBd8oWE3GOXHulfOXV4EfcdOGOZ8GNI2Qvjf9RM",
  authDomain: "quirkify-95aea.firebaseapp.com",
  projectId: "quirkify-95aea",
  storageBucket: "quirkify-95aea.appspot.com",
  messagingSenderId: "942255680782",
  appId: "1:942255680782:web:6483f0ef80a1f40d2d91eb",
  databaseURL: "https://quirkify-95aea-default-rtdb.firebaseio.com"
};

let app, auth, db, storage;

try {
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
  auth.useDeviceLanguage();
} catch (e) {
  console.warn('[Firebase] Init failed:', e);
}

export const firebaseInitialized = !!(auth && db);
export { app, auth, db, storage };
export const signIn = signInWithRedirect;
export { firebaseSignOut as signOut };
export { GoogleAuthProvider };

export const OperationType = {
  ADD: 'add',
  MODIFY: 'modify',
  REMOVE: 'remove',
} as const;

export function handleFirestoreError(error: any): never {
  const mapping: Record<string, string> = {
    'auth/network-request-failed': 'Network error. Check your connection.',
    'auth/too-many-requests': 'Too many attempts. Try again later.',
    'auth/user-disabled': 'Account disabled. Contact support.',
    'auth/operation-not-allowed': 'Operation not allowed.',
    'auth/unauthorized-domain': 'This domain is not authorized.',
    'auth/invalid-api-key': 'Firebase config error. Contact support.',
    'firestore/permission-denied': 'Access denied.',
    'firestore/not-found': 'Data not found.',
    'firestore/already-exists': 'Item already exists.',
    'firestore/resource-exhausted': 'Quota exceeded. Try again later.',
    'firestore/unavailable': 'Service temporarily unavailable.',
  };
  const msg = mapping[error?.code] || error?.message || 'An unexpected error occurred.';
  throw new Error(msg);
}

export { collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, onSnapshot, query, where, orderBy, limit, serverTimestamp, increment, deleteField, writeBatch, DocumentReference };
export { ref as storageRef, uploadBytes, getDownloadURL };
