# Production Wiring Checklist

Running list of manual setup steps that the code expects but that live outside the repo (Vercel env vars, third-party accounts, GitHub settings, Supabase dashboard toggles). Each item maps to a feature already shipped to `main`. Tick off as you complete them — the code silently no-ops or stays in fallback mode until each one is wired.

> **Convention:** anything with a `VITE_` prefix is exposed in the frontend bundle (safe for public values like DSNs and publishable keys). Anything without `VITE_` is server-only — never re-export under a `VITE_` name or you'll leak it to every browser.

---

## 1. External accounts to create

- [ ] **Sentry** — create org + project named `quirkify-web` (free tier is fine for now).
  - Note the **DSN** (Settings → Projects → quirkify-web → Client Keys).
  - Create an **Internal Integration** (Settings → Custom Integrations → Create New Integration) with `project:releases` and `project:read` scopes. Save the token.
- [ ] **Vercel** project must be on a tier that supports cron jobs (Pro or higher). The free hobby tier does not run scheduled functions.

---

## 2. Vercel environment variables

Set in Vercel project → Settings → Environment Variables. Apply to **Production** unless noted otherwise.

### Settlement cron (commit `3ac41b4`)
- [ ] `CRON_SECRET` — random 32-char string. Vercel will auto-inject it as `Authorization: Bearer <value>` on every cron call to `/api/cron/settle-auctions`. Without this, the handler accepts unauthenticated requests (fine for staging, lock down for prod).

### Sentry frontend (commit `39d322b`)
- [ ] `VITE_SENTRY_DSN` — public DSN from Sentry. Production + Preview environments.
- [ ] `SENTRY_AUTH_TOKEN` — internal-integration token. Production only.
- [ ] `SENTRY_ORG` — your Sentry org slug. Production only.
- [ ] `SENTRY_PROJECT` — `quirkify-web` (or whatever you named it). Production only.

### Sentry backend (commit `d921a71`)
- [ ] `SENTRY_DSN` — same DSN value as `VITE_SENTRY_DSN`, but stored under this name so `@sentry/node` in API routes can find it. Production + Preview.

---

## 3. GitHub repo settings

### CI branch protection (commit `aaa0841`)
- [ ] In Settings → Branches → add a branch protection rule for `main`:
  - **Require status checks to pass before merging**: enable
  - **Required check**: `typecheck + build` (the job name from `.github/workflows/ci.yml`)
  - **Require branches to be up to date before merging**: recommended
  - **Do not allow bypassing the above settings**: enable for `main`

### CI source-map upload (commit `aaa0841`)
If you want CI to also upload source maps to Sentry on each merge to `main` (not just Vercel-side):
- [ ] Add **repository secrets** mirroring the Vercel ones: `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`. The CI workflow already injects `VERCEL_GIT_COMMIT_SHA: ${{ github.sha }}` so releases are tagged.

---

## 4. Supabase dashboard (production project `mvoigokzsaybwiogjpvr`)

### Backups
- [ ] Confirm Point-in-Time Recovery is enabled in Database → Backups. PITR is included in Pro tier and above. Document the retention window (typically 7 days on Pro, up to 30 on Team).
- [ ] Practice a restore once on the inactive staging project (`pcrbshmqstjjwfudqenq`) to verify the runbook.

### Migrations applied so far (no action needed — already live)
- ✅ 021 atomic stock + wallet RPCs
- ✅ 022 auction atomic bidding + settle_auction
- ✅ 023 allocation constraints + set_product_allocations RPC + inventory_movements
- ✅ 024 audit_logs table + log_audit RPC

---

## 5. Verification once wired

After ticking the above, smoke-test each feature end-to-end:

- [ ] **Settlement cron**: create a 2-min auction in staging, bid, wait, verify auction settles, winner order created, email sent, `audit_logs` shows `order.status_change`.
- [ ] **Frontend Sentry**: from a deployed preview, open DevTools console and run `throw new Error('sentry smoke test')`. Verify the event appears in the Sentry dashboard within 30s with the React component stack and your profile email tagged. Confirm the stack trace is **not minified** (proves source-map upload worked).
- [ ] **Backend Sentry**: hit a deployed API route in a way that throws (e.g. `POST /api/commerce/store-checkout` with malformed body), verify the event appears with route + method tags.
- [ ] **CI**: open a PR with a deliberate `const x: number = 'string'` somewhere, verify the `typecheck + build` job goes red and merge is blocked.

---

*Last updated: maintained alongside production-readiness work in `/root/.claude/plans/what-s-your-thoughts-on-cosmic-tide.md`.*
