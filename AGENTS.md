# Quirkify Live — Agent Session Memory

## Project
AI-powered collectibles marketplace for South Africa.
**Live URL:** https://quirkify-live.vercel.app
**Repo:** https://github.com/ROmar123/Quirkify.git (branch: main)
**Vercel project:** rhidaas-projects/quirkify-live
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
2. Only deploy from `quirkify-live` directory (canonical repo)
3. Always verify live URL after deploy
4. Use `vercel --prod --yes` for production deploys

## Pages & Routes
| Route | Component | Status |
|-------|-----------|--------|
| / | StoreFront | ✅ Production-ready (Apr 2025) |
| /product/:id | ProductDetails | ✅ Production-ready (Apr 2025) |
| /checkout | Checkout | 🔄 Next to harden |
| /orders | Orders | 🔄 Next to harden |
| /auctions | AuctionList | 🔄 Next to harden |
| /collection | Collection | 🔄 Next to harden |
| /auth | AuthPage | 🔄 Next to harden |
| /payment/success | PaymentResult | 🔄 To review |
| /payment/cancel | PaymentResult | 🔄 To review |
| /terms | TermsOfService | ✅ Created (Apr 2025) |
| /privacy | PrivacyPolicy | ✅ Created (Apr 2025) |
| /returns | ReturnsPolicy | ✅ Created (Apr 2025) |
| /admin | AdminDashboard | 🔄 To review |
| /admin/inventory | Inventory | 🔄 To review |
| /admin/orders | CommercePage | 🔄 To review |
| /admin/campaigns | GrowthPage | 🔄 To review |
| /live/:sessionId | LiveStreamRoom | 🔄 To review |

## What Was Done (Session — Apr 2025)

### Increment 1 — Live (commit fffd6e0)
- StoreFront: removed all dev/placeholder text, real marketing copy
- StoreFront: demo banner now customer-facing language
- ProductDetails: fixed false trust badges (no "Free Shipping" or "30 Day Returns")
  - Now: "AI Verified", "Nationwide Delivery", "Secure Checkout"
- Footer: added site-wide Footer component with Shop/Support/Legal columns
- Legal: created Terms of Service, Privacy Policy, Returns Policy
  - All SA-law compliant (POPIA, Consumer Protection Act)
- App.tsx: wired /terms, /privacy, /returns routes

## API Routes Status
| Route | Status |
|-------|--------|
| POST /api/payments/yoco/initiate | ✅ Working |
| POST /api/payments/yoco/webhook | ✅ Implemented (HMAC sig verify, idempotency) |
| POST /api/commerce/store-checkout | ✅ Working |
| GET /api/commerce/order-status | ✅ Working |
| POST /api/commerce/cancel-order | ✅ Working |
| POST /api/ai/identify | ✅ gemini-1.5-flash |
| POST /api/ai/campaign | ✅ gemini-1.5-flash |
| POST /api/ai/personalize | ✅ gemini-1.5-flash |
| POST /api/ai/talking-points | ✅ gemini-1.5-flash |
| GET /api/shipping/quote | ✅ Working (fallback pricing if no API key) |
| GET /api/shipping/track/:id | ✅ Working |
| GET /api/health | ✅ Working |

## Env Vars in Vercel (confirmed)
- VITE_SUPABASE_URL ✅
- VITE_SUPABASE_ANON_KEY ✅
- SUPABASE_SERVICE_ROLE_KEY ✅
- VITE_GEMINI_API_KEY ✅
- GEMINI_API_KEY ✅
- YOCO_SECRET_KEY ✅
- VITE_MAPBOX_ACCESS_TOKEN ✅
- COURIER_GUY_API_KEY ✅ (set but integration still mocked/fallback)

## Supabase RPCs (confirmed applied)
- mark_order_payment_succeeded ✅
- mark_order_payment_failed ✅
- checkout (store checkout RPC) ✅

## Known Remaining Issues
- Courier Guy shipping API: key set but integration returns fallback pricing (real quote call may need endpoint/format fix)
- Bundle size warning: 1.39MB JS — consider code splitting in future
- Auction bid history shows (bid as any).bidderName — type is loose
- Collection page: not yet reviewed
- Admin GrowthPage: placeholder UI, no real functionality
- LiveStreamRoom: framework only, no real streaming

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
