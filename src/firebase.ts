// Firebase stub — replaced by Supabase Auth + Storage
// This file exists so existing imports don't break during migration
import { createClient } from '@supabase/supabase-js';

export const firebaseInitialized = true;
export const auth = null as any;
export const db = null as any;
export const storage = null as any;
export const app = null as any;

export const signIn = () => { throw new Error('Firebase signIn deprecated — use AuthModal'); };
export const signOut = async () => {
  const { signOut: sbSignOut } = await import('./services/authService');
  await sbSignOut();
};
export const GoogleAuthProvider = null as any;
export const OperationType = { ADD: 'add', MODIFY: 'modify', REMOVE: 'remove' } as const;

export function handleFirestoreError(error: any): never {
  const mapping: Record<string, string> = {
    'Network error': 'Network error. Check your connection.',
    'Too many requests': 'Too many attempts. Try again later.',
  };
  const msg = mapping[error?.message] || error?.message || 'An unexpected error occurred.';
  throw new Error(msg);
}

export const collection = () => null;
export const doc = () => null;
export const getDoc = async () => ({ data: () => null, exists: () => false });
export const getDocs = async () => ({ docs: [] });
export const setDoc = async () => {};
export const addDoc = async () => ({ id: '' });
export const updateDoc = async () => {};
export const deleteDoc = async () => {};
export const onSnapshot = (_ref: any, _cb: any) => () => {};
export const query = (ref: any) => ref;
export const where = (field: string, op: string, value: any) => ({ field, op, value });
export const orderBy = (field: string, dir?: string) => ({ field, dir });
export const limit = (n: number) => n;
export const serverTimestamp = () => new Date().toISOString();
export const increment = (n: number) => n;
export const deleteField = () => null;
export const writeBatch = () => ({ set: () => {}, commit: async () => {} });
export const DocumentReference = null as any;

export const ref = (_storage: any, path: string) => path;
export const uploadBytes = async (_ref: any, data: any) => ({ bytes: data.length });
export const getDownloadURL = (_ref: any) => Promise.resolve(_ref);
