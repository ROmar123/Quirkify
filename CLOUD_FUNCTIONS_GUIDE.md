# Cloud Functions Implementation Guide

This document outlines the Cloud Functions required to enforce allocation constraints and maintain data consistency in the Quirkify Inventory Hub system.

## Overview

The allocation system tracks how many units of each product are designated for different channels (store, auctions, packs). When items are sold/won/consumed through any channel, these allocations must be automatically decremented at the database level to prevent overselling and maintain consistency.

## Required Cloud Functions

### 1. **onAuctionWon** - Decrement auction allocation when auction concludes with winner

**Trigger:** Firestore `auctions` collection - update event

**Condition:** `status` changes from `active` → `ended` AND `highestBidderId` is not null (auction was won)

**Function Logic:**
```typescript
- Get auction document
- If status changed to 'ended' AND highestBidderId exists:
  - Get product document
  - If product.allocations.auction > 0:
    - Decrement product.allocations.auction by 1
    - Create order for winner:
      {
        userId: highestBidderId,
        items: [{ productId, quantity: 1, channel: 'auction' }],
        orderType: 'auction',
        auctionId: auctionId,
        totalAmount: currentBid,
        status: 'completed',
        inventorySnapshot: {
          products: {
            [productId]: {
              allocations: product.allocations (BEFORE decrement),
              stock: product.stock
            }
          }
        },
        createdAt: now
      }
    - If product.allocations.auction reaches 0:
      - Set all other active auctions for this product to status='ended'
      - endReason='inventory-depleted'
```

**Implementation Pattern:**
```typescript
export const onAuctionWon = functions.firestore
  .document('auctions/{auctionId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const auctionId = context.params.auctionId;

    // Check if auction just ended with a winner
    if (before.status === 'active' && after.status === 'ended' && after.highestBidderId) {
      const productRef = db.collection('products').doc(after.productId);
      const productDoc = await productRef.get();
      const product = productDoc.data();

      // Decrement auction allocation
      if ((product.allocations?.auction || 0) > 0) {
        const batch = db.batch();
        
        // Update product allocations
        batch.update(productRef, {
          'allocations.auction': product.allocations.auction - 1,
          updatedAt: new Date()
        });

        // Create order
        batch.set(db.collection('orders').doc(), {
          userId: after.highestBidderId,
          items: [{ 
            productId: after.productId, 
            quantity: 1,
            channel: 'auction'
          }],
          orderType: 'auction',
          auctionId: auctionId,
          totalAmount: after.currentBid,
          status: 'completed',
          inventorySnapshot: {
            products: {
              [after.productId]: {
                allocations: product.allocations,
                stock: product.stock
              }
            }
          },
          createdAt: new Date()
        });

        // If allocation hits 0, end all other auctions
        if (product.allocations.auction === 1) {
          const otherAuctions = await db.collection('auctions')
            .where('productId', '==', after.productId)
            .where('status', '==', 'active')
            .where('id', '!=', auctionId)
            .get();

          otherAuctions.docs.forEach(doc => {
            batch.update(doc.ref, {
              status: 'ended',
              endReason: 'inventory-depleted'
            });
          });
        }

        await batch.commit();
      }
    }
  });
```

---

### 2. **onPackPurchased** - Decrement pack allocation when pack is sold

**Trigger:** Firestore `orders` collection - create event

**Condition:** `orderType === 'pack'` AND `items` contains pack references

**Function Logic:**
```typescript
- For each linked product in pack:
  - Get product document
  - If product.allocations.packs > 0:
    - Decrement product.allocations.packs by 1
    - If product.allocations.packs reaches 0:
      - Mark all packs linked to this product as 'sold-out'
```

**Implementation Pattern:**
```typescript
export const onPackPurchased = functions.firestore
  .document('orders/{orderId}')
  .onCreate(async (snap, context) => {
    const order = snap.data();

    if (order.orderType === 'pack') {
      const batch = db.batch();

      // Get the pack
      const packDoc = await db.collection('packs').doc(order.items[0].packId).get();
      const pack = packDoc.data();

      // Decrement allocations for each linked product
      for (const productId of pack.linkedProductIds) {
        const productRef = db.collection('products').doc(productId);
        const productDoc = await productRef.get();
        const product = productDoc.data();

        if ((product.allocations?.packs || 0) > 0) {
          batch.update(productRef, {
            'allocations.packs': product.allocations.packs - 1,
            updatedAt: new Date()
          });
        }
      }

      // If pack is completely allocated, mark as sold-out
      if (pack.linkedProductIds.every(productId => {
        // Check if all linked products now have 0 packs allocation
        // This would be determined by querying/checking
      })) {
        batch.update(packDoc.ref, { status: 'sold-out' });
      }

      await batch.commit();
    }
  });
```

---

### 3. **onStoreCheckout** - Decrement store allocation when checkout completes

**Trigger:** Firestore `orders` collection - create event

**Condition:** `orderType === 'store'` AND `status === 'completed'`

**Function Logic:**
```typescript
- For each item in order.items:
  - Get product document
  - If product.allocations.store >= item.quantity:
    - Decrement product.allocations.store by item.quantity
    - Create inventory snapshot in order
```

**Implementation Pattern:**
```typescript
export const onStoreCheckout = functions.firestore
  .document('orders/{orderId}')
  .onCreate(async (snap, context) => {
    const order = snap.data();

    if (order.orderType === 'store' && order.status === 'completed') {
      const batch = db.batch();

      // Process each item
      for (const item of order.items) {
        const productRef = db.collection('products').doc(item.productId);
        const productDoc = await productRef.get();
        const product = productDoc.data();

        if ((product.allocations?.store || 0) >= item.quantity) {
          batch.update(productRef, {
            'allocations.store': product.allocations.store - item.quantity,
            updatedAt: new Date()
          });

          // Update order with inventory snapshot
          batch.update(snap.ref, {
            inventorySnapshot: {
              ...order.inventorySnapshot,
              [item.productId]: {
                allocations: product.allocations,
                stock: product.stock
              }
            }
          });
        }
      }

      await batch.commit();
    }
  });
```

---

### 4. **onAllocationZero** - Auto-delist and archive when allocation hits zero

**Trigger:** Firestore `products` collection - update event

**Condition:** Any allocation decrements to 0

**Function Logic:**
```typescript
- If allocations.store === 0:
  - Remove product from store listing
  - Update product.listingType accordingly
  
- If allocations.auction === 0:
  - End all active auctions for this product with status='ended'
  - Set endReason='inventory-depleted'
  
- If allocations.packs === 0:
  - Mark all linked packs as 'sold-out'
```

**Implementation Pattern:**
```typescript
export const onAllocationZero = functions.firestore
  .document('products/{productId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    // Check if any allocation hit zero
    if (after.allocations) {
      // Store allocation zero
      if (before.allocations.store > 0 && after.allocations.store === 0) {
        await change.after.ref.update({
          listingType: after.allocations.auction > 0 ? 'auction' : 'none'
        });
      }

      // Auction allocation zero
      if (before.allocations.auction > 0 && after.allocations.auction === 0) {
        const auctions = await db.collection('auctions')
          .where('productId', '==', context.params.productId)
          .where('status', '==', 'active')
          .get();

        const batch = db.batch();
        auctions.docs.forEach(doc => {
          batch.update(doc.ref, {
            status: 'ended',
            endReason: 'inventory-depleted'
          });
        });
        await batch.commit();
      }

      // Packs allocation zero
      if (before.allocations.packs > 0 && after.allocations.packs === 0) {
        const packs = await db.collection('packs')
          .where('linkedProductIds', 'array-contains', context.params.productId)
          .get();

        const batch = db.batch();
        packs.docs.forEach(doc => {
          batch.update(doc.ref, { status: 'sold-out' });
        });
        await batch.commit();
      }
    }
  });
```

---

### 5. **onProductDelete** - Cleanup when product is deleted

**Trigger:** Firestore `products` collection - delete event

**Condition:** Product document is deleted

**Function Logic:**
```typescript
- Get all auctions linked to product
  - Delete or end all auctions
  
- Get all packs linked to product
  - Remove product from linkedProductIds
  - Or delete packs entirely
  
- Validate no orders reference this product with pending status
```

**Implementation Pattern:**
```typescript
export const onProductDelete = functions.firestore
  .document('products/{productId}')
  .onDelete(async (snap, context) => {
    const productId = context.params.productId;
    const batch = db.batch();

    // Delete linked auctions
    const auctions = await db.collection('auctions')
      .where('productId', '==', productId)
      .get();

    auctions.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    // Remove from packs
    const packs = await db.collection('packs')
      .where('linkedProductIds', 'array-contains', productId)
      .get();

    packs.docs.forEach(doc => {
      const linkedIds = doc.data().linkedProductIds;
      const updated = linkedIds.filter(id => id !== productId);
      
      if (updated.length === 0) {
        batch.delete(doc.ref); // Delete pack if no products left
      } else {
        batch.update(doc.ref, { linkedProductIds: updated });
      }
    });

    await batch.commit();
  });
```

---

## Deployment Instructions

### Prerequisites
- Firebase CLI installed
- Project initialized with `firebase init functions`
- Firestore database set up

### Steps

1. **Create Cloud Functions**
```bash
cd functions
```

2. **Install dependencies** (if not already done)
```bash
npm install firebase-admin firebase-functions
```

3. **Add functions to `functions/src/index.ts`**
```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();

// Import and export all functions
export { onAuctionWon, onPackPurchased, onStoreCheckout, onAllocationZero, onProductDelete };
```

4. **Deploy**
```bash
firebase deploy --only functions
```

### Testing

1. **Local Emulation**
```bash
firebase emulators:start
```

2. **Test Cases**
   - Create product with allocations
   - Create auction → Win auction → Verify allocation decremented
   - Create pack → Purchase pack → Verify allocation decremented
   - Create store order → Complete checkout → Verify store allocation decremented
   - Verify auto-delisting when allocation reaches 0
   - Verify product deletion cleanup

---

## Error Handling

All functions should include try-catch blocks and logging:

```typescript
try {
  // Function logic
} catch (error) {
  console.error(`Error in [functionName]:`, error);
  // Log to Firestore error collection for monitoring
  await db.collection('function_errors').add({
    functionName: 'onAuctionWon',
    error: error.message,
    timestamp: new Date(),
    context: { auctionId, productId }
  });
}
```

---

## Monitoring

Set up Cloud Monitoring to track:
- Function execution time
- Error rates
- Allocation sync issues
- Failed transactions

Create alerts for:
- Function errors > threshold
- Allocation consistency violations
- Overselling attempts

---

## Notes

- **Transaction Safety:** Use batch writes to ensure atomicity
- **Idempotency:** Functions should be idempotent (safe to call multiple times)
- **Performance:** Batch operations where possible to avoid rate limits
- **Testing:** Test thoroughly in staging before deploying to production
- **Monitoring:** Log all state changes for audit trail
