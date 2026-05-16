# Schema Status — Live DB vs Code vs Local Migrations

**Audited:** 2026-05-16
**Live project:** `mvoigokzsaybwiogjpvr` (Quirkify, ACTIVE_HEALTHY, eu-west-1, Postgres 17)
**Method:** `mcp__supabase__list_tables`, `list_migrations`, direct `pg_proc` / `information_schema` queries, grep across `src/` and `api/`.

> TL;DR — the live database is **significantly more capable** than the codebase uses. Atomic auction bidding, wallet holds, stock locks, and settlement RPCs all exist server-side but the frontend either bypasses them or hasn't been wired. The next phases are largely about **using what already exists**, not building new SQL.

---

## 1. Tables — Live DB

30 tables in `public` schema, all RLS-enabled. Grouped by domain:

| Domain | Tables | Notes |
|---|---|---|
| Products | `products` (4 rows), `product_variants`, `review_queue`, `inventory_movements` | `inventory_movements` exists but **never written to from app code** |
| Profiles | `profiles` (4), `customers`, `customer_addresses` | Three identity tables — `customers` and `customer_addresses` not used by services |
| Orders | `orders` (40), `order_items` (37), `order_events` (18), `payment_events` (1), `courier_shipments` | Healthy data, wired end-to-end |
| Wallet | `wallet_accounts` (2), `wallet_ledger` (4), `wallet_holds` (0), `wallets` (0), `wallet_transactions` (0) | **`wallets`/`wallet_transactions` are deprecated** — new code uses `wallet_accounts`/`wallet_ledger`. `wallet_holds` exists, never written by app. |
| Auctions | `auctions` (0), `auction_bids` (0) | Live in Supabase per the new RPCs (was Firestore-only before) |
| Packs | `packs` (0), `pack_products` (0) | |
| Commerce ops | `store_listings` (1), `withdrawal_requests` (1), `offline_reservations` (1), `campaign_placements`, `campaigns`, `campaign_drafts` | |
| Misc | `notifications`, `collection_items`, `email_log` | |

**Missing entirely (vs plan targets):**
- `audit_logs` — required for Phase E

---

## 2. RPC functions — Live DB

37 functions in `public` namespace. The important ones the frontend isn't using:

| RPC | Purpose | Called from frontend? |
|---|---|---|
| `place_auction_bid(auction, bidder, amount)` | Atomic bid with hold creation + prior-bidder release | **NO** |
| `settle_auction(auction)` | Atomic winner-order + losing-bidder hold release + stock decrement + collection insert | **NO** |
| `wallet_debit_safe(profile, amount, ...)` | Debit with insufficient-balance check | **NO** |
| `decrement_product_stock(product, qty)` | Stock decrement under advisory lock | **NO** (only used inside other RPCs) |
| `wallet_purchase(...)` | Store checkout via wallet | **YES** — `api/commerce/[action].ts:163` |
| `create_store_checkout_order(...)` | Yoco checkout order creation | YES |
| `mark_order_payment_succeeded/failed` | Webhook handlers | YES |
| `request_withdrawal` / `approve_withdrawal` / `reject_withdrawal` | Withdrawal lifecycle | YES |
| `create_offline_reservation` / `resolve_offline_reservation` | Offline flow | YES |

**Bottom line:** auction bidding and settlement are server-ready but **not invoked** by the app — bids likely still go through Firestore (`src/services/auctionService.ts`), bypassing the atomic Supabase path.

---

## 3. `products` table columns (allocation model)

Actual columns: `stock`, `alloc_store`, `alloc_auction`, `alloc_packs`, `reserved_store`, `reserved_packs`, `discount_price`, `retail_price`, `status`.

**Discrepancies with code:**
- `src/services/productService.ts:67-69` reads `row.reserved_auction` — **column does not exist**. Falls back to 0 silently.
- The reconciliation formula in `CLAUDE.md` (`total = available + store + auction + pack + reserved + sold + removed`) **does not match the schema**. There is no `available_qty`, `sold_qty`, or `removed_qty` column.
- Actual invariants to enforce:
  - `alloc_store + alloc_auction + alloc_packs ≤ stock`
  - `reserved_store ≤ alloc_store`
  - `reserved_packs ≤ alloc_packs`
  - No equivalent for `reserved_auction` because that column is missing.

**No CHECK constraints currently enforce any of these invariants** (verified via missing entries in `pg_constraint` for relevant columns — needs a single migration to add them).

---

## 4. `inventory_movements` table — exists, unused

Schema: `id`, `product_id`, `delta`, `reason`, `reference_id`, `note`, `created_by`, `created_at`. Clean append-only audit log of stock changes. **No code writes to it.** Every stock change today is silent.

---

## 5. Local migrations vs live migrations

Local `supabase/migrations/` has 17 numbered files (001–017) plus `APPLY_ALL_PENDING.sql`. Live DB has 11 migrations in `supabase_migrations.schema_migrations` with **different names** and a different numbering scheme — local files were apparently re-bundled into a `quirkify_complete_foundation` migration on the live side, then 10 incremental migrations followed. The two critical ones not represented in the local files:

- `021_atomic_stock_wallet` — adds `decrement_product_stock` and `wallet_debit_safe`
- `022_auction_atomic_bidding` — adds `wallet_holds` table, `place_auction_bid`, `settle_auction`

**Action:** dump these from the live DB into local migration files so local schema-as-code stays the source of truth. Use the SQL we already have (captured in this audit).

---

## 6. Action list (feeds Phase C / D / E)

**Phase A delta (now):**
1. ✅ Build + typecheck pass (4 errors fixed; orphan `ProfileHub.tsx` deleted)
2. ✅ This document
3. **TODO** — sync local migrations with live: add `supabase/migrations/021_atomic_stock_wallet.sql` and `022_auction_atomic_bidding.sql`

**Phase C (Stock + allocation engine) — rescoped:**
- Add CHECK constraints to `products` for the three real invariants (`alloc_store + alloc_auction + alloc_packs ≤ stock`, etc.)
- Add `reserved_auction` column if auctions are moving to Supabase (or accept that auctions don't reserve at the product level — they reserve via `wallet_holds` instead)
- Wire `AllocationEditor.tsx` to a single new `allocationService.ts` that writes to `inventory_movements` on every change
- Add trigger or wrap allocation updates so `inventory_movements` is always populated

**Phase D (Wallet + checkout hardening) — mostly already done server-side:**
- Switch `src/services/auctionService.ts` to call `place_auction_bid` (Supabase RPC) instead of writing Firestore directly. Decide whether Firestore stays as a read-only mirror or is removed.
- Add a server-side cron / scheduled function to call `settle_auction` when `end_time` passes
- Audit `src/services/storeListingService.ts` (`fetchMyWallet`) to read from `wallet_accounts` (current correct table)
- Remove the deprecated `wallets` / `wallet_transactions` tables once code is verified to ignore them

**Phase E (Audit logs):**
- Create `audit_logs` table (new migration)
- Wrapper `src/lib/audit.ts` — call from every state-changing service
- Admin viewer at `/admin/audit`

---

## 7. Open questions for product owner

1. **Auctions backend** — are auctions moving fully to Supabase (`place_auction_bid` exists, ready to call), or is Firestore staying as the real-time bid feed with Supabase as the source of truth? Need a clear answer before Phase D wiring.
2. **`reserved_auction`** — should this column be added, or is the wallet-holds approach the canonical auction reservation mechanism? (Recommend the latter — simpler and already implemented.)
3. **`customers` and `customer_addresses` tables** — are these legacy from an earlier data model, or intended for a planned guest-checkout flow? They're currently inert.
4. **Deprecated `wallets` / `wallet_transactions`** — safe to drop? Both have 0 rows.
