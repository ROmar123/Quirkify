import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, addDoc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, onSnapshot, query, where, orderBy, limit, serverTimestamp, increment, runTransaction, writeBatch } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from './supabase';

const firebaseConfig = {
  apiKey: "AIzaSyDZ5wLauYYVERxEfcdOGOZ8GNI2Qvjf9RM",
  authDomain: "gen-lang-client-0358761247.firebaseapp.com",
  projectId: "gen-lang-client-0358761247",
  storageBucket: "gen-lang-client-0358761247.firebasestorage.app",
  messagingSenderId: "24353526972",
  appId: "1:24353526972:web:f80463794cd97f98b9ecb9"
};

const app = initializeApp(firebaseConfig);
const _db = getFirestore(app);
const _storage = getStorage(app);

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

// Keep this alias for components that import `type AuthUser`
export type { AuthUser as User };

type AuthListener = (user: AuthUser | null) => void;

let currentUser: AuthUser | null = null;
let authReady = false;
const listeners = new Set<AuthListener>();

function mapSupabaseUser(user: SupabaseUser | null): AuthUser | null {
  if (!user) return null;
  const metadata = user.user_metadata ?? {};
  return {
    uid: user.id,
    email: user.email ?? null,
    displayName:
      metadata.display_name ??
      metadata.full_name ??
      metadata.name ??
      metadata.user_name ??
      null,
    photoURL: metadata.avatar_url ?? metadata.picture ?? null,
  };
}

function emitAuthState(user: AuthUser | null) {
  currentUser = user;
  authReady = true;
  listeners.forEach((listener) => listener(user));
}

void supabase.auth.getUser().then(({ data }) => {
  emitAuthState(mapSupabaseUser(data?.user ?? null));
});

supabase.auth.onAuthStateChange((_event, session) => {
  emitAuthState(mapSupabaseUser(session?.user ?? null));
});

export const auth = {
  get currentUser() {
    return currentUser;
  },
};

export function onAuthStateChanged(_authInstance: typeof auth, callback: AuthListener) {
  listeners.add(callback);
  if (authReady) {
    callback(currentUser);
  }
  return () => {
    listeners.delete(callback);
  };
}

export async function signIn(nextPath?: string) {
  const next =
    typeof window !== 'undefined'
      ? `${window.location.origin}/auth?next=${encodeURIComponent(nextPath ?? window.location.pathname + window.location.search)}`
      : undefined;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: next ? { redirectTo: next } : undefined,
  });

  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function signInWithPassword(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signUpWithPassword(email: string, password: string, displayName?: string, nextPath?: string) {
  const redirectTo =
    typeof window !== 'undefined'
      ? `${window.location.origin}/auth?next=${encodeURIComponent(nextPath ?? '/')}`
      : undefined;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: displayName ? { display_name: displayName } : undefined,
      emailRedirectTo: redirectTo,
    },
  });

  if (error) throw error;
  return data;
}

export async function sendMagicLink(email: string, nextPath?: string) {
  const redirectTo =
    typeof window !== 'undefined'
      ? `${window.location.origin}/auth?next=${encodeURIComponent(nextPath ?? '/')}`
      : undefined;

  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo },
  });

  if (error) throw error;
  return data;
}

export async function getRedirectResult() {
  return { data: { user: currentUser }, error: null };
}

// Firestore
export const db = _db;
export const isFirebaseConfigured = true;

export {
  addDoc, setDoc, getDoc, getDocs, updateDoc, deleteDoc,
  onSnapshot, collection, doc, query, where, orderBy, limit,
  serverTimestamp, increment, runTransaction, writeBatch,
};

// Storage
export const storage = _storage;
export { ref, uploadBytes, getDownloadURL };

export enum OperationType {
  CREATE = 'create',
  GET = 'get',
  LIST = 'list',
  UPDATE = 'update',
  WRITE = 'write',
  DELETE = 'delete',
  LISTEN = 'listen',
}

export function handleFirestoreError(error: unknown, operation: OperationType, resource: string): void {
  const code = (error as { code?: string }).code ?? 'unknown';
  const msgs: Record<string, string> = {
    'permission-denied': `Permission denied on ${operation} for ${resource}`,
    'not-found': `${resource} not found`,
    'unavailable': 'Service unavailable — check connection',
    'deadline-exceeded': 'Request timed out',
    'unknown': `Firestore error (${operation} on ${resource})`,
  };
  console.error(`[Firestore] [${operation.toUpperCase()}] ${resource}:`, msgs[code] ?? msgs.unknown, error);
}

export default app;
