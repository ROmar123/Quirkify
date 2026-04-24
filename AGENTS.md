# Quirkify Live — Agent Session Memory

## Product Guardrails (Do Not Drift)
- Quirkify is a public commerce marketplace first. The storefront, product listings, packs, and auction listings must be browsable without login.
- Login gates identity-bound actions only: bidding, checkout, wallet usage, orders, saved/account state, profile editing, and admin/operator actions.
- Public profile pages should surface real public-facing commerce identity and listing activity. Do not ship "coming soon" placeholder states on customer-visible pages.
- Supabase Postgres is the system of record for catalogue, inventory, packs, profiles, wallet, orders, fulfilment, campaigns, and reporting.
- Firestore/Firebase is for auth, storage, and realtime auction/live-session state only. Do not move core commerce ownership into Firestore.
- When in doubt, prefer customer trust, operational clarity, and commercially credible flows over prototype shortcuts.

## Project
AI-powered collectibles marketplace for South Africa.
**Canonical Production URL:** https://quirkify-1.vercel.app
**Custom Domain Target:** https://www.quirkify.co.za
**Repo:** https://github.com/ROmar123/Quirkify.git (branch: main)
**Canonical Vercel project:** rhidaas-projects/quirkify-1
**Admin email:** patengel85@gmail.com

## Tech Stack
- React 19 + Vite + React Router v7
- Firebase Auth (Google Sign-In) + Firestore (live sessions, auctions, notifications)
- Supabase (orders, products, profiles, stock)
- Yoco (payments, webhook handler)
- The Courier Guy (shipping quotes + tracking)
- Tailwind CSS v4 + Motion animations + Lucide icons
- Vercel serverless API routes in /api/

## Deployment Rules (USER RULES — ALWAYS FOLLOW)
1. Check `gh auth status` and `vercel whoami` before any push/deploy
2. Only deploy from `quirkify-live` directory (canonical repo checkout)
3. Deploy to Vercel project `quirkify-1`
4. Always verify `https://quirkify-1.vercel.app` after deploy
5. Treat `www.quirkify.co.za` as production only after DNS is corrected in Vercel

## Pages & Routes
| Route | Component | Status |
|-------|-----------|--------|
| / | StoreFront | ✅ Production-ready (Apr 2025) |
| /product/:id | ProductDetails | ✅ Production-ready (Apr 2025) |
| /checkout | Checkout | ✅ Production-ready (Apr 2025) |
| /orders | Orders | ✅ Production-ready (Apr 2025) |
| /auctions | AuctionList | ✅ Production-ready (Apr 2025) |
| /collection | Collection | ✅ Production-ready (Apr 2025) |
| /auth | AuthPage | ✅ Production-ready (Apr 2025) |
| /payment/success | PaymentResult | ✅ Production-ready (Apr 2025) |
| /payment/cancel | PaymentResult | ✅ Production-ready (Apr 2025) |
| /terms | TermsOfService | ✅ Created (Apr 2025) |
| /privacy | PrivacyPolicy | ✅ Created (Apr 2025) |
| /returns | ReturnsPolicy | ✅ Created (Apr 2025) |
| /admin | AdminDashboard | 🔄 To review |
| /admin/inventory | Inventory | 🔄 To review |
| /admin/orders | CommercePage | 🔄 To review |
| /admin/campaigns | GrowthPage | 🔄 To review |
| /live/:sessionId | LiveStreamRoom | 🔄 To review |

## What Was Done (Session — Apr 2025)

### Increment 7 — Product alignment pass (Apr 24 2026)
- **Storefront discovery upgraded**:
  - `/` now presents store, auction, pack, and live-session discovery as one commercial surface
  - added marketplace summary metrics, auction pulse panels, and richer featured product cards using shared stock/timing helpers
- **Product detail upgraded**:
  - `/product/:productId` now exposes channel-aware stock context, trust cues, auction pricing context, and clearer purchase state
- **Auction discovery upgraded**:
  - `/auctions` now includes marketplace summary cards, live-room entry points, countdowns, quick bid buttons, and wallet-settlement context
- **Growth ops upgraded**:
  - `/admin/growth` now reads like an operator planning surface with launch-mix recommendations, approved-campaign visibility, and clearer snapshot framing
- **Live room upgraded**:
  - `/live/:sessionId` now has a stronger live-event layout with lot hero media, quick bid presets, settlement guardrails, and queue context
- **Admin dashboard quick navigation**:
  - admin dashboard now links directly to the public auction feed for end-to-end operator testing

### Increment 2 — Live (commit 1d733a9)
- Checkout: mobile sticky CTA bar (Next/Pay always visible), SSL badge replaces XP message, Mapbox brand removed from hints, pb-36 mobile padding
- AuthPage: removed "Google sign-in is disabled" notice, fixed placeholder name, pb-32
- PaymentResult: pb-32 mobile padding
- Collection: fixed broken rarity badge CSS (bg-cyber/bg-hot/bg-quirky → inline gradients), surfaced updateError to UI
- Orders: fixed paymentMethod display (null → "—" not "Pending")
- Auctions: pb-32 mobile padding, removed loose `as any` cast

### Increment 1 — Live (commit fffd6e0)
- StoreFront: removed all dev/placeholder text, real marketing copy
- StoreFront: demo banner now customer-facing language
- ProductDetails: fixed false trust badges (no "Free Shipping" or "30 Day Returns")
  - Now: "AI Verified", "Nationwide Delivery", "Secure Checkout"
- Footer: added site-wide Footer component with Shop/Support/Legal columns
- Legal: created Terms of Service, Privacy Policy, Returns Policy
  - All SA-law compliant (POPIA, Consumer Protection Act)
- App.tsx: wired /terms, /privacy, /returns routes

## What Was Done (Session — Apr 11 2025)

### Increment 3 — Live (commit 224689b)
- **Checkout mobile CTA**: fixed floating button clipping under mobile nav (`bottom-[4.5rem]` → `bottom-24` = 96px, clears 70px nav)
- **Courier Guy API**: real live integration via `POST https://api-tcg.co.za/rates?api_key=...`
  - Auth: `api_key` query param (format: `accountid|key`) — get from portal.thecourierguy.co.za
  - Prefers Economy (ECO) rate, falls back to cheapest available, falls back to zone-based mock if no key
  - Tracking: `GET https://api-tcg.co.za/tracking/shipments/public?waybill=...` (no auth needed)
- **Mapbox**: code was always implemented; wired lat/lng from selected suggestion into shipping quote
  - Checkout stores `selectedAddressCoords` from Mapbox suggestion selection
  - Coords passed through shippingService → quote API → TCG `/rates`
  - Manual address edits clear coords (triggers zone fallback)
- **quote.ts**: converted to named `POST` export (Vercel Functions best practice)
- **TCG collection address**: configured via env vars (`TCG_COLLECTION_LAT/LNG/SUBURB/CITY/POSTAL/ZONE/ENTERED/STREET`) — defaults to Randburg, Johannesburg

### Increment 4 — Local fix staged (Apr 11 2026)
- **Yoco webhook durability**: `api/payments/yoco/webhook.ts` now processes payment events before returning 200
  - This avoids Vercel serverless dropping the async work after the response, which could leave wallet top-ups and store checkouts stuck in `pending`
  - Resend/email failures are now logged but do not block order/payment status updates
- **Wallet return flow**: `api/payments/yoco/initiate.ts` now includes `orderId` on the cancel URL
  - `/payment/cancel` can now reconcile wallet top-up cancellations instead of landing in an unmapped state
- **PaymentResult mapping**: wallet top-ups now show wallet-specific success/cancel/failure copy and route users back to `/collection`
  - Store checkout still routes to `/orders` or `/checkout`
- **Order status API**: lightweight order-status responses now include `source_ref` and `channel` so the frontend can distinguish wallet top-ups from store checkout

### Increment 5 — Local hardening staged (Apr 11 2026)
- **Pending checkout policy**:
  - keep every attempt in the database for audit/ops
  - hide pre-payment cancelled/failed attempts from the customer `Orders` page
  - hide wallet top-up attempts from the customer `Orders` page entirely
- **Customer pending actions**:
  - active pending store orders can now be resumed from `Orders`
  - active pending store orders can now be cancelled from `Orders`
- **Audit notes**:
  - explicit reasons now use machine-readable notes such as `customer_cancelled_on_checkout`, `customer_cancelled_from_orders`, `checkout_session_expired`, `checkout_session_creation_failed`
- **Abandonment cleanup**:
  - stale pending orders are cancelled by the DB function `expire_stale_pending_orders()`
  - commerce list/detail/mutation APIs now invoke expiry before reading or mutating order state
  - no Vercel cron dependency

### Increment 6 — Live smoke-test fix (commit c3b573d)
- **Admin commerce filter fix**:
  - `excludeSourceRef=wallet_topup` was previously implemented with `neq`, which also excluded normal store orders where `source_ref` is `NULL`
  - fixed in both `api/commerce/order-status.ts` and `server.ts` using `source_ref.is.null,source_ref.neq.wallet_topup`
  - production symptom before fix: admin/commerce could appear empty even though real store orders existed
- **Live verification**:
  - pushed to `main` and verified the public alias after Vercel deploy
  - verified `GET /api/commerce/order-status?profileId=<admin-profile>&excludeSourceRef=wallet_topup` now returns the expected non-wallet store order instead of `[]`

### Production data risk discovered during smoke test
- There are many wallet top-up attempts in `orders` still sitting as `pending` with `source_ref=wallet_topup`
- At least one store order row is state-inconsistent in production:
  - `status='paid'`
  - `payment_status='cancelled'`
  - no matching `payment_events`
  - only a legacy reservation-release event is present
- This appears to be old bad data rather than the current filter bug, but it means ops truth is not yet fully clean
- Next hardening pass should separate/clean wallet top-up records and reconcile inconsistent legacy store rows

## API Routes Status
| Route | Status |
|-------|--------|
| POST /api/payments/yoco/initiate | ✅ Working |
| POST /api/payments/yoco/webhook | ✅ Implemented (HMAC sig verify, idempotency, sync processing on Vercel) |
| POST /api/commerce/store-checkout | ✅ Working |
| GET /api/commerce/order-status | ✅ Working |
| POST /api/commerce/cancel-order | ✅ Working |
| POST /api/ai/identify | ✅ gemini-1.5-flash |
| POST /api/ai/campaign | ✅ gemini-1.5-flash |
| POST /api/ai/personalize | ✅ gemini-1.5-flash |
| POST /api/ai/talking-points | ✅ gemini-1.5-flash |
| POST /api/shipping/quote | ✅ Live TCG API (with zone fallback). Needs VITE_MAPBOX_ACCESS_TOKEN + TCG_API_KEY |
| GET /api/shipping/track/:id | ✅ Live TCG tracking (public endpoint, no key needed) |
| GET /api/health | ✅ Working |

## Env Vars in Vercel (confirmed)
- VITE_SUPABASE_URL ✅
- VITE_SUPABASE_ANON_KEY ✅
- SUPABASE_SERVICE_ROLE_KEY ✅
- VITE_GEMINI_API_KEY ✅
- GEMINI_API_KEY ✅
- YOCO_SECRET_KEY ✅
- VITE_MAPBOX_ACCESS_TOKEN ✅ (enables address autocomplete in checkout)
- COURIER_GUY_API_KEY ✅ → **must be set as `TCG_API_KEY`** (format: `accountid|key` from portal.thecourierguy.co.za)

### TCG Collection Address Env Vars (optional — defaults to Randburg, JHB)
- TCG_COLLECTION_LAT, TCG_COLLECTION_LNG
- TCG_COLLECTION_STREET, TCG_COLLECTION_SUBURB, TCG_COLLECTION_CITY
- TCG_COLLECTION_POSTAL, TCG_COLLECTION_ZONE, TCG_COLLECTION_ENTERED

## Supabase RPCs (confirmed applied)
- mark_order_payment_succeeded ✅
- mark_order_payment_failed ✅
- checkout (store checkout RPC) ✅

## Known Remaining Issues
- TCG_API_KEY env var: confirm it's set correctly in Vercel (format: `accountid|key`)
- Mapbox: needs user to select suggestion from dropdown for live TCG quote — manual entry falls back to zone pricing
- Bundle size warning: 1.39MB JS — consider code splitting in future
- Auction bid history shows (bid as any).bidderName — type is loose
- Admin GrowthPage: placeholder UI, no real functionality
- LiveStreamRoom: framework only, no real streaming

## Yoco Memory
- Wallet top-up Yoco flow was already creating checkout sessions successfully, but the return/status mapping was incomplete:
  - cancel URL did not include `orderId`
  - shared `PaymentResult` copy/CTA assumed store checkout instead of wallet top-up
- Store checkout Yoco flow could appear broken because the webhook acknowledged first and processed after the response
  - on Vercel, that async work is not reliable, so order status could remain `pending`
- Current fix path:
  - process webhook before 200 response
  - treat email sending as non-blocking
  - include `source_ref` in order-status responses
  - map wallet top-up returns separately in `PaymentResult`
  - customer-facing `Orders` should only show real/actionable commerce orders, not dead pre-payment attempts
  - abandoned checkout cleanup now runs via DB RPC before commerce reads/writes, not via Vercel cron

## Coding Conventions
- Tailwind CSS v4 — no `tailwind.config.js`, uses CSS variables
- Colors: purple-900 (#2D1B69), purple-600 (#7C3AED), pink-400 (#F472B6)
- Gradient: `linear-gradient(135deg, #F472B6, #A855F7)` for CTAs
- Background: #FDF4FF (lavender white)
- Rounded corners: rounded-2xl (cards), rounded-3xl (sections), rounded-[2rem] (hero cards)
- Font weights: font-black for headings, font-bold for body, font-semibold for supporting text
- Spacing: pb-32 md:pb-12 on pages (leaves room for mobile nav)
- No comments in code unless logic is non-obvious
- Mobile nav is fixed bottom on md:hidden — all pages need pb-32 bottom padding on mobile
