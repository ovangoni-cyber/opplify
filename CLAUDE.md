# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Critical: Next.js version

This project uses **Next.js 16.2.6** — not Next.js 14 or 15. APIs and conventions differ from training data. Before touching any Next.js-specific code (layouts, routing, server components, `searchParams`, middleware), read the relevant guide in `node_modules/next/dist/docs/`. Heed deprecation notices.

## Commands

```bash
npm run dev        # start dev server (http://localhost:3000)
npm test           # run all unit tests (vitest run)
npm run test:watch # vitest in watch mode
npx tsc --noEmit   # type check (no output = clean)
npm run lint       # eslint
npm run build      # production build
```

Run a single test file:
```bash
npx vitest run src/lib/__tests__/google-places.test.ts
```

On Windows, refresh PATH before running node commands if they fail:
```powershell
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
```

## Architecture

Single Next.js app. The analysis pipeline lives in one Node.js API route — no microservices, no background workers.

```
Browser → POST /api/analyze (Node.js runtime)
               ├─ 1. Auth check (Bearer token → JWT verify)
               ├─ 2. Cache check (local Postgres, 24h TTL, unbounded when `from_history` is set) — skipped when `exclude` is set; on hit, returns immediately (no credit charged)
               ├─ 3. Credit check (decrementCredit SQL) — skipped for TEST_USER_ID
               ├─ 4. Google Places fetch (up to ~40 businesses raw)
               ├─ 5. Filter by `exclude` list (Load More Leads pattern)
               ├─ 6. Claude streaming analysis (prompt uses top 20 businesses)
               ├─ 7. search_history insert (before writer.close(), skipped when `exclude` is set)
               └─ 8. Fire-and-forget cache save (after writer.close(), skipped when `exclude` is set)
```

### Two app modes (`AppMode`)

| Mode | Result type | Claude output |
|------|-------------|---------------|
| `market_research` | `AnalysisResult` | Executive summary + JSON with market/opportunities/pain_points/zones |
| `agency_leads` | `AgencyLeadsResult` | Thin summary + JSON array of `AgencyLead` objects with lead scores |

Both modes use the same two-phase streaming protocol and the same API route. The prompt and JSON schema differ per mode — see `buildPrompt` and `buildAgencyLeadsPrompt` in `src/lib/claude.ts`.

### Two-phase streaming protocol

```
[summary text streamed token by token]
---JSON---
{"market": {...}, "opportunities": [...], ...}
```

Cache hits use a different prefix: `---CACHED---\n---JSON---\n{JSON}`. The hook (`useAnalysisStream`) detects which path it's on and renders accordingly.

### Load More Leads (`exclude` param)

`SearchParams.exclude?: string[]` contains business names already shown. When non-empty: cache lookup is skipped, filtered businesses are excluded, cache save and history save are both skipped. Deduplication also runs client-side in `AgencyLeadsStream`.

### History view (`from_history` param)

`SearchParams.from_history?: boolean` is set by the "Ver análisis →" link in `/historial` (via `?from_history=1`), propagated through `/results` and `ResultsDashboard`, into the `/api/analyze` request body. When true, `getCachedAnalysis`'s `ignoreTtl` argument drops the 24h cutoff from the cache lookup, so a history view always hits the cache (and thus never charges a credit) regardless of how old the original analysis is — the cache-hit branch already returns before the credit-decrement code runs. Only the *lookup* is affected; cache save and history insert are unchanged. If no cache row exists at all for that `cache_key`/`mode` (rare — e.g. the original row was deleted), the request falls through to the normal paid path like any cache miss.

### Key files and their responsibilities

| File | Responsibility |
|------|---------------|
| `src/app/api/analyze/route.ts` | Full pipeline orchestrator. Node.js runtime. Returns `ReadableStream`. Inserts to `search_history` before `writer.close()`. Deduplicates history inserts within 5-minute window. |
| `src/app/api/pitch/route.ts` | Node runtime. Auth check + Claude call → `{subject, body}` for cold outreach emails. |
| `src/app/api/checkout/route.ts` | Node runtime. Creates Stripe Checkout session for credit purchases. |
| `src/app/api/stripe/webhook/route.ts` | Node runtime. Verifies Stripe signature, adds credits on `checkout.session.completed`. |
| `src/app/api/credits/route.ts` | Node runtime. Returns current credit balance for authenticated user. |
| `src/app/api/auth/login/route.ts` | Node runtime. Email + password → JWT. |
| `src/app/api/auth/register/route.ts` | Node runtime. Creates user in local Postgres + gives 1 initial credit. |
| `src/app/api/history/route.ts` | Node runtime. Returns search_history for authenticated user. |
| `src/app/api/branding/route.ts` | Node runtime. `GET` returns `{ agency_name, logo }` (logo as a data URL) for the authenticated user; `POST` upserts both, fully replacing the row each time — never a partial update. Edited from the same "Mis datos" card on `/ajustes` as `/api/profile`. |
| `src/app/api/profile/route.ts` | Node runtime. `GET` returns the registration profile fields (`first_name`/`last_name`/`dob`/`phone`/`country`) read from `users.metadata`, defaulting missing keys to `''`. `POST` updates those fields and, if `new_password` is present, verifies `current_password` via `bcrypt.compare` and updates `password_hash` — both writes happen in one transaction, so a wrong current password rolls back the profile-field update too. |
| `src/app/api/export/pdf/route.tsx` | Node runtime. `.tsx` extension because it renders JSX. Validates the client-echoed `result` via `validateResultForMode`, looks up `user_branding` (falls back to a generic Opplify.ai header if no row exists), picks one of two `@react-pdf/renderer` templates by `mode`, returns the PDF binary via `renderToBuffer`. |
| `src/lib/db.ts` | `pg` Pool singleton. All server-side DB access goes through this. |
| `src/lib/auth-server.ts` | `verifyToken` / `signToken` — server-only, uses `jsonwebtoken`. |
| `src/lib/auth-client.ts` | Browser auth utilities. Stores JWT in `localStorage`. Exposes `authClient` with `getSession`, `signInWithPassword`, `signUp`, `signOut`, `onAuthStateChange`. |
| `src/lib/google-places.ts` | Fetches and normalizes Places API data. Pure helpers tested by unit tests. |
| `src/lib/claude.ts` | Builds prompts (one per mode), streams Claude response, parses `---JSON---` section. Uses `max_tokens: 8192` — do not lower it. |
| `src/lib/analysis-cache.ts` | 24h cache read/write via local Postgres. Uses generated `cache_key` column. |
| `src/lib/branding.ts` | `validateLogo` (size/type checks) and `buildLogoDataUrl` for the `user_branding` table — agency name + logo shown on exported PDFs. |
| `src/lib/download-pdf.ts` | Client-side helper that calls `/api/export/pdf` and triggers a browser download of the returned binary. |
| `src/lib/pdf/colors.ts` | `PDF_COLORS` — fixed color palette for PDF templates (independent of the app's CSS-custom-property theme system, since `@react-pdf/renderer` can't read CSS vars). |
| `src/lib/pdf/validate-result.ts` | `validateResultForMode` — guards against rendering a PDF from a malformed/mismatched `AnalysisResult`/`AgencyLeadsResult` before it reaches a template. |
| `src/lib/pdf/market-research-template.tsx` | `MarketResearchPdf` — `@react-pdf/renderer` document for `market_research` mode. |
| `src/lib/pdf/agency-leads-template.tsx` | `AgencyLeadsPdf` — `@react-pdf/renderer` document for `agency_leads` mode. |
| `src/lib/stripe.ts` | Stripe SDK — **server-only**. Never import from client components or `'use client'` files. Exports `getStripe()`, not a top-level client — the client must be constructed lazily (on first call, not at module load) so importing this module doesn't require `STRIPE_SECRET_KEY` at build time, which breaks the Docker build (`next build` collects page data for `/api/stripe/webhook` at build time, with no env vars present in the builder stage). |
| `src/lib/credit-packs.ts` | Client-safe pack definitions (name, price, credits). No Stripe import. Use in client components instead of `stripe.ts`. |
| `src/lib/countries.ts` | `COUNTRIES` — shared 32-entry country list used by both the registration form (`auth/login/page.tsx`) and the profile editor (`ajustes/page.tsx`). |
| `src/lib/export-csv.ts` | Converts `AgencyLead[]` to downloadable CSV. Pure function, no network calls. |
| `src/hooks/useAnalysisStream.ts` | Client-side streaming state machine. Manages all `StreamPhase` transitions. |
| `src/hooks/useAuth.ts` | Auth state hook. Returns `{ user, session, loading }` using `authClient`. |
| `src/components/ThemeProvider.tsx` | React context + `useTheme()` hook. Reads/writes `localStorage` key `'theme'`. |
| `src/components/ThemeSwitcher.tsx` | Two pill buttons (Dark / Light) that call `setTheme()`. |
| `src/components/CreditsBadge.tsx` | Self-contained component that fetches and displays credit balance. Used in all navbars. |
| `src/components/NavMenu.tsx` | Self-contained hamburger-icon dropdown (Ajustes / Historial / Cerrar sesión). Used in all navbars instead of separate links. |
| `src/components/AppHeader.tsx` | Shared sticky header for `/buscar`, `/historial`, `/ajustes`, `/results` — logo + `ThemeSwitcher` + optional `children` slot for page-specific content + (`CreditsBadge`/email pill/`NavMenu` if logged in, else an "Acceder" button). The home page (`/`) has its own equivalent header, not migrated to this component. |
| `src/components/AppFooter.tsx` | Shared footer (logo + tagline) for the same four pages, no props. Matches the home page's existing footer markup. |
| `src/types/analysis.ts` | Single source of truth for all shared types (backend + frontend). |

### Auth & credits

Auth is custom JWT (HS256, 7-day expiry). Passwords hashed with `bcryptjs`. The browser stores the token in `localStorage` via `authClient` in `src/lib/auth-client.ts`. Server routes verify tokens with `verifyToken` from `src/lib/auth-server.ts`.

Register form collects full profile (name, surname, DOB, phone, country) stored in the `metadata` jsonb column of the `users` table.

The analyze route gates on two things before running the pipeline:
1. **Auth** — reads `Authorization: Bearer <token>` header, calls `verifyToken(token)`. Returns HTTP 401 if missing/invalid.
2. **Credits** — runs `UPDATE user_credits SET credits = credits - 1 WHERE user_id = $1 AND credits > 0`. Returns HTTP 402 if no rows updated (exhausted). Skipped if `payload.sub === process.env.TEST_USER_ID`. Cache hits also skip this check.

`useAnalysisStream` maps HTTP 401 → `ERR_UNAUTHENTICATED`, HTTP 402 → `ERR_NO_CREDITS`. `ResultsDashboard` renders dedicated screens for each.

**Critical:** Never import `src/lib/stripe.ts` from a client component — it throws in the browser because `STRIPE_SECRET_KEY` is undefined client-side.

### Runtime constraints

**All API routes must use Node.js runtime** (`export const runtime = 'nodejs'`). The Anthropic SDK and `pg` use Node.js-specific modules that are incompatible with the Edge Runtime. Never add `export const runtime = 'edge'` to any route.

Pages that use `useSearchParams()` must wrap the component in a `<Suspense>` boundary — required for Next.js static generation to work. See `src/app/auth/login/page.tsx` and `src/app/auth/callback/page.tsx` for the pattern.

### Theme system

Two themes: `dark` (default, `#06060f` bg) and `light` (white). Controlled via `data-theme` attribute on `<html>`. An inline `<script>` in `layout.tsx` reads `localStorage` before first paint to prevent flash.

All colors use CSS custom properties — never hardcode `text-cyan-400` or similar Tailwind color classes. Use `text-primary`, `bg-primary`, `border-primary`, etc. The exception is semantic colors that don't change with theme: `text-amber-400`, `text-rose-400` (used for mid/low scores).

Score/label color convention: `>=70 → text-primary`, `>=40 → text-amber-400`, `<40 → text-rose-400`.

### Data flow details

- `searchParams` in `src/app/results/page.tsx` is a `Promise` (Next.js 16 pattern) — always `await` it.
- `search_history` insert happens inside `.then(async (result) => { ... await writer.close() })` — BEFORE `writer.close()`, not after. Deduplication checks for same user+city+mode+business_type within 5 minutes before inserting.
- `saveAnalysis` (cache) runs fire-and-forget after `writer.close()` via a separate `streamPromise.then()`.
- `let context!: PlacesContext` uses a definite assignment assertion — the try block always returns on error.
- `useAnalysisStream` preserves streamed `summary` text through `streaming_json` → `complete` transition.

### What is and is not tested

Unit tests cover only **pure functions** with no network calls:
- `google-places.ts`: `priceLevelFromString`, `calculateAvgRating`, `buildRatingDistribution`
- `claude.ts`: `parseAnalysisJson`, `parseAgencyLeadsJson`
- `analysis-cache.ts`: `buildCacheKey` (mocks the `pg` pool)
- `export-csv.ts`: `exportLeadsToCSV`
- `branding.ts`: `validateLogo`
- `pdf/validate-result.ts`: `validateResultForMode`

The API routes, hooks, and UI components are not unit tested.

## Design system

Two themes via CSS custom properties in `src/app/globals.css`. Theme blocks: `:root` (dark fallback), `[data-theme="light"]`, `[data-theme="dark"]`.

Fonts via `next/font/google`: **Syne** (headings — `font-heading` class) + **DM Sans** (body — default sans).

User email displays as a pill with avatar initial in all navbars. Credit balance displays via `<CreditsBadge />` which self-fetches from `/api/credits`.

## Database

PostgreSQL — local Postgres for dev, a Postgres 16 Docker container (the `db` service in `docker-compose.yml`) on the production VPS. Same schema in both, no ORM, no migration runner: `database/schema.sql` is the source of truth, but changes to an already-running database (local or prod) are applied by hand with `psql` against `$DATABASE_URL` (locally) or via `docker compose exec -T db psql -U opplify -d opplify` (on the VPS). Tables: `users`, `analyses`, `user_credits`, `search_history`, `user_branding`.

The `analyses` table has a `cache_key` generated column (`lower(city) || ':' || lower(coalesce(business_type, '_all_'))`). Never set `cache_key` on insert — the DB computes it.

To add credits manually:
```sql
INSERT INTO user_credits (user_id, credits) VALUES ('<uuid>', 99999)
ON CONFLICT (user_id) DO UPDATE SET credits = user_credits.credits + 99999;
```

## Deployment

Self-hosted on a VPS (Hostealo, Madrid) at `http://78.40.111.107` — no domain or HTTPS yet (deferred until a domain is pointed at the server). **No longer on Vercel** — the Vercel project and its Neon Postgres database have been deleted.

**Stack:** Docker Compose, three services on one `docker-compose.yml` at `/opt/opplify` on the server:
- `app` — the Next.js app, built from the repo's `Dockerfile` (multi-stage, `node:20-alpine`, `npm run build` then `npm run start`), reachable only inside the Compose network on port 3000.
- `db` — `postgres:16`, data in the named volume `pgdata`, reachable only inside the Compose network on port 5432.
- `nginx` — `nginx:alpine`, the only service with a published port (`80:80`), reverse-proxies everything to `app:3000` (config in `nginx.conf`).

`app` and `db` both load secrets from `.env.production` on the server (never committed — same shape as `.env.local`, but `DATABASE_URL` uses the Compose service name `db` as host, not `localhost`, and three extra vars — `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` — initialize the Postgres container on first run).

**Deploy:** SSH in (`ssh -i ~/.ssh/opplify_vps root@78.40.111.107`) and run `/opt/opplify/deploy.sh`, which does `git pull origin master && docker compose up -d --build`. Manual, no CI/CD. **Note:** the GitHub repo's default branch is `feat/theme-system`, not `master` — a fresh `git clone` lands on the wrong branch; always `git checkout master` (or `git pull origin master` as `deploy.sh` does) explicitly.

**Backups:** `scripts/backup-db.sh` runs daily via cron at 03:00 server time (`pg_dump` → gzip → `/opt/opplify/backups/`, 7-day local retention, logged to `backups/cron.log`). Not copied off-server — local disk only, by design for now.

**Rollback:** `git checkout <previous-commit> && docker compose up -d --build` rebuilds from a known-good commit. Postgres data is untouched (lives in the `pgdata` volume, independent of the `app` container's lifecycle).

For local Stripe webhook testing: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.

## Environment variables

Required in `.env.local` (dev) / `.env.production` (VPS, not committed):
```
DATABASE_URL=               # local: postgresql://postgres:PASSWORD@localhost:5432/opplify — VPS: postgresql://opplify:PASSWORD@db:5432/opplify (Compose service name as host)
JWT_SECRET=                 # long random string (min 32 chars)
GOOGLE_PLACES_API_KEY=      # Google Cloud, Places API (New) enabled
ANTHROPIC_API_KEY=          # console.anthropic.com
STRIPE_SECRET_KEY=          # stripe.com dashboard → Developers → API keys
STRIPE_WEBHOOK_SECRET=      # stripe.com → Webhooks → signing secret (or `stripe listen` secret locally)
STRIPE_PRICE_STARTER=       # Stripe Price ID for 5-credit pack (e.g. price_xxx)
STRIPE_PRICE_PRO=           # Stripe Price ID for 20-credit pack
NEXT_PUBLIC_SITE_URL=       # Full URL, e.g. http://78.40.111.107 (http://localhost:3000 for dev)
TEST_USER_ID=               # Postgres user UUID that bypasses credit check entirely
```

On the VPS, `.env.production` additionally sets `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` (all `opplify`/`opplify`/a generated password) — these initialize the `db` container and must match the user/password/db in `DATABASE_URL` exactly.

**Stripe setup:** Create two one-time products in Stripe (not subscriptions), copy the Price IDs into env vars.

## Google Places API notes

- Uses the **New** Places API (`places.googleapis.com/v1`), not the legacy Maps API.
- `POST /places:searchText` with `X-Goog-FieldMask` header for field selection.
- `maxResultCount: 20` is only sent on the first page — omit it on paginated requests (pagination uses `pageToken` only).
- Reviews are fetched sequentially (not `Promise.all`) to avoid rate limits, capped at 10 businesses.
