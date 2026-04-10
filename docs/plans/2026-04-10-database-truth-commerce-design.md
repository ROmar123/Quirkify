# Quirkify Database-Truth Commerce Design

Date: 2026-04-10

## Goal

Move Quirkify's commerce rules out of the browser and into Supabase/Postgres so the database becomes the source of truth for:

- product stock and channel allocations
- checkout reservations
- order lifecycle transitions
- payment confirmation and failure handling
- wallet balances and ledger entries

Firestore remains the runtime system for auctions, live bidding, and stream interactions in this phase.

## Current Problem

The app is split across browser-side writes, Supabase reads, and Firestore-era assumptions:

- checkout creates orders directly from the frontend
- payment success currently mutates order state from the browser
- Yoco webhook still updates Firestore instead of the Supabase order record
- auction runtime is still Firestore-based while commerce is moving to Supabase

This means UI behaviour can drift from business truth.

## Target Model

### Authority split

- Supabase/Postgres owns:
  - products
  - profiles
  - orders and order_items
  - payment events
  - wallet accounts and wallet ledger
- Firestore owns:
  - auctions
  - bids
  - live session state
  - stream chat
  - viewer updates

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

## Immediate App Changes

- Replace frontend order creation in checkout with a server-side checkout session endpoint.
- Remove client-side order finalisation from the payment success page.
- Point the Yoco webhook at Supabase order functions instead of Firestore.
- Keep auction reads and writes on Firestore so the auction runtime has one backend.

## Next Steps After This Pass

1. Apply the new Supabase migration to the hosted project.
2. Move admin/manual order mutations behind server endpoints or RPCs.
3. Add scheduled expiry for abandoned checkout reservations.
4. Design the auction migration separately if and when Firestore is replaced.
