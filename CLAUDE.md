# Quirkify — Project Memory

## Deployment
- **Production**: `https://quirkify-recover.vercel.app` ← branch `main`
- Always push to `main`: `git push origin HEAD:main`
- The other two projects (quirkify-1.vercel.app, quirky-live.vercel.app) are stale — ignore them

## Session Rules (enforce every run)
- Max **one Agent** per session total
- Small, targeted commits — do not batch unrelated changes
- Always push to `main` branch — that is what `quirkify-recover.vercel.app` deploys from
- Run `npm run build` before pushing to verify no TypeScript/Vite errors

## Architecture

### Auth
- **`firebase.ts`** is a SUPABASE auth wrapper — NOT real Firebase auth
- `onAuthStateChanged`, `signIn`, `signOut`, `signInWithPassword` etc. are all Supabase under the hood
- Firebase is only used for Firestore (real-time auctions/live sessions) and Firebase Storage (images)

### Database — Source of Truth
| Data | Backend |
|------|---------|
| Products | **Supabase** `products` table |
| Orders + order_items + order_events | **Supabase** |
| Profiles | **Supabase** `profiles` table |
| Campaigns | **Supabase** `campaigns` table |
| Auctions + bids | **Firestore** (real-time) |
| Live sessions | **Firestore** (real-time) |
| Firebase Storage | Product images (HTTPS URLs stored in Supabase) |

### Key Services
- `src/services/productService.ts` — Supabase products CRUD + realtime
- `src/services/orderService.ts` — Supabase orders (direct JWT queries, no service role needed for reads)
- `src/services/campaignService.ts` — Supabase campaigns CRUD + realtime
- `src/services/profileService.ts` — Supabase profiles
- `src/services/aiClient.ts` — Gemini AI via `/api/ai/*` serverless routes
- `src/services/auctionService.ts` — Firestore auctions (keep here)
- `src/services/storageService.ts` — Firebase Storage image uploads

### Admin Components → Supabase (NOT Firestore)
After the 2025-04 migration, all admin product management uses Supabase:
- `ListingManager.tsx` → `createProduct`, `updateProduct`, `deleteProduct`, `subscribeToProducts`
- `ProductIntake.tsx` → `createProduct` (AI intake saves to Supabase)
- `ReviewQueue.tsx` → `subscribeToProducts('pending')`, `updateProduct`
- `CampaignManager.tsx` → `createCampaign`, `subscribeToCampaigns`

### Admin Routes (all require `isAdmin`)
| Route | Component | Description |
|-------|-----------|-------------|
| `/admin` | `AdminDashboard` | Overview with live counts + nav links |
| `/admin/inventory` | `Inventory` | Full intake, review queue, pack setup, auction creation |
| `/admin/commerce` | `CommercePage` | Fulfilment stages, tracking, admin notes |
| `/admin/orders` | `OrderManager` | Search/filter orders, event history, quick status actions |
| `/admin/growth` | `GrowthPage` | Gemini campaign drafts with human approval gate |
| `/admin/live` | `LiveStreamManager` | Create/manage live sessions, host scripts, auction queues |
| `/admin/social` | `SocialIntegration` | Social commerce flow preview + webhook endpoint status |
| `/admin/monitor` | `ResourceMonitor` | Real-time DB stats, service health, feature status |

### RLS Policies
Applied migrations:
- `007_fix_rls.sql` — authenticated users can SELECT all products (not just `status='approved'`)
- `008_campaigns.sql` — campaigns table with public read for active, auth manage

**Important**: Run both migrations in the Supabase dashboard SQL editor if not yet applied.

### API Routes (Vercel serverless)
- `/api/commerce/store-checkout` — create Yoco checkout, reserve stock (requires `SUPABASE_SERVICE_ROLE_KEY`)
- `/api/commerce/order-status` GET — **replaced by direct Supabase queries** in the frontend
- `/api/commerce/order-status` PATCH — update order status (still uses service role key, admin only)
- `/api/commerce/cancel-order` — cancel/resume checkout
- `/api/payments/yoco/webhook` — Yoco payment webhook
- `/api/ai/identify` — Gemini product image analysis
- `/api/ai/campaign` — Gemini campaign suggestions
- `/api/ai/personalize` — Gemini product recommendations
- `/api/ai/talking-points` — Gemini host scripts
- `/api/social/webhook` — TikTok/WhatsApp webhook with HMAC signature verification (endpoints ready, API keys pending)
- `/api/health` — service health check (Supabase, Gemini, Yoco, Resend key presence)

### Environment Variables (Vercel)
Required for full functionality:
- `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (public, safe in frontend)
- `SUPABASE_SERVICE_ROLE_KEY` (backend only — for API routes that need RLS bypass)
- `VITE_GEMINI_API_KEY` + `GEMINI_API_KEY`
- `YOCO_SECRET_KEY` + `YOCO_PUBLIC_KEY`
- `VITE_ADMIN_EMAILS` — comma-separated admin emails
- `TIKTOK_WEBHOOK_SECRET` + `WHATSAPP_APP_SECRET` + `WHATSAPP_VERIFY_TOKEN` (optional — enable social webhook verification)
- `RESEND_API_KEY` + `QUIRKIFY_FROM_EMAIL` (optional — order notification emails)

## Admin Access
- Admin email hardcoded in `src/services/profileService.ts`: `patengel85@gmail.com`
- Also checked via `VITE_ADMIN_EMAILS` env var
- Profile `role = 'admin'` in Supabase also grants access
- Admin redirect on login: `window.location.pathname === '/auth' || '/'` → `/admin`

## Known Limitations
- **Live streaming** (`LiveStreamRoom.tsx`) — Firestore session + auction management is fully wired. No WebRTC camera/stream backend yet; video feed is the remaining gap.
- **Social commerce** (`SocialIntegration.tsx`) — webhook endpoint + signature verification is production-ready. TikTok OAuth and WhatsApp Business API keys not yet connected; UI is an interactive preview.
- **`ResourceMonitor.tsx`** — fully wired to live Supabase + Firestore counts and `/api/health` endpoint. Feature status labels for Streaming/Social accurately reflect Beta state.
- **`PublicProfile.tsx`** — collection view is fully implemented (Firestore `users/{uid}/collection` + Supabase product join).
