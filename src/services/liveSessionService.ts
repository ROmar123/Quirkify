// Live session management — currently on Firestore.
// Per CLAUDE.md, the live-streaming feature is a UI prototype with no real
// WebRTC backend, so this service is kept simple and isolated. Migrate to
// Supabase (new `live_sessions` table) once the live-stream feature ships.

import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
  type DocumentSnapshot,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase';
import type { LiveSession } from '../types';

function fromSnapshot<T>(snapshot: DocumentSnapshot) {
  return { id: snapshot.id, ...snapshot.data() } as T;
}

export async function listLiveSessions() {
  if (!isFirebaseConfigured) return [];
  const snapshot = await getDocs(
    query(collection(db, 'liveSessions'), orderBy('createdAt', 'desc'), limit(20)),
  );
  return snapshot.docs.map((item) => fromSnapshot<LiveSession>(item));
}

export async function createLiveSession(session: LiveSession) {
  if (!isFirebaseConfigured) {
    throw new Error('Realtime live sessions are not configured right now');
  }
  await setDoc(doc(db, 'liveSessions', session.id), session);
  return session;
}

export async function advanceLiveSession(
  sessionId: string,
  currentAuctionId: string | null,
  spotlightMessage?: string,
) {
  if (!isFirebaseConfigured) {
    throw new Error('Realtime live sessions are not configured right now');
  }
  await updateDoc(doc(db, 'liveSessions', sessionId), {
    currentAuctionId,
    spotlightMessage: spotlightMessage || null,
    status: 'live',
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}
