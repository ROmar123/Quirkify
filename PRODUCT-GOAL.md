# Quirkify Product Goal

## Core Product
Quirkify is a South African, conversion-first curated commerce marketplace with premium retail presentation, real store listings, real auctions, pack/bundle merchandising, wallet-backed bidding, and tightly controlled operator workflows.

## Non-Negotiable Architecture
- Supabase Postgres is the primary source of truth.
- Firebase Auth handles authentication.
- Firestore is limited to realtime auction/live-session state and related notifications.
- Firebase Storage handles media and uploads where needed.

## Public vs Gated Experience
- Public, no-login surfaces:
  - home/storefront
  - category/navigation browsing
  - product detail pages
  - pack listings
  - auction listings
  - public profile/listing visibility where applicable
- Login-gated actions:
  - place bid
  - add payment-backed wallet credit
  - checkout / purchase
  - view orders
  - manage profile and addresses
  - seller/admin/operator actions

## Product Standard
- The product must feel commercially credible, not like a prototype.
- Customer-facing pages cannot ship placeholder copy such as "coming soon" when the surface is meant to be live.
- Every page should align to the agreed model:
  - storefront and auctions are public discovery surfaces
  - orders and profile are authenticated account surfaces
  - admin/inventory/commerce/growth are operator surfaces

## Decision Filter
Before changing architecture, routes, or UX, check:
1. Does this keep public browsing open and high-conversion?
2. Does this gate only the actions that require identity or payment?
3. Does Supabase remain the source of truth for commerce?
4. Does this improve trust, clarity, and operational control?

If any answer is "no", the change is drifting.
