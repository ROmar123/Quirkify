import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  type DocumentData,
  type QuerySnapshot,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { supabase } from '../supabase';
import type { Auction, Bid, Product } from '../types';

type AuctionDraft = Pick<Auction, 'productId' | 'sellerId' | 'startPrice' | 'startTime' | 'endTime'>;

function mapBid(id: string, data: DocumentData): Bid {
  const timestampValue = data.timestamp?.toDate?.();
  return {
    id,
    auctionId: data.auctionId,
    bidderId: data.bidderId,
    amount: Number(data.amount ?? 0),
    timestamp: timestampValue ? timestampValue.toISOString() : data.timestamp ?? new Date().toISOString(),
  };
}

async function attachProducts(snapshot: QuerySnapshot<DocumentData>): Promise<Auction[]> {
  const auctions = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })) as Auction[];
  const productIds = [...new Set(auctions.map((auction) => auction.productId).filter(Boolean))];

  const products = new Map<string, Product>();
  if (productIds.length > 0) {
    const { data } = await supabase
      .from('products')
      .select('*')
      .in('id', productIds);
    (data ?? []).forEach((row: any) => {
      products.set(row.id, {
        id: row.id,
        name: row.name,
        description: row.description,
        category: row.category,
        condition: row.condition,
        status: row.status,
        listingType: row.listing_type,
        retailPrice: Number(row.retail_price),
        discountPrice: Number(row.discount_price),
        markdownPercentage: row.markdown_percentage,
        stock: row.stock,
        totalStock: row.stock,
        allocations: { store: row.alloc_store, auction: row.alloc_auction, packs: row.alloc_packs },
        imageUrl: row.image_url,
        imageUrls: row.image_urls || [],
        rarity: row.rarity,
        stats: row.stats,
        confidenceScore: Number(row.confidence_score) || 0,
        priceRange: row.price_range,
        tags: row.tags || [],
        createdAt: row.created_at ?? '',
        authorUid: row.author_uid ?? '',
      } as Product);
    });
  }

  return auctions
    .map((auction) => {
      const product = products.get(auction.productId) ?? auction.product;
      return {
        ...auction,
        product,
        productSnapshot: auction.productSnapshot ?? (product
          ? {
              name: product.name,
              imageUrl: product.imageUrl,
              allocations: product.allocations,
              stock: product.stock,
            }
          : undefined),
      };
    })
    .sort((a, b) => new Date(a.endTime).getTime() - new Date(b.endTime).getTime());
}

export function subscribeToAuctions(callback: (auctions: Auction[]) => void): () => void {
  const auctionsQuery = query(
    collection(db, 'auctions'),
    where('status', '==', 'active')
  );

  return onSnapshot(
    auctionsQuery,
    (snapshot) => {
      void attachProducts(snapshot)
        .then((auctions) => callback(auctions.slice(0, 50)))
        .catch((error) => {
          handleFirestoreError(error, OperationType.GET, 'auctions');
          callback([]);
        });
    },
    (error) => {
      handleFirestoreError(error, OperationType.LISTEN, 'auctions');
      callback([]);
    }
  );
}

export function subscribeToBids(
  auctionId: string,
  callback: (bids: Bid[]) => void
): () => void {
  const bidsQuery = query(collection(db, 'bids'), where('auctionId', '==', auctionId));

  return onSnapshot(
    bidsQuery,
    (snapshot) => {
      const bids = snapshot.docs
        .map((docSnap) => mapBid(docSnap.id, docSnap.data()))
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      callback(bids);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LISTEN, 'bids');
      callback([]);
    }
  );
}

export async function createAuction(input: AuctionDraft): Promise<string> {
  const { data: productRow, error: productError } = await supabase
    .from('products')
    .select('*')
    .eq('id', input.productId)
    .single();

  if (productError || !productRow) {
    throw new Error('Selected product no longer exists');
  }

  const product: Product = {
    id: productRow.id,
    name: productRow.name,
    description: productRow.description,
    category: productRow.category,
    condition: productRow.condition,
    status: productRow.status,
    listingType: productRow.listing_type,
    retailPrice: Number(productRow.retail_price),
    discountPrice: Number(productRow.discount_price),
    markdownPercentage: productRow.markdown_percentage,
    stock: productRow.stock,
    totalStock: productRow.stock,
    allocations: { store: productRow.alloc_store, auction: productRow.alloc_auction, packs: productRow.alloc_packs },
    imageUrl: productRow.image_url,
    imageUrls: productRow.image_urls || [],
    rarity: productRow.rarity,
    stats: productRow.stats,
    confidenceScore: Number(productRow.confidence_score) || 0,
    priceRange: productRow.price_range,
    tags: productRow.tags || [],
    createdAt: productRow.created_at ?? '',
    authorUid: productRow.author_uid ?? '',
  };
  const startsAt = new Date(input.startTime);
  const endsAt = new Date(input.endTime);

  if (!(startsAt.getTime() < endsAt.getTime())) {
    throw new Error('Auction end time must be after the start time');
  }

  const auctionRef = await addDoc(collection(db, 'auctions'), {
    productId: input.productId,
    sellerId: input.sellerId,
    startPrice: input.startPrice,
    currentBid: input.startPrice,
    highestBidderId: null,
    startTime: input.startTime,
    endTime: input.endTime,
    status: startsAt <= new Date() ? 'active' : 'scheduled',
    bidCount: 0,
    product,
    productSnapshot: {
      name: product.name,
      imageUrl: product.imageUrl,
      allocations: product.allocations,
      stock: product.stock,
    },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return auctionRef.id;
}

export async function placeBid(
  auctionId: string,
  bidderIdOrAmount: string | number,
  maybeAmount?: number
): Promise<{ error: Error | null }> {
  const bidderId = typeof bidderIdOrAmount === 'string' ? bidderIdOrAmount : auth.currentUser?.uid;
  const amount = typeof bidderIdOrAmount === 'number' ? bidderIdOrAmount : maybeAmount;

  if (!bidderId) {
    return { error: new Error('You need to sign in before bidding') };
  }

  if (!amount || amount <= 0) {
    return { error: new Error('Invalid bid amount') };
  }

  const auctionRef = doc(db, 'auctions', auctionId);

  try {
    await runTransaction(db, async (transaction) => {
      const auctionSnap = await transaction.get(auctionRef);
      if (!auctionSnap.exists()) {
        throw new Error('Auction not found');
      }

      const auction = { id: auctionSnap.id, ...auctionSnap.data() } as Auction;
      if (auction.status !== 'active') {
        throw new Error('Auction is no longer active');
      }

      if (new Date(auction.endTime).getTime() <= Date.now()) {
        throw new Error('Auction has already ended');
      }

      const minimumBid = Number(auction.currentBid ?? auction.startPrice ?? 0) + 1;
      if (amount < minimumBid) {
        throw new Error(`Bid must be at least R${minimumBid}`);
      }

      const bidRef = doc(collection(db, 'bids'));
      const bidderName =
        auth.currentUser?.displayName ??
        auth.currentUser?.email ??
        'Anonymous';

      transaction.set(bidRef, {
        auctionId,
        bidderId,
        bidderName,
        amount,
        timestamp: serverTimestamp(),
        createdAt: new Date().toISOString(),
      });

      transaction.update(auctionRef, {
        currentBid: amount,
        highestBidderId: bidderId,
        bidCount: Number(auction.bidCount ?? 0) + 1,
        updatedAt: serverTimestamp(),
      });
    });

    return { error: null };
  } catch (error) {
    return { error: error instanceof Error ? error : new Error('Failed to place bid') };
  }
}

export async function concludeAuction(
  auctionId: string,
  winnerId?: string | null,
  finalPrice?: number
): Promise<{ error: Error | null }> {
  try {
    const auctionRef = doc(db, 'auctions', auctionId);
    const auctionSnap = await getDoc(auctionRef);

    if (!auctionSnap.exists()) {
      return { error: new Error('Auction not found') };
    }

    const auction = { id: auctionSnap.id, ...auctionSnap.data() } as Auction;
    const resolvedWinnerId = winnerId ?? auction.highestBidderId ?? null;
    const resolvedPrice = finalPrice ?? auction.currentBid;

    await updateDoc(auctionRef, {
      status: 'ended',
      winnerId: resolvedWinnerId,
      currentBid: resolvedPrice,
      updatedAt: serverTimestamp(),
    });

    // Notify winner asynchronously — don't block or throw on failure
    if (resolvedWinnerId) {
      fetch('/api/admin/auction-winner-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          winnerId: resolvedWinnerId,
          productName: auction.product?.name ?? undefined,
          winningBid: resolvedPrice,
        }),
      }).catch((e) => console.error('[concludeAuction] winner notification failed:', e));
    }

    return { error: null };
  } catch (error) {
    return { error: error instanceof Error ? error : new Error('Failed to conclude auction') };
  }
}
