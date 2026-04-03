import { 
  collection, 
  doc, 
  runTransaction, 
  query, 
  where, 
  onSnapshot, 
  getDoc,
  serverTimestamp,
  Timestamp,
  addDoc,
  orderBy,
  limit,
  updateDoc,
  increment
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { Auction, Bid, Product, UserProgress } from '../types';
import { addXP, updateBalance } from './gamificationService';
import { sendNotification } from './notificationService';

export const placeBid = async (auctionId: string, amount: number) => {
  if (!auth.currentUser) throw new Error('Must be logged in to bid');
  const userId = auth.currentUser.uid;
  const userDisplayName = auth.currentUser.displayName || 'Anonymous';

  try {
    await runTransaction(db, async (transaction) => {
      const auctionRef = doc(db, 'auctions', auctionId);
      const auctionDoc = await transaction.get(auctionRef);

      if (!auctionDoc.exists()) {
        throw new Error('Auction does not exist');
      }

      const auctionData = auctionDoc.data() as Auction;
      const now = new Date();
      const endTime = new Date(auctionData.endTime);

      if (auctionData.status !== 'active' || now > endTime) {
        throw new Error('Auction is not active');
      }

      if (amount <= auctionData.currentBid) {
        throw new Error('Bid must be higher than current bid');
      }

      // Check user balance (Sorare-like hold)
      const progressRef = doc(db, 'user_progress', userId);
      const progressDoc = await transaction.get(progressRef);
      if (!progressDoc.exists()) throw new Error('User profile not found');
      const progress = progressDoc.data() as UserProgress;

      if (progress.balance < amount) {
        throw new Error('Insufficient balance to place bid');
      }

      // Handle time extension (Sorare-like anti-sniping)
      const fiveMinutesInMs = 5 * 60 * 1000;
      let newEndTime = auctionData.endTime;
      if (endTime.getTime() - now.getTime() < fiveMinutesInMs) {
        newEndTime = new Date(now.getTime() + fiveMinutesInMs).toISOString();
      }

      // Refund previous bidder if exists
      if (auctionData.highestBidderId) {
        const prevBidderRef = doc(db, 'user_progress', auctionData.highestBidderId);
        transaction.update(prevBidderRef, {
          balance: increment(auctionData.currentBid)
        });

        // Notify previous bidder
        sendNotification(auctionData.highestBidderId, {
          title: 'Outbid!',
          message: `You have been outbid on ${auctionData.product?.name || 'an item'}. Your funds have been returned.`,
          type: 'outbid',
          link: `/auctions/${auctionId}`
        });
      }

      // Hold current bidder's funds
      transaction.update(progressRef, {
        balance: increment(-amount)
      });

      // Update auction
      transaction.update(auctionRef, {
        currentBid: amount,
        highestBidderId: userId,
        bidCount: (auctionData.bidCount || 0) + 1,
        endTime: newEndTime
      });

      // Add bid record
      const bidRef = doc(collection(db, 'auctions', auctionId, 'bids'));
      transaction.set(bidRef, {
        auctionId,
        bidderId: userId,
        bidderName: userDisplayName,
        amount,
        timestamp: new Date().toISOString()
      });
    });

    // Add XP for bidding
    await addXP(userId, 10);
  } catch (error: any) {
    if (error?.code === 'permission-denied' || error?.code === 'unauthenticated') {
      handleFirestoreError(error, OperationType.UPDATE, `auctions/${auctionId}`);
    }
    throw error;
  }
};

export const subscribeToAuctions = (callback: (auctions: Auction[]) => void) => {
  const q = query(collection(db, 'auctions'), where('status', '==', 'active'));
  
  return onSnapshot(q, (snapshot) => {
    const auctions = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Auction));
    callback(auctions);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, 'auctions');
  });
};

export const subscribeToBids = (auctionId: string, callback: (bids: Bid[]) => void) => {
  const q = query(
    collection(db, 'auctions', auctionId, 'bids'),
    orderBy('timestamp', 'desc'),
    limit(10)
  );
  
  return onSnapshot(q, (snapshot) => {
    const bids = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Bid));
    callback(bids);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, `auctions/${auctionId}/bids`);
  });
};

export const concludeAuction = async (auctionId: string) => {
  try {
    const auctionRef = doc(db, 'auctions', auctionId);
    const auctionSnap = await getDoc(auctionRef);
    
    if (!auctionSnap.exists()) return;
    
    const auction = auctionSnap.data() as Auction;
    if (auction.status !== 'active') return;

    // Update status to ended
    await updateDoc(auctionRef, { status: 'ended' });

    // If there was a winner, create an order
    if (auction.highestBidderId) {
      let winnerEmail = 'winner@example.com';
      try {
        const userSnap = await getDoc(doc(db, 'users', auction.highestBidderId));
        if (userSnap.exists()) {
          winnerEmail = userSnap.data().email || winnerEmail;
        }
      } catch (e) {
        // Fallback if no permission to read user doc
      }

      const orderData = {
        userId: auction.highestBidderId,
        userEmail: winnerEmail,
        items: [{
          id: auction.productId,
          name: auction.product?.name || 'Auction Item',
          price: auction.currentBid,
          quantity: 1,
          imageUrl: auction.product?.imageUrl || ''
        }],
        total: auction.currentBid,
        status: 'pending',
        shippingInfo: {
          email: winnerEmail,
          address: 'Auction Winner - Pending Address',
          city: 'N/A',
          zip: 'N/A'
        },
        createdAt: serverTimestamp(),
        orderType: 'auction'
      };

      await addDoc(collection(db, 'orders'), orderData);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `auctions/${auctionId}`);
  }
};

export const createAuction = async (auctionData: Omit<Auction, 'id' | 'currentBid' | 'highestBidderId' | 'bidCount' | 'status'>) => {
  try {
    // Fetch product data to denormalize
    const productDoc = await getDoc(doc(db, 'products', auctionData.productId));
    if (!productDoc.exists()) throw new Error('Product not found');
    const product = { id: productDoc.id, ...productDoc.data() } as Product;

    const auctionRef = await addDoc(collection(db, 'auctions'), {
      ...auctionData,
      product, // Denormalized product data
      currentBid: auctionData.startPrice,
      highestBidderId: null,
      bidCount: 0,
      status: 'active'
    });
    return auctionRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'auctions');
    throw error;
  }
};
