# App Shell Consistency (AppHeader + AppFooter) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the duplicated, inconsistent headers (and missing footers) across `/buscar`, `/historial`, `/ajustes`, and `/results` with two new self-contained components, `AppHeader` and `AppFooter`, matching the pattern already validated on the home page.

**Architecture:** Two new components in `src/components/` follow the existing no-props self-contained pattern (`NavMenu`, `CreditsBadge`): `AppHeader` accepts an optional `children` slot for page-specific content (e.g. "Nueva búsqueda" link, city/business-type info) and renders logo + `ThemeSwitcher` + `{children}` + (if logged in: `CreditsBadge` + email pill + `NavMenu`, else: "Acceder" button). `AppFooter` takes no props and renders the same footer markup already used on the home page. Four call sites get updated to use them; the home page itself is untouched (already has its own equivalent, functionally identical, `fixed`-positioned header).

**Tech Stack:** Next.js 16.2.6 App Router, React, TypeScript, Tailwind CSS custom properties theme system.

---

### Task 1: Create the `AppHeader` component

**Files:**
- Create: `src/components/AppHeader.tsx`

- [ ] **Step 1: Create the file**

```tsx
'use client'

import { type ReactNode } from 'react'
import Link from 'next/link'
import { ThemeSwitcher } from '@/components/ThemeSwitcher'
import { CreditsBadge } from '@/components/CreditsBadge'
import { NavMenu } from '@/components/NavMenu'
import { useAuth } from '@/hooks/useAuth'

export function AppHeader({ children }: { children?: ReactNode }) {
  const { user } = useAuth()

  return (
    <div className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur-md">
      <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/" className="font-heading font-bold text-sm tracking-tight hover:text-primary transition-colors">
          Opplify<span className="text-primary">.</span>ai
        </Link>
        <div className="flex items-center gap-3">
          <ThemeSwitcher />
          {children}
          {user ? (
            <>
              <CreditsBadge />
              {user.email && (
                <div className="flex items-center gap-2 border border-border rounded-full pl-1 pr-3 py-0.5">
                  <span className="h-5 w-5 rounded-full bg-primary/15 text-primary text-[10px] font-semibold flex items-center justify-center shrink-0">
                    {user.email[0].toUpperCase()}
                  </span>
                  <span className="text-xs text-muted-foreground hidden sm:block truncate max-w-[140px]">
                    {user.email}
                  </span>
                </div>
              )}
              <NavMenu />
            </>
          ) : (
            <a
              href="/auth/login"
              className="btn-press text-xs font-medium px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Acceder
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/AppHeader.tsx
git commit -m "feat: add AppHeader shared component"
```

---

### Task 2: Create the `AppFooter` component

**Files:**
- Create: `src/components/AppFooter.tsx`

- [ ] **Step 1: Create the file**

```tsx
'use client'

export function AppFooter() {
  return (
    <footer className="section-divider py-12 px-6">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <span className="font-heading font-bold text-sm tracking-tight">
          Opplify<span className="text-primary">.</span>ai
        </span>
        <p className="text-xs text-muted-foreground">
          Google Places · Claude AI · {new Date().getFullYear()}
        </p>
      </div>
    </footer>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/AppFooter.tsx
git commit -m "feat: add AppFooter shared component"
```

---

### Task 3: Integrate `AppHeader`/`AppFooter` into `src/app/buscar/page.tsx`

**Files:**
- Modify: `src/app/buscar/page.tsx`

This page has no `useAuth` usage today and no header beyond a bare logo link — it's the one page reachable without a session. `AppHeader` handles the logged-out "Acceder" branch on its own.

- [ ] **Step 1: Update imports — drop `Link`, add `AppHeader`/`AppFooter`**

Find:
```tsx
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { SearchForm } from '@/components/search/SearchForm'
import { ModeToggle } from '@/components/search/ModeToggle'
import type { SearchParams, AppMode } from '@/types/analysis'
```
Replace with:
```tsx
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SearchForm } from '@/components/search/SearchForm'
import { ModeToggle } from '@/components/search/ModeToggle'
import { AppHeader } from '@/components/AppHeader'
import { AppFooter } from '@/components/AppFooter'
import type { SearchParams, AppMode } from '@/types/analysis'
```

(`Link` was only used for the bare logo link being replaced in Step 2 — confirm with `grep -n "Link" src/app/buscar/page.tsx` after Step 2 that no other usage remains.)

- [ ] **Step 2: Replace the centered layout with header + centered content + footer**

Find:
```tsx
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm space-y-6">
        <Link href="/" className="block font-heading font-bold text-base tracking-tight">
          Opplify<span className="text-primary">.</span>ai
        </Link>
        <div>
          <h1 className="font-heading font-bold text-2xl tracking-tight mb-1" style={{ letterSpacing: '-0.02em' }}>
            Nueva búsqueda
          </h1>
          <p className="text-sm text-muted-foreground">
            Elige un modo y analiza tu mercado en segundos.
          </p>
        </div>
        <div className="space-y-3">
          <ModeToggle mode={mode} onChange={setMode} />
          <SearchForm mode={mode} onSubmit={handleSubmit} />
        </div>
      </div>
    </div>
  )
}
```
Replace with:
```tsx
  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <div className="flex-1 flex items-center justify-center bg-background px-6">
        <div className="w-full max-w-sm space-y-6">
          <div>
            <h1 className="font-heading font-bold text-2xl tracking-tight mb-1" style={{ letterSpacing: '-0.02em' }}>
              Nueva búsqueda
            </h1>
            <p className="text-sm text-muted-foreground">
              Elige un modo y analiza tu mercado en segundos.
            </p>
          </div>
          <div className="space-y-3">
            <ModeToggle mode={mode} onChange={setMode} />
            <SearchForm mode={mode} onSubmit={handleSubmit} />
          </div>
        </div>
      </div>
      <AppFooter />
    </div>
  )
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/buscar/page.tsx
git commit -m "feat: add AppHeader/AppFooter to buscar page"
```

---

### Task 4: Integrate `AppHeader`/`AppFooter` into `src/app/historial/page.tsx`

**Files:**
- Modify: `src/app/historial/page.tsx`

- [ ] **Step 1: Update imports**

Find:
```tsx
import { authClient } from '@/lib/auth-client'
import { ThemeSwitcher } from '@/components/ThemeSwitcher'
import { CreditsBadge } from '@/components/CreditsBadge'
import { NavMenu } from '@/components/NavMenu'
import { useAuth } from '@/hooks/useAuth'
```
Replace with:
```tsx
import { authClient } from '@/lib/auth-client'
import { AppHeader } from '@/components/AppHeader'
import { AppFooter } from '@/components/AppFooter'
import { useAuth } from '@/hooks/useAuth'
```

- [ ] **Step 2: Replace the header block, passing "Nueva búsqueda" as `children`**

Find:
```tsx
  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="font-heading font-bold text-sm tracking-tight hover:text-primary transition-colors">
            Opplify<span className="text-primary">.</span>ai
          </Link>
          <div className="flex items-center gap-3">
            <ThemeSwitcher />
            <Link href="/buscar" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Nueva búsqueda
            </Link>
            <CreditsBadge />
            {user?.email && (
              <div className="flex items-center gap-2 border border-border rounded-full pl-1 pr-3 py-0.5">
                <span className="h-5 w-5 rounded-full bg-primary/15 text-primary text-[10px] font-semibold flex items-center justify-center shrink-0">
                  {user.email[0].toUpperCase()}
                </span>
                <span className="text-xs text-muted-foreground hidden sm:block truncate max-w-[140px]">
                  {user.email}
                </span>
              </div>
            )}
            <NavMenu />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-10">
```
Replace with:
```tsx
  return (
    <div className="min-h-screen">
      <AppHeader>
        <Link href="/buscar" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          Nueva búsqueda
        </Link>
      </AppHeader>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-10">
```

`Link` from `next/link` stays imported and used elsewhere in this file (the "Nueva búsqueda" link itself, "Hacer mi primer análisis →", "Ver análisis →") — no import changes needed there.

- [ ] **Step 3: Add `<AppFooter />` before the closing of the outer div**

Find:
```tsx
          </div>
        )}
      </div>
    </div>
  )
}
```
Replace with:
```tsx
          </div>
        )}
      </div>
      <AppFooter />
    </div>
  )
}
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/historial/page.tsx
git commit -m "feat: add AppHeader/AppFooter to historial page"
```

---

### Task 5: Integrate `AppHeader`/`AppFooter` into `src/app/ajustes/page.tsx`

**Files:**
- Modify: `src/app/ajustes/page.tsx`

- [ ] **Step 1: Update imports — drop `Link`, `ThemeSwitcher`, `CreditsBadge`, `NavMenu`, add `AppHeader`/`AppFooter`**

Find:
```tsx
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { authClient } from '@/lib/auth-client'
import { useAuth } from '@/hooks/useAuth'
import { ThemeSwitcher } from '@/components/ThemeSwitcher'
import { CreditsBadge } from '@/components/CreditsBadge'
import { NavMenu } from '@/components/NavMenu'
```
Replace with:
```tsx
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'
import { useAuth } from '@/hooks/useAuth'
import { AppHeader } from '@/components/AppHeader'
import { AppFooter } from '@/components/AppFooter'
```

(`Link` was only used for the bare logo link being replaced in Step 2 — confirm with `grep -n "Link" src/app/ajustes/page.tsx` after Step 2 that no other usage remains.)

- [ ] **Step 2: Replace the header block — no page-specific content, so no `children`**

Find:
```tsx
  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="font-heading font-bold text-sm tracking-tight hover:text-primary transition-colors">
            Opplify<span className="text-primary">.</span>ai
          </Link>
          <div className="flex items-center gap-3">
            <ThemeSwitcher />
            <CreditsBadge />
            <NavMenu />
          </div>
        </div>
      </div>

      <div className="max-w-sm mx-auto px-6 py-10">
```
Replace with:
```tsx
  return (
    <div className="min-h-screen">
      <AppHeader />

      <div className="max-w-sm mx-auto px-6 py-10">
```

- [ ] **Step 3: Add `<AppFooter />` before the closing of the outer div**

Find:
```tsx
          </button>
        </form>
      </div>
    </div>
  )
}
```
Replace with:
```tsx
          </button>
        </form>
      </div>
      <AppFooter />
    </div>
  )
}
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/ajustes/page.tsx
git commit -m "feat: add AppHeader/AppFooter to ajustes page"
```

---

### Task 6: Integrate `AppHeader`/`AppFooter` into `src/components/results/ResultsDashboard.tsx`

**Files:**
- Modify: `src/components/results/ResultsDashboard.tsx`

This file has two `<Header>` call sites (the `ERR_NO_CREDITS` early return and the main return) and a private `Header` function. Both call sites pass the same `city`/`businessType`/`email` props today; both lose their footer-less status. The private `Header` function is replaced by a smaller `ResultsHeaderInfo` helper holding just the page-specific bits (business type badge, city name, "← Nueva búsqueda" link), passed as `AppHeader`'s `children`.

- [ ] **Step 1: Update imports**

Find:
```tsx
import { ThemeSwitcher } from '@/components/ThemeSwitcher'
import { CreditsBadge } from '@/components/CreditsBadge'
import { NavMenu } from '@/components/NavMenu'
```
Replace with:
```tsx
import { AppHeader } from '@/components/AppHeader'
import { AppFooter } from '@/components/AppFooter'
```

- [ ] **Step 2: Update the `ERR_NO_CREDITS` branch**

Find:
```tsx
  if (state.phase === 'error' && state.error === 'ERR_NO_CREDITS') {
    return (
      <div className="min-h-screen">
        <Header city={city} businessType={businessType} email={user?.email} />
        <div className="max-w-4xl mx-auto px-6 py-20 text-center space-y-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Sin créditos</p>
          <h2 className="font-heading text-2xl font-bold">No tienes créditos disponibles</h2>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Compra un pack para continuar analizando mercados y encontrando leads.
          </p>
          <Link
            href="/#precios"
            className="btn-press inline-block mt-4 px-6 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            Ver precios →
          </Link>
        </div>
      </div>
    )
  }
```
Replace with:
```tsx
  if (state.phase === 'error' && state.error === 'ERR_NO_CREDITS') {
    return (
      <div className="min-h-screen">
        <AppHeader>
          <ResultsHeaderInfo city={city} businessType={businessType} />
        </AppHeader>
        <div className="max-w-4xl mx-auto px-6 py-20 text-center space-y-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Sin créditos</p>
          <h2 className="font-heading text-2xl font-bold">No tienes créditos disponibles</h2>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Compra un pack para continuar analizando mercados y encontrando leads.
          </p>
          <Link
            href="/#precios"
            className="btn-press inline-block mt-4 px-6 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            Ver precios →
          </Link>
        </div>
        <AppFooter />
      </div>
    )
  }
```

- [ ] **Step 3: Update the main return and replace the `Header` function with `ResultsHeaderInfo`**

Find:
```tsx
  return (
    <div className="min-h-screen">
      <Header city={city} businessType={businessType} email={user?.email} />
      <div className="max-w-4xl mx-auto px-6 py-10">
        {mode === 'agency_leads' ? (
          <AgencyLeadsStream state={state} city={city} businessType={businessType} />
        ) : (
          <AnalysisStream state={state} city={city} businessType={businessType} />
        )}
      </div>
    </div>
  )
}

function Header({
  city,
  businessType,
  email,
}: {
  city: string
  businessType: string
  email: string | undefined
}) {
  return (
    <div className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur-md">
      <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/" className="font-heading font-bold text-sm tracking-tight hover:text-primary transition-colors">
          Opplify<span className="text-primary">.</span>ai
        </Link>
        <div className="flex items-center gap-3">
          <ThemeSwitcher />
          {businessType && (
            <span className="text-xs text-muted-foreground capitalize hidden sm:block">{businessType}</span>
          )}
          <span className="font-heading font-semibold text-sm">{city}</span>
          <CreditsBadge />
          <Link
            href="/"
            className="text-xs px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
          >
            ← Nueva búsqueda
          </Link>
          {email && (
            <div className="flex items-center gap-2 border border-border rounded-full pl-1 pr-3 py-0.5">
              <span className="h-5 w-5 rounded-full bg-primary/15 text-primary text-[10px] font-semibold flex items-center justify-center shrink-0">
                {email[0].toUpperCase()}
              </span>
              <span className="text-xs text-muted-foreground hidden sm:block truncate max-w-[140px]">
                {email}
              </span>
            </div>
          )}
          <NavMenu />
        </div>
      </div>
    </div>
  )
}
```
Replace with:
```tsx
  return (
    <div className="min-h-screen">
      <AppHeader>
        <ResultsHeaderInfo city={city} businessType={businessType} />
      </AppHeader>
      <div className="max-w-4xl mx-auto px-6 py-10">
        {mode === 'agency_leads' ? (
          <AgencyLeadsStream state={state} city={city} businessType={businessType} />
        ) : (
          <AnalysisStream state={state} city={city} businessType={businessType} />
        )}
      </div>
      <AppFooter />
    </div>
  )
}

function ResultsHeaderInfo({
  city,
  businessType,
}: {
  city: string
  businessType: string
}) {
  return (
    <>
      {businessType && (
        <span className="text-xs text-muted-foreground capitalize hidden sm:block">{businessType}</span>
      )}
      <span className="font-heading font-semibold text-sm">{city}</span>
      <Link
        href="/"
        className="text-xs px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
      >
        ← Nueva búsqueda
      </Link>
    </>
  )
}
```

`Link` from `next/link` stays imported and used (inside `ResultsHeaderInfo` and the "Ver precios →" link) — no import changes needed there. The `user` variable (from `useAuth()`) is still used by the auth-redirect `useEffect` — only its `.email` usage at the old `Header` call sites is gone, which is fine since `AppHeader` now reads `user.email` itself.

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/results/ResultsDashboard.tsx
git commit -m "feat: add AppHeader/AppFooter to results screen"
```

---

### Task 7: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full automated suite**

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
```
Expected: all four pass clean. For `lint`, confirm specifically that `AppHeader.tsx`, `AppFooter.tsx`, and the four modified files produce zero new warnings/errors (pre-existing warnings elsewhere in the codebase are out of scope):
```bash
npm run lint 2>&1 | grep -E "AppHeader|AppFooter|app\\\\buscar\\\\page\.tsx|app\\\\historial\\\\page\.tsx|app\\\\ajustes\\\\page\.tsx|ResultsDashboard\.tsx"
```
Expected: no output.

- [ ] **Step 2: Manual browser checklist**

Logged out:
1. Visit `/buscar` — confirm `AppHeader` shows logo + `ThemeSwitcher` + "Acceder" button (no `CreditsBadge`/`NavMenu`), and `AppFooter` renders at the bottom.

Logged in:
2. Visit `/buscar` — confirm `AppHeader` now shows `CreditsBadge` + email pill + `NavMenu` instead of "Acceder", and `AppFooter` renders.
3. Visit `/historial` — confirm header shows "Nueva búsqueda" link between `ThemeSwitcher` and `CreditsBadge`, `NavMenu` works (open/close/navigate/sign-out), and `AppFooter` renders at the bottom.
4. Visit `/ajustes` — confirm header now includes the email pill (previously missing), `NavMenu` works, and `AppFooter` renders.
5. Run a search and land on `/results` — confirm header shows business-type badge + city name + "← Nueva búsqueda" link (in that order, between `ThemeSwitcher` and `CreditsBadge`), `NavMenu` works, and `AppFooter` renders.
6. Trigger the no-credits screen (or inspect visually) — confirm the same header/footer appear on that branch too.
7. Visit `/` (home) — confirm it looks and behaves exactly as before (unaffected by this change).

- [ ] **Step 3: Report results**

No commit for this task — it's verification only. Report PASS/FAIL with specifics for any failed check.

---

### Task 8: Document `AppHeader`/`AppFooter` in `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add two rows to the "Key files and their responsibilities" table**

Find:
```
| `src/components/NavMenu.tsx` | Self-contained hamburger-icon dropdown (Ajustes / Historial / Cerrar sesión). Used in all navbars instead of separate links. |
```
Replace with:
```
| `src/components/NavMenu.tsx` | Self-contained hamburger-icon dropdown (Ajustes / Historial / Cerrar sesión). Used in all navbars instead of separate links. |
| `src/components/AppHeader.tsx` | Shared sticky header for `/buscar`, `/historial`, `/ajustes`, `/results` — logo + `ThemeSwitcher` + optional `children` slot for page-specific content + (`CreditsBadge`/email pill/`NavMenu` if logged in, else an "Acceder" button). The home page (`/`) has its own equivalent header, not migrated to this component. |
| `src/components/AppFooter.tsx` | Shared footer (logo + tagline) for the same four pages, no props. Matches the home page's existing footer markup. |
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document AppHeader/AppFooter in CLAUDE.md"
```
