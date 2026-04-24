# Quirkify Live

Canonical Quirkify production repo.

## Canonical Production Path

- GitHub deploy branch: `main`
- Canonical Vercel project: `quirkify-1`
- Canonical public alias: `https://quirkify-1.vercel.app`
- Intended custom domain: `https://www.quirkify.co.za`
- The older `quirkify-live` Vercel project is not the production source of truth.

## Architecture

- Supabase Postgres is the primary source of truth for products, packs, orders, profiles, wallet, and campaign drafts.
- Firebase handles auth, storage, and realtime auction/live-session surfaces.
- Vercel API routes in `api/` handle privileged commerce, payment, shipping, and AI flows.

## Product Surfaces

Customer:
- `/`
- `/product/:id`
- `/checkout`
- `/orders`
- `/auctions`
- `/collection`
- `/auth`

Admin:
- `/admin`
- `/admin/inventory`
- `/admin/orders`
- `/admin/campaigns`

## Local Run

```bash
npm install
npm run dev
```

## Required Environment

Frontend:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_ADMIN_EMAILS`

Backend:
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`
- `YOCO_SECRET_KEY`
- `TCG_API_KEY`

Optional:
- `VITE_MAPBOX_ACCESS_TOKEN`
- `TCG_COLLECTION_LAT`
- `TCG_COLLECTION_LNG`
- `TCG_COLLECTION_STREET`
- `TCG_COLLECTION_SUBURB`
- `TCG_COLLECTION_CITY`
- `TCG_COLLECTION_POSTAL`
- `TCG_COLLECTION_ZONE`
- `TCG_COLLECTION_ENTERED`

## Verification

```bash
npm run lint
npm run build
```

## Database Notes

- Apply Supabase migrations before relying on admin inventory and growth surfaces.
- `supabase/migrations/007_campaign_drafts.sql` adds campaign draft persistence for the Growth page.
