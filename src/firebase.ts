import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut, onAuthStateChanged, getRedirectResult, User } from 'firebase/auth';
import { getFirestore, collection, doc, addDoc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, onSnapshot, query, where, orderBy, limit, serverTimestamp, increment } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyDZ5wLauYYVERxEfcdOGOZ8GNI2Qvjf9RM",
  authDomain: "gen-lang-client-0358761247.firebaseapp.com",
  projectId: "gen-lang-client-0358761247",
  storageBucket: "gen-lang-client-0358761247.firebasestorage.app",
  messagingSenderId: "24353526972",
  appId: "1:24353526972:web:f80463794cd97f98b9ecb9"
};

const app = initializeApp(firebaseConfig);
const _auth = getAuth(app);
const _db = getFirestore(app);
const _storage = getStorage(app);

// Auth
export const auth = _auth;
export const googleProvider = new GoogleAuthProvider();
export const signIn = () => signInWithPopup(_auth, googleProvider);
export const signOut = () => firebaseSignOut(_auth);
export { onAuthStateChanged, getRedirectResult };
export type { User };

// Firestore
export const db = _db;
export { addDoc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, onSnapshot, collection, doc, query, where, orderBy, limit, serverTimestamp, increment };

// Storage
export const storage = _storage;
export { ref, uploadBytes, getDownloadURL };

// Utilities
export enum OperationType {
  GET = 'get',
  WRITE = 'write',
  DELETE = 'delete',
  LISTEN = 'listen',
}

export function handleFirestoreError(error: unknown, operation: OperationType, collection: string): void {
  const code = (error as { code?: string }).code ?? 'unknown';
  const msgs: Record<string, string> = {
    'permission-denied': `Permission denied on ${operation} for ${collection}`,
    'not-found': `${collection} not found`,
    'invalid-argument': `Invalid argument for ${operation} on ${collection}`,
    'unavailable': 'Service unavailable — check connection',
    'deadline-exceeded': 'Request timed out',
    'already-exists': 'Record already exists',
    'resource-exhausted': 'Quota exceeded',
    'cancelled': 'Operation cancelled',
    'unknown': `Firestore error (${operation} on ${collection})`,
  };
  console.error(`[Firestore] [${operation.toUpperCase()}] ${collection}:`, msgs[code] ?? msgs.unknown, error);
}

export default app;
