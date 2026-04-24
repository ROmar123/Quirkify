import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  sendSignInLinkToEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';
import { normalizeEnvValue } from './lib/env';

export type AuthUser = User;
export enum OperationType {
  GET = 'get',
  CREATE = 'create',
  WRITE = 'write',
  DELETE = 'delete',
}

const firebaseConfig = {
  apiKey: normalizeEnvValue(import.meta.env.VITE_FIREBASE_API_KEY) || 'missing-firebase-api-key',
  authDomain: normalizeEnvValue(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN) || 'missing-firebase-auth-domain',
  projectId: normalizeEnvValue(import.meta.env.VITE_FIREBASE_PROJECT_ID) || 'missing-firebase-project-id',
  storageBucket: normalizeEnvValue(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET) || 'missing-firebase-storage-bucket',
  messagingSenderId: normalizeEnvValue(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID) || 'missing-firebase-sender-id',
  appId: normalizeEnvValue(import.meta.env.VITE_FIREBASE_APP_ID) || 'missing-firebase-app-id',
};

export const isFirebaseConfigured = Boolean(
  normalizeEnvValue(import.meta.env.VITE_FIREBASE_API_KEY) &&
    normalizeEnvValue(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN) &&
    normalizeEnvValue(import.meta.env.VITE_FIREBASE_PROJECT_ID) &&
    normalizeEnvValue(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET) &&
    normalizeEnvValue(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID) &&
    normalizeEnvValue(import.meta.env.VITE_FIREBASE_APP_ID),
);

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
const provider = new GoogleAuthProvider();

export const onAuthStateChanged = firebaseOnAuthStateChanged;

export async function signIn(nextPath?: string) {
  const result = await signInWithPopup(auth, provider);
  if (nextPath && typeof window !== 'undefined') {
    window.localStorage.setItem('quirkify-next-path', nextPath);
  }
  return result;
}

export async function signOut() {
  await firebaseSignOut(auth);
}

export async function signInWithPassword(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signUpWithPassword(email: string, password: string, displayName?: string) {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName) {
    await updateProfile(credential.user, { displayName });
  }
  return credential;
}

export async function sendMagicLink(email: string, nextPath?: string) {
  const redirectUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/auth${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ''}`
      : undefined;
  await sendSignInLinkToEmail(auth, email, {
    url: redirectUrl || 'http://localhost:3000/auth',
    handleCodeInApp: true,
  });
  if (typeof window !== 'undefined') {
    window.localStorage.setItem('quirkify-email-link', email);
  }
  return { sent: true };
}

export async function getRedirectResult() {
  return { data: { user: auth.currentUser }, error: null };
}

export function handleFirestoreError(error: unknown, _operation: OperationType, resource: string): never {
  const message = error instanceof Error ? error.message : 'Unknown Firestore error';
  throw new Error(`${resource}: ${message}`);
}

export {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  ref,
  uploadBytes,
  getDownloadURL,
};

export default app;
