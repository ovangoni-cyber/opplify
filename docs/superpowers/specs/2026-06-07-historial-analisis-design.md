# Historial de Análisis Design

**Date:** 2026-06-07  
**Status:** Approved

## Context

Users run multiple market analyses but have no way to revisit past searches without re-spending credits. All analyses are already saved in the `analyses` table, but that table is a shared cache with no `user_id`. We need to track each user's search history separately.

## Decision

Add a `search_history` table that records every search a user runs (including cache hits). Display this history on a dedicated `/historial` page linked from the navbar.

## Database

New migration `supabase/migrations/0004_search_history.sql`:

```sql
create table search_history (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  city        text not null,
  business_type text,
  mode        text not null,
  created_at  timestamptz default now()
);

alter table search_history enable row level security;

create policy "Users read own history"
  on search_history for select
  using (auth.uid() = user_id);

create policy "Users insert own history"
  on search_history for insert
  with check (auth.uid() = user_id);

create index idx_search_history_user
  on search_history (user_id, created_at desc);
```

## Data Flow

**Where history is saved:** `src/hooks/useAnalysisStream.ts` — in the `analyze()` function, before the fetch call, insert a row into `search_history` using `supabaseBrowser`. This happens on every search regardless of cache hit/miss.

Insert only when user is authenticated (session has `access_token`). On insert error: log and continue — history failure must never block the main analysis.

```ts
// In analyze(), before the fetch:
try {
  await supabaseBrowser.from('search_history').insert({
    city: params.city,
    business_type: params.business_type || null,
    mode: params.mode,
  })
} catch {
  // non-fatal
}
```

## Page: `/historial`

**File:** `src/app/historial/page.tsx` — client component (`'use client'`)

**Auth gate:** On mount, if no session, redirect to `/auth/login?redirect=/historial`.

**Data fetch:** Query `search_history` for current user, ordered by `created_at desc`, limit 50.

**UI structure:**
- Sticky header (reuse same pattern as ResultsDashboard header) with logo + "Nueva búsqueda" link + credits + sign out
- Page title "Mis análisis" with count badge
- List of history cards, one per row:
  - Left: city (bold) · business_type (muted) | mode badge | relative date (e.g. "hace 2 días")
  - Right: "Ver análisis →" link to `/results?city=...&business_type=...&mode=...`
- Empty state: "Todavía no hiciste ningún análisis." + button to `/buscar`

**Mode badge colors:**
- `market_research` → label "Investigación", cyan/primary tint
- `agency_leads` → label "Leads", purple tint

## Navbar Integration

Add "Historial" link in two places, visible only when user is authenticated:

1. `src/app/page.tsx` — in the nav right-side div, before ThemeSwitcher
2. `src/components/results/ResultsDashboard.tsx` — in the Header, before ThemeSwitcher

Link: `<Link href="/historial">` with same muted text style as other nav links.

## Non-goals

- No pagination (limit 50 is sufficient for now)
- No search/filter within history
- No delete individual entries
- No deduplication (same search twice = two rows — shows actual usage)

## Files Changed

| Action | File |
|--------|------|
| Create | `supabase/migrations/0004_search_history.sql` |
| Modify | `src/hooks/useAnalysisStream.ts` |
| Create | `src/app/historial/page.tsx` |
| Modify | `src/app/page.tsx` |
| Modify | `src/components/results/ResultsDashboard.tsx` |

## Verification

1. Run migration in Supabase SQL editor
2. Run an analysis → check `search_history` table has a new row with correct `user_id`
3. Navigate to `/historial` → see the entry
4. Click "Ver análisis →" → navigates to `/results` with correct params and loads cached result
5. Empty state: new user with no history sees the empty message
6. `npx tsc --noEmit` → no errors
