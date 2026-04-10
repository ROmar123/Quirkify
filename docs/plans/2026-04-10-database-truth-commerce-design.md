# Quirkify Database-Truth Commerce Design

Date: 2026-04-10

## Goal

Move Quirkify's commerce rules out of the browser and into Supabase/Postgres so the database becomes the source of truth for:

- product stock and channel allocations
- checkout reservations
- order lifecycle transitions
- payment confirmation and failure handling
- wallet balances and ledger entries
- auction bid and hold logic

## Current Problem

The app is split across browser-side writes, Supabase reads, and Firestore-era assumptions:

- checkout creates orders directly from the frontend
- payment success currently mutates order state from the browser
- Yoco webhook still updates Firestore instead of the Supabase order record
- auction and wallet state do not yet have a reliable financial ledger in Supabase

This means UI behaviour can drift from business truth.

## Target Model

### Authority split

- Supabase/Postgres owns:
  - products
  - profiles
  - orders and order_items
  - payment events
  - wallet accounts and wallet ledger
  - auction settlement data and bid/wallet logic
- Firestore may remain as a live interaction transport for now:
  - stream chat
  - live viewer updates
  - transitional auction UI feeds

### Mutation path

- Browser calls server endpoints only for critical commerce mutations.
- Server endpoints use the Supabase service role.
- Server endpoints call Postgres functions/RPCs.
- Postgres functions enforce state rules with row locks, checks, and ledger writes.

## Rules Implemented In This Pass

### Store checkout

- Creating a checkout order reserves `products.reserved_store`.
- Reserved stock cannot exceed `alloc_store`.
- Line item pricing is derived from the database, not trusted from the client.
- Payment success is applied from the webhook path, not from the browser redirect.
- Payment failure or checkout cancellation releases reserved stock.
- Stale pending reservations can be expired by a database function.

### Wallet foundation

- Every profile gets a wallet account.
- Wallet changes must be written to a ledger.
- Available and held balances are tracked separately.

### Auction foundation

- Auctions reserve auction allocation in the database.
- Bids must go through a database function.
- Highest-bid changes release the prior bidder's hold and place a hold on the new bidder.

## Immediate App Changes

- Replace frontend order creation in checkout with a server-side checkout session endpoint.
- Remove client-side order finalisation from the payment success page.
- Point the Yoco webhook at Supabase order functions instead of Firestore.

## Next Steps After This Pass

1. Apply the new Supabase migration to the hosted project.
2. Move admin/manual order mutations behind server endpoints or RPCs.
3. Cut auction creation and bid placement over to the new DB functions.
4. Add scheduled expiry for abandoned checkout reservations.
