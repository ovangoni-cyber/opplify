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
               ├─ 1. Auth check (Bearer token → Supabase)
               ├─ 2. Credit check (decrement_credit RPC) — skipped for TEST_USER_ID, skipped on cache hits
               ├─ 3. Cache check (Supabase, 24h TTL) — skipped when `exclude` is set
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

### Key files and their responsibilities

| File | Responsibility |
|------|---------------|
| `src/app/api/analyze/route.ts` | Full pipeline orchestrator. Node.js runtime. Returns `ReadableStream`. Inserts to `search_history` before `writer.close()`. Deduplicates history inserts within 5-minute window. |
| `src/app/api/pitch/route.ts` | Node runtime. Auth check + Claude call → `{subject, body}` for cold outreach emails. |
| `src/app/api/checkout/route.ts` | Node runtime. Creates Stripe Checkout session for credit purchases. |
| `src/app/api/stripe/webhook/route.ts` | Node runtime. Verifies Stripe signature, calls `add_credits` RPC on `checkout.session.completed`. |
| `src/app/api/credits/route.ts` | Node runtime. Returns current credit balance for authenticated user. |
| `src/lib/google-places.ts` | Fetches and normalizes Places API data. Pure helpers tested by unit tests. |
| `src/lib/claude.ts` | Builds prompts (one per mode), streams Claude response, parses `---JSON---` section. Uses `max_tokens: 8192` — do not lower it. |
| `src/lib/analysis-cache.ts` | 24h cache read/write via Supabase. Uses generated `cache_key` column. |
| `src/lib/supabase.ts` | Supabase service-role client — **throws at module load** if env vars are missing. |
| `src/lib/supabase-browser.ts` | Browser Supabase client with `flowType: 'implicit'`. Import only from client components. |
| `src/lib/stripe.ts` | Stripe SDK — **server-only**. Never import from client components or `'use client'` files. |
| `src/lib/credit-packs.ts` | Client-safe pack definitions (name, price, credits). No Stripe import. Use in client components instead of `stripe.ts`. |
| `src/lib/export-csv.ts` | Converts `AgencyLead[]` to downloadable CSV. Pure function, no network calls. |
| `src/hooks/useAnalysisStream.ts` | Client-side streaming state machine. Manages all `StreamPhase` transitions. |
| `src/hooks/useAuth.ts` | Auth state hook. Returns `{ user, session, loading }` from Supabase. |
| `src/components/ThemeProvider.tsx` | React context + `useTheme()` hook. Reads/writes `localStorage` key `'theme'`. |
| `src/components/ThemeSwitcher.tsx` | Two pill buttons (Dark / Light) that call `setTheme()`. |
| `src/components/CreditsBadge.tsx` | Self-contained component that fetches and displays credit balance. Used in all navbars. |
| `src/types/analysis.ts` | Single source of truth for all shared types (backend + frontend). |

### Auth & credits

Auth uses Supabase email+password (no magic link). "Confirm email" must be **disabled** in Supabase Auth settings for instant registration. Register form collects full profile (name, surname, DOB, phone, country) stored in `user_metadata`.

The analyze route gates on two things before running the pipeline:
1. **Auth** — reads `Authorization: Bearer <token>` header, calls `supabaseAdmin.auth.getUser(token)`. Returns HTTP 401 if missing/invalid.
2. **Credits** — calls `decrement_credit(user_id)` RPC. Returns HTTP 402 if it returns `-1` (exhausted). Skipped entirely if `user.id === process.env.TEST_USER_ID`. Cache hits also skip this check.

`useAnalysisStream` maps HTTP 401 → `ERR_UNAUTHENTICATED`, HTTP 402 → `ERR_NO_CREDITS`. `ResultsDashboard` renders dedicated screens for each.

**Critical:** Never import `src/lib/stripe.ts` from a client component — it throws in the browser because `STRIPE_SECRET_KEY` is undefined client-side.

Payment routes (all Node runtime):
- `POST /api/checkout` — verifies auth token, creates Stripe Checkout session
- `POST /api/stripe/webhook` — verifies Stripe signature, calls `add_credits` RPC on `checkout.session.completed`
- `GET /api/credits` — returns current credit balance for the authenticated user

### Runtime constraints

**All API routes must use Node.js runtime** (`export const runtime = 'nodejs'`). The Anthropic SDK and Supabase admin client use Node.js-specific modules (`node:crypto`, `node:stream`, etc.) that are incompatible with the Edge Runtime. Never add `export const runtime = 'edge'` to any route.

Pages that use `useSearchParams()` must wrap the component in a `<Suspense>` boundary — required for Next.js static generation to work. See `src/app/auth/login/page.tsx` and `src/app/auth/callback/page.tsx` for the pattern.

### Theme system

Two themes: `dark` (default, `#06060f` bg) and `light` (white). Controlled via `data-theme` attribute on `<html>`. An inline `<script>` in `layout.tsx` reads `localStorage` before first paint to prevent flash.

All colors use CSS custom properties — never hardcode `text-cyan-400` or similar Tailwind color classes. Use `text-primary`, `bg-primary`, `border-primary`, etc. The exception is semantic colors that don't change with theme: `text-amber-400`, `text-rose-400` (used for mid/low scores).

Score/label color convention: `>=70 → text-primary`, `>=40 → text-amber-400`, `<40 → text-rose-400`.

### Data flow details

- `searchParams` in `src/app/results/page.tsx` is a `Promise` (Next.js 16 pattern) — always `await` it.
- `supabaseAdmin` uses the **service role key** — never use client-side. Bypasses RLS.
- `search_history` insert happens inside `.then(async (result) => { ... await writer.close() })` — BEFORE `writer.close()`, not after. Deduplication checks for same user+city+mode+business_type within 5 minutes before inserting.
- `saveAnalysis` (cache) runs fire-and-forget after `writer.close()` via a separate `streamPromise.then()`.
- `let context!: PlacesContext` uses a definite assignment assertion — the try block always returns on error.
- `useAnalysisStream` preserves streamed `summary` text through `streaming_json` → `complete` transition.

### What is and is not tested

Unit tests cover only **pure functions** with no network calls:
- `google-places.ts`: `priceLevelFromString`, `calculateAvgRating`, `buildRatingDistribution`
- `claude.ts`: `parseAnalysisJson`, `parseAgencyLeadsJson`
- `analysis-cache.ts`: `buildCacheKey`
- `export-csv.ts`: `exportLeadsToCSV`
- `supabase.ts`: export existence (mocks `@supabase/supabase-js`)

The API route, hooks, and UI components are not unit tested.

## Design system

Two themes via CSS custom properties in `src/app/globals.css`. Theme blocks: `:root` (dark fallback), `[data-theme="light"]`, `[data-theme="dark"]`.

Fonts via `next/font/google`: **Syne** (headings — `font-heading` class) + **DM Sans** (body — default sans).

User email displays as a pill with avatar initial in all navbars. Credit balance displays via `<CreditsBadge />` which self-fetches from `/api/credits`.

## Deployment

Deployed on Vercel at `https://opplify-lfxu.vercel.app`. Branch: `master`. All API routes use Node.js runtime — do not switch to Edge.

For local Stripe webhook testing: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.

## Environment variables

Required in `.env.local`:
```
GOOGLE_PLACES_API_KEY=      # Google Cloud, Places API (New) enabled
ANTHROPIC_API_KEY=          # console.anthropic.com
NEXT_PUBLIC_SUPABASE_URL=   # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=  # used server-side only
STRIPE_SECRET_KEY=          # stripe.com dashboard → Developers → API keys
STRIPE_WEBHOOK_SECRET=      # stripe.com → Webhooks → signing secret (or `stripe listen` secret locally)
STRIPE_PRICE_STARTER=       # Stripe Price ID for 5-credit pack (e.g. price_xxx)
STRIPE_PRICE_PRO=           # Stripe Price ID for 20-credit pack
NEXT_PUBLIC_SITE_URL=       # Full URL, e.g. https://opplify-lfxu.vercel.app (http://localhost:3000 for dev)
TEST_USER_ID=               # Supabase user UUID that bypasses credit check entirely
```

DB migrations (apply in order via Supabase SQL editor):
- `supabase/migrations/0001_analyses.sql`
- `supabase/migrations/0002_add_mode_column.sql`
- `supabase/migrations/0003_credits.sql` — user_credits table, RPCs (decrement_credit, add_credits), new-user trigger
- `supabase/migrations/0004_search_history.sql` — search_history table with RLS

After applying migrations, run `SELECT pg_notify('pgrst', 'reload schema')` to refresh PostgREST's schema cache.

**Stripe setup:** Create two one-time products in Stripe (not subscriptions), copy the Price IDs into env vars.

## Google Places API notes

- Uses the **New** Places API (`places.googleapis.com/v1`), not the legacy Maps API.
- `POST /places:searchText` with `X-Goog-FieldMask` header for field selection.
- `maxResultCount: 20` is only sent on the first page — omit it on paginated requests (pagination uses `pageToken` only).
- Reviews are fetched sequentially (not `Promise.all`) to avoid rate limits, capped at 10 businesses.
