import {
  addDoc,
  collection,
  doc,
  type DocumentSnapshot,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '../firebase';
import type { Auction, Bid, LiveSession, Product } from '../types';

function fromSnapshot<T>(snapshot: DocumentSnapshot) {
  return { id: snapshot.id, ...snapshot.data() } as T;
}

function toRealtimeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : 'Realtime auction data is unavailable';
  return message || 'Realtime auction data is unavailable';
}

export function subscribeToAuctions(
  callback: (auctions: Auction[]) => void,
  onError?: (message: string) => void,
) {
  if (!isFirebaseConfigured) {
    callback([]);
    onError?.('Realtime auctions are not configured for this environment.');
    return () => undefined;
  }

  return onSnapshot(
    query(collection(db, 'auctions'), orderBy('startsAt', 'asc'), limit(40)),
    (snapshot) => callback(snapshot.docs.map((item) => fromSnapshot<Auction>(item))),
    (error) => {
      callback([]);
      onError?.(toRealtimeErrorMessage(error));
    },
  );
}

export async function listAuctions() {
  if (!isFirebaseConfigured) {
    return [];
  }
  const snapshot = await getDocs(query(collection(db, 'auctions'), orderBy('startsAt', 'asc'), limit(40)));
  return snapshot.docs.map((item) => fromSnapshot<Auction>(item));
}

export async function listAuctionsByCreator(createdBy: string) {
  if (!isFirebaseConfigured) {
    return [];
  }
  const snapshot = await getDocs(
    query(
      collection(db, 'auctions'),
      where('createdBy', '==', createdBy),
      orderBy('startsAt', 'desc'),
      limit(12),
    ),
  );
  return snapshot.docs.map((item) => fromSnapshot<Auction>(item));
}

export function subscribeToBids(auctionId: string, callback: (bids: Bid[]) => void) {
  if (!isFirebaseConfigured) {
    callback([]);
    return () => undefined;
  }

  return onSnapshot(
    query(collection(db, 'auctions', auctionId, 'bids'), orderBy('amount', 'desc'), limit(25)),
    (snapshot) => callback(snapshot.docs.map((item) => fromSnapshot<Bid>(item)))
  );
}

export async function placeBid(auctionId: string, amount: number) {
  if (!isFirebaseConfigured) {
    return { error: new Error('Realtime bidding is not configured right now') };
  }

  const user = auth.currentUser;
  if (!user) {
    return { error: new Error('Sign in to bid') };
  }

  try {
    await runTransaction(db, async (transaction) => {
      const auctionRef = doc(db, 'auctions', auctionId);
      const auctionSnapshot = await transaction.get(auctionRef);
      if (!auctionSnapshot.exists()) {
        throw new Error('Auction not found');
      }

      const auction = fromSnapshot<Auction>(auctionSnapshot);
      if (auction.status !== 'live') {
        throw new Error('Auction is not live');
      }

      const minimum = Math.max(auction.startPrice, auction.currentBid) + auction.increment;
      if (amount < minimum) {
        throw new Error(`Minimum bid is R${minimum}`);
      }

      const bidRef = doc(collection(db, 'auctions', auctionId, 'bids'));
      transaction.set(bidRef, {
        auctionId,
        bidderId: user.uid,
        bidderName: user.displayName || user.email || 'Bidder',
        amount,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      transaction.update(auctionRef, {
        currentBid: amount,
        highestBidderId: user.uid,
        bidCount: (auction.bidCount || 0) + 1,
        updatedAt: new Date().toISOString(),
      });
    });

    return { error: null };
  } catch (error) {
    return { error: error instanceof Error ? error : new Error('Failed to place bid') };
  }
}

export async function createAuctionFromProduct(params: {
  product: Product;
  startsAt: string;
  endsAt: string;
  startPrice: number;
  reservePrice?: number;
  increment?: number;
  createdBy: string;
}) {
  if (!isFirebaseConfigured) {
    throw new Error('Realtime auctions are not configured right now');
  }

  const auctionRef = doc(collection(db, 'auctions'));
  const auction: Auction = {
    id: auctionRef.id,
    productId: params.product.id,
    title: params.product.title,
    heroImage: params.product.media[0]?.url,
    status: new Date(params.startsAt).getTime() <= Date.now() ? 'live' : 'scheduled',
    startsAt: params.startsAt,
    endsAt: params.endsAt,
    currentBid: params.startPrice,
    startPrice: params.startPrice,
    reservePrice: params.reservePrice,
    increment: params.increment || 50,
    bidCount: 0,
    highestBidderId: null,
    winnerOrderId: null,
    channelReservationQuantity: 1,
    createdBy: params.createdBy,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await setDoc(auctionRef, auction);
  return auction;
}

export async function createAuction(params: {
  product: Product;
  productId?: string;
  startsAt?: string;
  endsAt?: string;
  startTime?: string;
  endTime?: string;
  startPrice: number;
  reservePrice?: number;
  increment?: number;
  createdBy?: string;
  sellerId?: string;
}) {
  return createAuctionFromProduct({
    product: params.product,
    startsAt: params.startsAt || params.startTime || new Date().toISOString(),
    endsAt: params.endsAt || params.endTime || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    startPrice: params.startPrice,
    reservePrice: params.reservePrice,
    increment: params.increment,
    createdBy: params.createdBy || params.sellerId || auth.currentUser?.uid || 'admin',
  });
}

export async function listLiveSessions() {
  if (!isFirebaseConfigured) {
    return [];
  }
  const snapshot = await getDocs(query(collection(db, 'liveSessions'), orderBy('createdAt', 'desc'), limit(20)));
  return snapshot.docs.map((item) => fromSnapshot<LiveSession>(item));
}

export async function createLiveSession(session: LiveSession) {
  if (!isFirebaseConfigured) {
    throw new Error('Realtime live sessions are not configured right now');
  }
  await setDoc(doc(db, 'liveSessions', session.id), session);
  return session;
}

export async function advanceLiveSession(sessionId: string, currentAuctionId: string | null, spotlightMessage?: string) {
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

export async function closeAuction(auctionId: string) {
  const response = await fetch('/api/commerce/auction-close', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ auctionId }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to close auction');
  }
  return data;
}
