# History No-Recharge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Viewing a past search from `/historial` must never charge a credit, regardless of how long ago the original analysis ran.

**Architecture:** `getCachedAnalysis` gains an `ignoreTtl` flag that, when true, drops the 24h `created_at` cutoff from its SQL query. `/api/analyze` reads a new `from_history` flag from the request body and forwards it as that fourth argument. Since the existing cache-hit branch already returns before the credit-decrement code runs, widening the cache lookup window for history views is the entire fix — no separate "skip the charge" logic is needed. The flag is threaded client-side from the "Ver análisis →" link in `/historial` through `/results` and into the `analyze()` call.

**Tech Stack:** Next.js 16.2.6 App Router, `pg`, TypeScript.

---

### Task 1: Add `ignoreTtl` to `getCachedAnalysis`

**Files:**
- Modify: `src/lib/analysis-cache.ts`

- [ ] **Step 1: Add the parameter and the TTL-less query branch**

Find:
```ts
export async function getCachedAnalysis(
  city: string,
  businessType: string | null,
  mode: AppMode
): Promise<CachedAnalysis | null> {
  const cacheKey = buildCacheKey(city, businessType)
  const cutoff = new Date(Date.now() - CACHE_TTL_HOURS * 60 * 60 * 1000).toISOString()

  const { rows } = await pool.query(
    'SELECT result, created_at FROM analyses WHERE cache_key = $1 AND mode = $2 AND created_at > $3 ORDER BY created_at DESC LIMIT 1',
    [cacheKey, mode, cutoff]
  )
  return rows[0] ?? null
}
```
Replace with:
```ts
export async function getCachedAnalysis(
  city: string,
  businessType: string | null,
  mode: AppMode,
  ignoreTtl = false
): Promise<CachedAnalysis | null> {
  const cacheKey = buildCacheKey(city, businessType)

  if (ignoreTtl) {
    const { rows } = await pool.query(
      'SELECT result, created_at FROM analyses WHERE cache_key = $1 AND mode = $2 ORDER BY created_at DESC LIMIT 1',
      [cacheKey, mode]
    )
    return rows[0] ?? null
  }

  const cutoff = new Date(Date.now() - CACHE_TTL_HOURS * 60 * 60 * 1000).toISOString()
  const { rows } = await pool.query(
    'SELECT result, created_at FROM analyses WHERE cache_key = $1 AND mode = $2 AND created_at > $3 ORDER BY created_at DESC LIMIT 1',
    [cacheKey, mode, cutoff]
  )
  return rows[0] ?? null
}
```

- [ ] **Step 2: Run the existing unit tests for this file**

```bash
npx vitest run src/lib/__tests__/analysis-cache.test.ts
```
Expected: all pass (this file only tests `buildCacheKey`, which is untouched — confirms no regression).

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/analysis-cache.ts
git commit -m "feat: add ignoreTtl option to getCachedAnalysis"
```

---

### Task 2: Add `from_history` to the `SearchParams` type

**Files:**
- Modify: `src/types/analysis.ts`

- [ ] **Step 1: Add the field**

Find:
```ts
export type SearchParams = {
  city: string
  business_type: string
  mode: AppMode
  exclude?: string[]
}
```
Replace with:
```ts
export type SearchParams = {
  city: string
  business_type: string
  mode: AppMode
  exclude?: string[]
  from_history?: boolean
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/types/analysis.ts
git commit -m "feat: add from_history field to SearchParams type"
```

---

### Task 3: Thread `from_history` through `/api/analyze`

**Files:**
- Modify: `src/app/api/analyze/route.ts`

- [ ] **Step 1: Read the flag from the request body**

Find:
```ts
  const city = body.city?.trim()
  const businessType = body.business_type?.trim() || null
  const mode: AppMode = body.mode === 'agency_leads' ? 'agency_leads' : 'market_research'
  const exclude: string[] = Array.isArray(body.exclude) ? body.exclude : []
  const hasExclusions = exclude.length > 0
```
Replace with:
```ts
  const city = body.city?.trim()
  const businessType = body.business_type?.trim() || null
  const mode: AppMode = body.mode === 'agency_leads' ? 'agency_leads' : 'market_research'
  const exclude: string[] = Array.isArray(body.exclude) ? body.exclude : []
  const hasExclusions = exclude.length > 0
  const fromHistory = body.from_history === true
```

- [ ] **Step 2: Pass it to `getCachedAnalysis`**

Find:
```ts
  if (!hasExclusions) {
    const cached = await getCachedAnalysis(city, businessType, mode)
    if (cached) {
```
Replace with:
```ts
  if (!hasExclusions) {
    const cached = await getCachedAnalysis(city, businessType, mode, fromHistory)
    if (cached) {
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/analyze/route.ts
git commit -m "feat: skip cache TTL when request comes from history"
```

---

### Task 4: Add `from_history=1` to the "Ver análisis →" link

**Files:**
- Modify: `src/app/historial/page.tsx`

- [ ] **Step 1: Add the query param**

Find:
```tsx
              const qs = new URLSearchParams({ city: entry.city, mode: entry.mode })
              if (entry.business_type) qs.set('business_type', entry.business_type)
              return (
```
Replace with:
```tsx
              const qs = new URLSearchParams({ city: entry.city, mode: entry.mode })
              if (entry.business_type) qs.set('business_type', entry.business_type)
              qs.set('from_history', '1')
              return (
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/historial/page.tsx
git commit -m "feat: mark history links so re-viewing never recharges a credit"
```

---

### Task 5: Propagate `from_history` through `/results` into `ResultsDashboard`

**Files:**
- Modify: `src/app/results/page.tsx`
- Modify: `src/components/results/ResultsDashboard.tsx`

- [ ] **Step 1: Read the param in `src/app/results/page.tsx`**

Find:
```tsx
import { ResultsDashboard } from '@/components/results/ResultsDashboard'
import type { AppMode } from '@/types/analysis'

type Props = {
  searchParams: Promise<{ city?: string; business_type?: string; mode?: string }>
}

export default async function ResultsPage({ searchParams }: Props) {
  const params = await searchParams
  const mode: AppMode = params.mode === 'agency_leads' ? 'agency_leads' : 'market_research'
  return (
    <ResultsDashboard
      city={params.city ?? ''}
      businessType={params.business_type ?? ''}
      mode={mode}
    />
  )
}
```
Replace with:
```tsx
import { ResultsDashboard } from '@/components/results/ResultsDashboard'
import type { AppMode } from '@/types/analysis'

type Props = {
  searchParams: Promise<{ city?: string; business_type?: string; mode?: string; from_history?: string }>
}

export default async function ResultsPage({ searchParams }: Props) {
  const params = await searchParams
  const mode: AppMode = params.mode === 'agency_leads' ? 'agency_leads' : 'market_research'
  return (
    <ResultsDashboard
      city={params.city ?? ''}
      businessType={params.business_type ?? ''}
      mode={mode}
      fromHistory={params.from_history === '1'}
    />
  )
}
```

- [ ] **Step 2: Accept the prop and pass it into `analyze()` in `src/components/results/ResultsDashboard.tsx`**

Find:
```tsx
type Props = {
  city: string
  businessType: string
  mode: AppMode
}

export function ResultsDashboard({ city, businessType, mode }: Props) {
  const router = useRouter()
  const { state, analyze } = useAnalysisStream()
  const { user, loading: authLoading } = useAuth()

  // Redirect if not authenticated once auth resolves
  useEffect(() => {
    if (authLoading) return
    if (!user) {
      const redirect = encodeURIComponent(window.location.pathname + window.location.search)
      router.push(`/auth/login?redirect=${redirect}`)
      return
    }
    if (city) {
      analyze({ city, business_type: businessType, mode })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, businessType, mode, user, authLoading])
```
Replace with:
```tsx
type Props = {
  city: string
  businessType: string
  mode: AppMode
  fromHistory?: boolean
}

export function ResultsDashboard({ city, businessType, mode, fromHistory }: Props) {
  const router = useRouter()
  const { state, analyze } = useAnalysisStream()
  const { user, loading: authLoading } = useAuth()

  // Redirect if not authenticated once auth resolves
  useEffect(() => {
    if (authLoading) return
    if (!user) {
      const redirect = encodeURIComponent(window.location.pathname + window.location.search)
      router.push(`/auth/login?redirect=${redirect}`)
      return
    }
    if (city) {
      analyze({ city, business_type: businessType, mode, from_history: fromHistory })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, businessType, mode, fromHistory, user, authLoading])
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/results/page.tsx src/components/results/ResultsDashboard.tsx
git commit -m "feat: propagate from_history from results page into analyze()"
```

---

### Task 6: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full automated suite**

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
```
Expected: all four pass clean.

- [ ] **Step 2: Functional verification against the local dev Postgres**

This bug only manifests when the cached analysis is older than 24h, so verify it directly against the database rather than waiting a day. With the dev server running (`npm run dev`) and `psql` available against the local `DATABASE_URL`:

1. Run a real search through the app (or via `curl` against `/api/analyze`) for a test city, e.g. `Madrid` with `business_type` empty and `mode=market_research`, so a row lands in `analyses` and one in `search_history`.
2. Manually age that cache row past the 24h TTL:
   ```sql
   UPDATE analyses SET created_at = now() - interval '25 hours'
   WHERE cache_key = 'madrid:_all_' AND mode = 'market_research';
   ```
3. Confirm the **old, fixed bug still exists for a non-history search**: call `/api/analyze` for the same city/mode with `from_history` absent (or `false`) — confirm it does NOT find the cache (now past TTL) and proceeds to the normal paid path (this is expected, unchanged behavior — don't actually let it charge a real test account's credit if you want to avoid burning one, or use the account whose `user_id` matches `TEST_USER_ID` to skip the charge while still confirming the cache-miss happened, e.g. by checking server logs / response timing — a cache hit returns near-instantly with a `---CACHED---` prefix, a cache miss takes much longer and streams token-by-token).
4. Confirm the fix: call `/api/analyze` for the same city/mode with `"from_history": true` in the body — confirm the response starts with `---CACHED---` (instant return) and that `user_credits` for the test account did not decrease.
5. In the browser: visit `/historial`, click "Ver análisis →" on an entry, confirm the URL includes `from_history=1` and the page loads the result instantly (cache-hit UX, no streaming text) regardless of how old that entry is, and that `/api/credits` for that account shows no change before/after.

- [ ] **Step 3: Report results**

No commit for this task — it's verification only. Report PASS/FAIL with specifics for any failed check.
