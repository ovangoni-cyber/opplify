# Historial de Análisis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record every user search in a `search_history` table and display it on a dedicated `/historial` page linked from the navbar.

**Architecture:** New Supabase table `search_history` with RLS. Client-side insert in `useAnalysisStream.ts` before each fetch (non-fatal). New client component page at `/historial`. Navbar links in `page.tsx` and `ResultsDashboard.tsx`.

**Tech Stack:** Next.js 16, React, Supabase Browser Client, Tailwind CSS, TypeScript

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `supabase/migrations/0004_search_history.sql` | Table + RLS + index |
| Modify | `src/hooks/useAnalysisStream.ts` | Insert history row before fetch |
| Create | `src/app/historial/page.tsx` | History list page with auth gate |
| Modify | `src/app/page.tsx` | Add Historial nav link |
| Modify | `src/components/results/ResultsDashboard.tsx` | Add Historial nav link to Header |

---

## Task 1: Migration file

**Files:**
- Create: `supabase/migrations/0004_search_history.sql`

- [ ] **Step 1: Create the migration file**

```sql
create table search_history (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  city          text not null,
  business_type text,
  mode          text not null,
  created_at    timestamptz default now()
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

- [ ] **Step 2: Run in Supabase SQL editor**

Copy the contents of `supabase/migrations/0004_search_history.sql` and run it in the Supabase dashboard → SQL editor. Expected: no errors, table `search_history` appears in Table Editor.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0004_search_history.sql
git commit -m "feat: add search_history table with RLS"
```

---

## Task 2: Insert history in useAnalysisStream

**Files:**
- Modify: `src/hooks/useAnalysisStream.ts`

- [ ] **Step 1: Add history insert after session fetch**

In `src/hooks/useAnalysisStream.ts`, find the `analyze` function. After this block:

```ts
const { data: sessionData } = await supabaseBrowser.auth.getSession()
const token = sessionData.session?.access_token
```

Add the history insert (non-fatal — errors are caught and ignored):

```ts
// Record search in history (non-fatal)
if (sessionData.session?.user?.id) {
  supabaseBrowser.from('search_history').insert({
    city: params.city,
    business_type: params.business_type || null,
    mode: params.mode,
  }).then(() => {}).catch(() => {})
}
```

The full updated `analyze` function start should look like:

```ts
const analyze = useCallback(async (params: SearchParams) => {
  setState({ phase: 'loading', summary: '', result: null, error: null })

  try {
    const { data: sessionData } = await supabaseBrowser.auth.getSession()
    const token = sessionData.session?.access_token

    // Record search in history (non-fatal)
    if (sessionData.session?.user?.id) {
      supabaseBrowser.from('search_history').insert({
        city: params.city,
        business_type: params.business_type || null,
        mode: params.mode,
      }).then(() => {}).catch(() => {})
    }

    const res = await fetch('/api/analyze', {
      // ... rest unchanged
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useAnalysisStream.ts
git commit -m "feat: record search history on every analysis"
```

---

## Task 3: /historial page

**Files:**
- Create: `src/app/historial/page.tsx`

- [ ] **Step 1: Create the page file**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabaseBrowser } from '@/lib/supabase-browser'
import { ThemeSwitcher } from '@/components/ThemeSwitcher'
import { useAuth } from '@/hooks/useAuth'

type HistoryEntry = {
  id: string
  city: string
  business_type: string | null
  mode: string
  created_at: string
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `hace ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `hace ${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'ayer'
  if (days < 7) return `hace ${days} días`
  return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short' })
}

function ModeBadge({ mode }: { mode: string }) {
  if (mode === 'agency_leads') {
    return (
      <span className="text-[9px] uppercase tracking-[0.12em] font-medium px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
        Leads
      </span>
    )
  }
  return (
    <span className="text-[9px] uppercase tracking-[0.12em] font-medium px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
      Investigación
    </span>
  )
}

export default function HistorialPage() {
  const router = useRouter()
  const { user, session, loading: authLoading } = useAuth()
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace('/auth/login?redirect=/historial')
      return
    }

    supabaseBrowser
      .from('search_history')
      .select('id, city, business_type, mode, created_at')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setEntries(data ?? [])
        setLoading(false)
      })
  }, [user, authLoading, router])

  const handleSignOut = async () => {
    await supabaseBrowser.auth.signOut()
    router.push('/')
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="font-heading font-bold text-sm tracking-tight hover:text-primary transition-colors">
            oportunity<span className="text-primary">.</span>ai
          </Link>
          <div className="flex items-center gap-3">
            <ThemeSwitcher />
            <Link href="/buscar" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Nueva búsqueda
            </Link>
            <button
              onClick={handleSignOut}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Salir
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center gap-3 mb-8">
          <h1 className="font-heading font-bold text-2xl tracking-tight" style={{ letterSpacing: '-0.02em' }}>
            Mis análisis
          </h1>
          {!loading && entries.length > 0 && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
              {entries.length}
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-20 space-y-4">
            <p className="text-sm text-muted-foreground">Todavía no hiciste ningún análisis.</p>
            <Link
              href="/buscar"
              className="inline-block px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              Hacer mi primer análisis →
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
            {entries.map((entry) => {
              const qs = new URLSearchParams({ city: entry.city, mode: entry.mode })
              if (entry.business_type) qs.set('business_type', entry.business_type)
              return (
                <div key={entry.id} className="flex items-center justify-between gap-4 px-5 py-4 bg-card hover:bg-muted/30 transition-colors">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-foreground capitalize">{entry.city}</span>
                      {entry.business_type && (
                        <span className="text-xs text-muted-foreground capitalize">· {entry.business_type}</span>
                      )}
                      <ModeBadge mode={entry.mode} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{relativeTime(entry.created_at)}</p>
                  </div>
                  <Link
                    href={`/results?${qs.toString()}`}
                    className="text-xs font-medium text-primary hover:text-primary/80 transition-colors whitespace-nowrap shrink-0"
                  >
                    Ver análisis →
                  </Link>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/app/historial/page.tsx
git commit -m "feat: add /historial page with user search history"
```

---

## Task 4: Navbar links

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/components/results/ResultsDashboard.tsx`

- [ ] **Step 1: Add Historial link to landing page nav**

In `src/app/page.tsx`, find the nav right-side div:

```tsx
<div className="flex items-center gap-3">
  <ThemeSwitcher />
  {user ? (
```

Add a Historial link right after `<ThemeSwitcher />`, only when user is logged in:

```tsx
<div className="flex items-center gap-3">
  <ThemeSwitcher />
  {user && (
    <Link
      href="/historial"
      className="text-xs text-muted-foreground hover:text-foreground transition-colors hidden sm:block"
    >
      Historial
    </Link>
  )}
  {user ? (
```

- [ ] **Step 2: Add Historial link to ResultsDashboard Header**

In `src/components/results/ResultsDashboard.tsx`, find the Header's nav div. After `<ThemeSwitcher />`, add:

```tsx
<ThemeSwitcher />
<Link
  href="/historial"
  className="text-xs text-muted-foreground hover:text-foreground transition-colors hidden sm:block"
>
  Historial
</Link>
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx src/components/results/ResultsDashboard.tsx
git commit -m "feat: add Historial nav link to landing and results header"
```

---

## Task 5: End-to-end verification

- [ ] **Step 1: Confirm migration ran**

In Supabase dashboard → Table Editor → verify `search_history` table exists with columns: `id`, `user_id`, `city`, `business_type`, `mode`, `created_at`.

- [ ] **Step 2: Run an analysis and check history**

On `http://localhost:3000`, log in, run any analysis. Then go to Supabase → Table Editor → `search_history` — verify a row was inserted with the correct `user_id`, `city`, `mode`.

- [ ] **Step 3: Visit /historial**

Navigate to `http://localhost:3000/historial`. The entry from Step 2 should appear with city, mode badge, relative time, and "Ver análisis →" link.

- [ ] **Step 4: Click "Ver análisis →"**

Click the link. Should navigate to `/results?city=...&mode=...` and load the cached result without consuming a credit.

- [ ] **Step 5: Verify empty state**

Log in as a user with no history (or clear the table). Navigate to `/historial` — should show "Todavía no hiciste ningún análisis." with a CTA button.

- [ ] **Step 6: Verify Historial link in navbar**

On the landing page, confirm "Historial" link appears in the nav when logged in. On the results page, confirm it appears in the header.

- [ ] **Step 7: TypeScript final check**

```bash
npx tsc --noEmit
```

Expected: no output.
