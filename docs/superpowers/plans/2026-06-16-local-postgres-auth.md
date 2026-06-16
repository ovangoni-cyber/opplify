# Local PostgreSQL + Custom Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Supabase (auth + database) with a local PostgreSQL instance and a custom JWT-based auth layer, keeping the app fully functional including credits, history, and Stripe.

**Architecture:** Custom JWT auth (HS256, 7-day expiry) with passwords hashed via bcryptjs. Server routes verify tokens directly with `jsonwebtoken`. The browser stores tokens in `localStorage`. All database access goes through the `pg` connection pool — no ORM, plain SQL.

**Tech Stack:** PostgreSQL 15+, `pg`, `bcryptjs`, `jsonwebtoken`, Next.js API routes for auth endpoints.

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `database/schema.sql` | Full schema (users, analyses, user_credits, search_history) |
| Create | `src/lib/db.ts` | `pg` Pool singleton |
| Create | `src/lib/auth-server.ts` | `verifyToken`, `signToken` — server-only |
| Create | `src/lib/auth-client.ts` | Browser auth utilities replacing `supabaseBrowser.auth.*` |
| Create | `src/app/api/auth/login/route.ts` | POST — email+password → JWT |
| Create | `src/app/api/auth/register/route.ts` | POST — register user + give 1 credit |
| Create | `src/app/api/history/route.ts` | GET — search_history for authed user |
| Delete | `src/lib/supabase.ts` | Replaced by db.ts + auth-server.ts |
| Delete | `src/lib/supabase-browser.ts` | Replaced by auth-client.ts |
| Delete | `src/lib/__tests__/supabase.test.ts` | No longer relevant |
| Modify | `src/lib/analysis-cache.ts` | Use pool instead of supabaseAdmin |
| Modify | `src/hooks/useAuth.ts` | Use authClient instead of supabaseBrowser |
| Modify | `src/hooks/useAnalysisStream.ts` | Use authClient for token |
| Modify | `src/app/auth/login/page.tsx` | Use authClient for signIn / signUp |
| Modify | `src/app/auth/callback/page.tsx` | Simplify — no Supabase implicit flow needed |
| Modify | `src/app/historial/page.tsx` | Fetch /api/history; use authClient for signOut |
| Modify | `src/components/results/ResultsDashboard.tsx` | Use authClient for signOut |
| Modify | `src/app/api/analyze/route.ts` | Use pool + auth-server |
| Modify | `src/app/api/credits/route.ts` | Use pool + auth-server |
| Modify | `src/app/api/checkout/route.ts` | Use auth-server |
| Modify | `src/app/api/stripe/webhook/route.ts` | Use pool |
| Modify | `src/app/api/pitch/route.ts` | Use auth-server |
| Modify | `src/lib/__tests__/analysis-cache.test.ts` | Mock pool instead of supabaseAdmin |
| Modify | `.env.local` | Add DATABASE_URL + JWT_SECRET, keep existing vars |

---

## Task 1: Install PostgreSQL and create the database

**Files:**
- Create: `database/schema.sql`

- [ ] **Step 1: Install PostgreSQL**

Download and install PostgreSQL 15+ from postgresql.org. During install:
- Set a password for the `postgres` superuser (remember it)
- Keep the default port 5432
- After install, open "SQL Shell (psql)" or use pgAdmin

- [ ] **Step 2: Create the database**

In psql (or pgAdmin query tool), connected as postgres:
```sql
CREATE DATABASE opplify;
\c opplify
```

- [ ] **Step 3: Create `database/schema.sql`**

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  metadata      jsonb NOT NULL DEFAULT '{}',
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE analyses (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city             text NOT NULL,
  business_type    text,
  status           text NOT NULL DEFAULT 'completed',
  businesses_count integer NOT NULL,
  avg_rating       numeric(3,2),
  result           jsonb NOT NULL,
  cache_key        text GENERATED ALWAYS AS (
    lower(city) || ':' || lower(coalesce(business_type, '_all_'))
  ) STORED,
  mode             text NOT NULL DEFAULT 'market_research',
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX idx_analyses_cache_lookup ON analyses (cache_key, mode, created_at DESC);

CREATE TABLE user_credits (
  user_id    uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  credits    integer NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT credits_non_negative CHECK (credits >= 0)
);

CREATE TABLE search_history (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  city          text NOT NULL,
  business_type text,
  mode          text NOT NULL,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX idx_search_history_user ON search_history (user_id, created_at DESC);
```

- [ ] **Step 4: Apply schema**

In psql connected to the `opplify` database:
```
\i path/to/database/schema.sql
```
Or paste the contents into pgAdmin's query tool.

- [ ] **Step 5: Verify tables exist**

```sql
\dt
```
Expected output: `analyses`, `search_history`, `user_credits`, `users`

- [ ] **Step 6: Commit**

```bash
git add database/schema.sql
git commit -m "feat: add local postgres schema"
```

---

## Task 2: Install npm dependencies

**Files:** `package.json`

- [ ] **Step 1: Install packages**

```bash
npm install pg bcryptjs jsonwebtoken
npm install --save-dev @types/pg @types/bcryptjs @types/jsonwebtoken
```

- [ ] **Step 2: Verify install**

```bash
npx tsc --noEmit
```
Expected: no errors about missing types.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add pg, bcryptjs, jsonwebtoken"
```

---

## Task 3: Create `src/lib/db.ts`

**Files:**
- Create: `src/lib/db.ts`

- [ ] **Step 1: Create the file**

```typescript
import { Pool } from 'pg'

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})
```

- [ ] **Step 2: Add DATABASE_URL to `.env.local`**

Add this line to `.env.local`:
```
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/opplify
```
Replace `YOUR_PASSWORD` with the postgres superuser password set during install.

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/db.ts .env.local
git commit -m "feat: add pg pool db client"
```

---

## Task 4: Create `src/lib/auth-server.ts`

**Files:**
- Create: `src/lib/auth-server.ts`

- [ ] **Step 1: Create the file**

```typescript
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET!

export type JwtPayload = {
  sub: string
  email: string
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload
  } catch {
    return null
  }
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}
```

- [ ] **Step 2: Add JWT_SECRET to `.env.local`**

Generate a random secret and add to `.env.local`:
```
JWT_SECRET=change-this-to-a-long-random-string-at-least-32-chars
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/auth-server.ts .env.local
git commit -m "feat: add JWT server utilities"
```

---

## Task 5: Create `src/lib/auth-client.ts`

**Files:**
- Create: `src/lib/auth-client.ts`

- [ ] **Step 1: Create the file**

```typescript
const TOKEN_KEY = 'auth_token'

export type AuthUser = {
  id: string
  email: string
  user_metadata: Record<string, unknown>
}

export type AuthSession = {
  access_token: string
  user: AuthUser
}

function decodeJwt(token: string): AuthUser | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return { id: payload.sub, email: payload.email, user_metadata: {} }
  } catch {
    return null
  }
}

export const authClient = {
  async getSession(): Promise<{ data: { session: AuthSession | null } }> {
    if (typeof window === 'undefined') return { data: { session: null } }
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) return { data: { session: null } }
    const user = decodeJwt(token)
    if (!user) return { data: { session: null } }
    return { data: { session: { access_token: token, user } } }
  },

  onAuthStateChange(
    callback: (event: string, session: AuthSession | null) => void
  ): { data: { subscription: { unsubscribe: () => void } } } {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ event: string; session: AuthSession | null }>).detail
      callback(detail.event, detail.session)
    }
    window.addEventListener('auth_change', handler)
    return {
      data: {
        subscription: { unsubscribe: () => window.removeEventListener('auth_change', handler) },
      },
    }
  },

  async signInWithPassword({
    email,
    password,
  }: {
    email: string
    password: string
  }): Promise<{ error: { message: string } | null }> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()
    if (!res.ok) return { error: { message: data.error ?? 'Error al iniciar sesión' } }
    localStorage.setItem(TOKEN_KEY, data.token)
    const user = decodeJwt(data.token)
    const session: AuthSession = { access_token: data.token, user: user! }
    window.dispatchEvent(
      new CustomEvent('auth_change', { detail: { event: 'SIGNED_IN', session } })
    )
    return { error: null }
  },

  async signUp({
    email,
    password,
    options,
  }: {
    email: string
    password: string
    options?: { data?: Record<string, unknown> }
  }): Promise<{ error: { message: string } | null }> {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, metadata: options?.data ?? {} }),
    })
    const data = await res.json()
    if (!res.ok) return { error: { message: data.error ?? 'Error al registrarse' } }
    return { error: null }
  },

  async signOut(): Promise<void> {
    localStorage.removeItem(TOKEN_KEY)
    window.dispatchEvent(
      new CustomEvent('auth_change', { detail: { event: 'SIGNED_OUT', session: null } })
    )
  },
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth-client.ts
git commit -m "feat: add browser auth client"
```

---

## Task 6: Create auth API routes

**Files:**
- Create: `src/app/api/auth/login/route.ts`
- Create: `src/app/api/auth/register/route.ts`

- [ ] **Step 1: Create `src/app/api/auth/login/route.ts`**

```typescript
import type { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { pool } from '@/lib/db'
import { signToken } from '@/lib/auth-server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  let email: string, password: string
  try {
    const body = await req.json()
    email = body.email
    password = body.password
    if (!email || !password) throw new Error('missing fields')
  } catch {
    return Response.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }

  const { rows } = await pool.query(
    'SELECT id, email, password_hash FROM users WHERE email = $1',
    [email.toLowerCase().trim()]
  )
  const user = rows[0]

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return Response.json({ error: 'Email o contraseña incorrectos' }, { status: 401 })
  }

  const token = signToken({ sub: user.id, email: user.email })
  return Response.json({ token })
}
```

- [ ] **Step 2: Create `src/app/api/auth/register/route.ts`**

```typescript
import type { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { pool } from '@/lib/db'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  let email: string, password: string, metadata: Record<string, unknown>
  try {
    const body = await req.json()
    email = body.email
    password = body.password
    metadata = body.metadata ?? {}
    if (!email || !password) throw new Error('missing fields')
  } catch {
    return Response.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }

  const passwordHash = await bcrypt.hash(password, 10)

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query(
      'INSERT INTO users (email, password_hash, metadata) VALUES ($1, $2, $3) RETURNING id',
      [email.toLowerCase().trim(), passwordHash, JSON.stringify(metadata)]
    )
    await client.query(
      'INSERT INTO user_credits (user_id, credits) VALUES ($1, 1)',
      [rows[0].id]
    )
    await client.query('COMMIT')
    return Response.json({ ok: true })
  } catch (err: unknown) {
    await client.query('ROLLBACK')
    const pgErr = err as { code?: string }
    if (pgErr.code === '23505') {
      return Response.json({ error: 'Email ya registrado' }, { status: 409 })
    }
    return Response.json({ error: 'Error al crear cuenta' }, { status: 500 })
  } finally {
    client.release()
  }
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/auth/
git commit -m "feat: add login and register API routes"
```

---

## Task 7: Create `/api/history` route

**Files:**
- Create: `src/app/api/history/route.ts`

- [ ] **Step 1: Create the file**

```typescript
import type { NextRequest } from 'next/server'
import { pool } from '@/lib/db'
import { verifyToken } from '@/lib/auth-server'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') ?? ''
  const payload = verifyToken(token)
  if (!payload) return Response.json({ error: 'No autorizado' }, { status: 401 })

  const { rows } = await pool.query(
    'SELECT id, city, business_type, mode, created_at FROM search_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
    [payload.sub]
  )
  return Response.json(rows)
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/history/route.ts
git commit -m "feat: add /api/history route"
```

---

## Task 8: Update `src/lib/analysis-cache.ts`

**Files:**
- Modify: `src/lib/analysis-cache.ts`

- [ ] **Step 1: Replace file contents**

```typescript
import { pool } from './db'
import type { AnalysisResult, AgencyLeadsResult, AppMode } from '@/types/analysis'

const CACHE_TTL_HOURS = 24

export type CachedAnalysis = {
  result: AnalysisResult | AgencyLeadsResult
  created_at: string
}

export function buildCacheKey(city: string, businessType: string | null): string {
  return `${city.toLowerCase()}:${(businessType ?? '_all_').toLowerCase()}`
}

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

export async function saveAnalysis(
  city: string,
  businessType: string | null,
  result: AnalysisResult | AgencyLeadsResult,
  businessesCount: number,
  avgRating: number,
  mode: AppMode
): Promise<void> {
  await pool.query(
    'INSERT INTO analyses (city, business_type, result, businesses_count, avg_rating, mode) VALUES ($1, $2, $3, $4, $5, $6)',
    [city, businessType, JSON.stringify(result), businessesCount, avgRating, mode]
  )
}
```

- [ ] **Step 2: Update `src/lib/__tests__/analysis-cache.test.ts`**

```typescript
import { describe, it, expect, vi } from 'vitest'

vi.mock('../db', () => ({
  pool: { query: vi.fn() },
}))

import { buildCacheKey } from '../analysis-cache'

describe('buildCacheKey', () => {
  it('lowercases city and business type', () => {
    expect(buildCacheKey('Buenos Aires', 'Restaurante')).toBe('buenos aires:restaurante')
  })

  it('uses _all_ for null business type', () => {
    expect(buildCacheKey('Madrid', null)).toBe('madrid:_all_')
  })

  it('does not trim — caller is responsible for passing trimmed values', () => {
    expect(buildCacheKey('Lima ', ' Gym ')).toBe('lima : gym ')
  })
})
```

- [ ] **Step 3: Run tests**

```bash
npm test
```
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/analysis-cache.ts src/lib/__tests__/analysis-cache.test.ts
git commit -m "refactor: analysis-cache uses pg pool"
```

---

## Task 9: Update `src/app/api/analyze/route.ts`

**Files:**
- Modify: `src/app/api/analyze/route.ts`

- [ ] **Step 1: Replace file contents**

```typescript
import type { NextRequest } from 'next/server'

export const runtime = 'nodejs'

import { fetchAndNormalizePlaces } from '@/lib/google-places'
import { streamAnalysis, JSON_DELIMITER } from '@/lib/claude'
import { getCachedAnalysis, saveAnalysis } from '@/lib/analysis-cache'
import { pool } from '@/lib/db'
import { verifyToken } from '@/lib/auth-server'
import type { SearchParams, AnalysisResult, AgencyLeadsResult, PlacesContext, AppMode } from '@/types/analysis'

async function decrementCredit(userId: string): Promise<number> {
  const { rows } = await pool.query(
    `UPDATE user_credits SET credits = credits - 1, updated_at = now()
     WHERE user_id = $1 AND credits > 0 RETURNING credits`,
    [userId]
  )
  return rows[0]?.credits ?? -1
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') ?? ''
  if (!token) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  const payload = verifyToken(token)
  if (!payload) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body: SearchParams
  try {
    body = (await req.json()) as SearchParams
  } catch {
    return new Response(JSON.stringify({ error: 'Cuerpo de solicitud inválido' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const city = body.city?.trim()
  const businessType = body.business_type?.trim() || null
  const mode: AppMode = body.mode === 'agency_leads' ? 'agency_leads' : 'market_research'
  const exclude: string[] = Array.isArray(body.exclude) ? body.exclude : []
  const hasExclusions = exclude.length > 0

  if (!city) {
    return new Response(JSON.stringify({ error: 'Ciudad requerida' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!hasExclusions) {
    const cached = await getCachedAnalysis(city, businessType, mode)
    if (cached) {
      const payload2 = `---CACHED---\n${JSON_DELIMITER}\n${JSON.stringify(cached.result)}`
      return new Response(payload2, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    }
  }

  if (payload.sub !== process.env.TEST_USER_ID) {
    const remaining = await decrementCredit(payload.sub)
    if (remaining === -1) {
      return new Response(JSON.stringify({ error: 'Sin créditos' }), {
        status: 402,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Configuración del servidor incompleta' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let context!: PlacesContext
  try {
    context = await fetchAndNormalizePlaces(city, businessType, apiKey)
    if (hasExclusions) {
      const excludeSet = new Set(exclude.map((n) => n.toLowerCase()))
      const filteredBusinesses = context.businesses.filter(
        (b) => !excludeSet.has(b.name.toLowerCase())
      )
      context = { ...context, businesses: filteredBusinesses, total_count: filteredBusinesses.length }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error de Google Places'
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>()
  const writer = writable.getWriter()
  const encoder = new TextEncoder()

  if (context.total_count < 5) {
    await writer.write(
      encoder.encode('[NOTA: Se encontraron pocos negocios para esta búsqueda. El análisis puede ser limitado.]\n\n')
    )
  }

  let analysisResult: AnalysisResult | AgencyLeadsResult | null = null

  const streamPromise = streamAnalysis(city, businessType, context, mode, async (chunk) => {
    await writer.write(encoder.encode(chunk))
  })
    .then(async (result) => {
      analysisResult = result
      if (result && !hasExclusions) {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
        const dupResult = await pool.query(
          `SELECT id FROM search_history WHERE user_id = $1 AND city = $2 AND mode = $3 AND created_at >= $4 AND ${
            businessType ? 'business_type = $5' : 'business_type IS NULL'
          } LIMIT 1`,
          businessType
            ? [payload.sub, city, mode, fiveMinutesAgo, businessType]
            : [payload.sub, city, mode, fiveMinutesAgo]
        )
        if (dupResult.rows.length === 0) {
          await pool.query(
            'INSERT INTO search_history (user_id, city, business_type, mode) VALUES ($1, $2, $3, $4)',
            [payload.sub, city, businessType, mode]
          ).catch((err) => console.error('[history] insert failed:', err))
          console.log('[history] inserted for user', payload.sub)
        }
      }
      await writer.close()
    })
    .catch(async (err) => {
      const errMsg = `\n\n[ERROR]: ${err instanceof Error ? err.message : 'Error desconocido'}`
      try {
        await writer.write(encoder.encode(errMsg))
        await writer.close()
      } catch {
        // writer may already be closed
      }
    })

  streamPromise.then(() => {
    if (analysisResult && !hasExclusions) {
      void saveAnalysis(city, businessType, analysisResult, context.total_count, context.avg_rating, mode)
        .catch((err) => console.error('Cache save failed:', err))
    }
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  })
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/analyze/route.ts
git commit -m "refactor: analyze route uses pg pool + custom auth"
```

---

## Task 10: Update remaining API routes

**Files:**
- Modify: `src/app/api/credits/route.ts`
- Modify: `src/app/api/checkout/route.ts`
- Modify: `src/app/api/stripe/webhook/route.ts`
- Modify: `src/app/api/pitch/route.ts`

- [ ] **Step 1: Replace `src/app/api/credits/route.ts`**

```typescript
import type { NextRequest } from 'next/server'
import { pool } from '@/lib/db'
import { verifyToken } from '@/lib/auth-server'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') ?? ''
  const payload = verifyToken(token)
  if (!payload) return Response.json({ credits: null }, { status: 401 })

  const { rows } = await pool.query(
    'SELECT credits FROM user_credits WHERE user_id = $1',
    [payload.sub]
  )
  return Response.json({ credits: rows[0]?.credits ?? 0 })
}
```

- [ ] **Step 2: Replace `src/app/api/checkout/route.ts`**

```typescript
import type { NextRequest } from 'next/server'
import { verifyToken } from '@/lib/auth-server'
import { stripe, STRIPE_PRICE_IDS } from '@/lib/stripe'
import { CREDIT_PACKS } from '@/lib/credit-packs'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') ?? ''
  const payload = verifyToken(token)
  if (!payload) return Response.json({ error: 'No autorizado' }, { status: 401 })

  let packId: string
  try {
    const body = await req.json()
    packId = body.packId
  } catch {
    return Response.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }

  const pack = CREDIT_PACKS.find(p => p.id === packId)
  const priceId = STRIPE_PRICE_IDS[packId]
  if (!pack || !priceId) {
    return Response.json({ error: 'Pack no encontrado o no configurado' }, { status: 400 })
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${siteUrl}/?credits_added=1`,
      cancel_url: `${siteUrl}/#precios`,
      metadata: {
        user_id: payload.sub,
        pack_id: pack.id,
        credits: String(pack.credits),
      },
      client_reference_id: payload.sub,
    })
    return Response.json({ url: session.url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al crear sesión de pago'
    return Response.json({ error: message }, { status: 500 })
  }
}
```

- [ ] **Step 3: Replace `src/app/api/stripe/webhook/route.ts`**

```typescript
import type { NextRequest } from 'next/server'
import { stripe } from '@/lib/stripe'
import { pool } from '@/lib/db'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const sig = req.headers.get('stripe-signature') ?? ''
  const secret = process.env.STRIPE_WEBHOOK_SECRET

  if (!secret) return Response.json({ error: 'Webhook no configurado' }, { status: 500 })

  let event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Firma inválida'
    return Response.json({ error: message }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const userId = session.metadata?.user_id
    const creditsStr = session.metadata?.credits

    if (userId && creditsStr) {
      const credits = parseInt(creditsStr, 10)
      if (!isNaN(credits) && credits > 0) {
        await pool.query(
          `INSERT INTO user_credits (user_id, credits, updated_at) VALUES ($1, $2, now())
           ON CONFLICT (user_id) DO UPDATE SET credits = user_credits.credits + $2, updated_at = now()`,
          [userId, credits]
        )
      }
    }
  }

  return Response.json({ received: true })
}
```

- [ ] **Step 4: Replace `src/app/api/pitch/route.ts`**

Replace only the auth section at the top. The rest stays the same:

```typescript
import type { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { verifyToken } from '@/lib/auth-server'
import type { AgencyLead, AgencyService } from '@/types/analysis'

export const runtime = 'nodejs'

const client = new Anthropic()

const SERVICE_LABEL: Record<AgencyService, string> = {
  seo: 'SEO',
  ai_automation: 'Automatización IA',
  chatbot: 'Chatbot',
  branding: 'Branding',
  ads: 'Ads',
  web_redesign: 'Rediseño Web',
  crm: 'CRM',
  reputation: 'Reputación',
}

function buildPitchPrompt(lead: AgencyLead, city: string): string {
  const services = lead.recommended_services.map((s) => SERVICE_LABEL[s] ?? s).join(', ')
  const pains = lead.pain_points.join(', ')

  return `Eres un consultor de marketing digital que trabaja para una agencia. Escribe un email frío profesional en español para contactar a este negocio potencial como cliente.

Negocio: ${lead.business_name}
Ubicación: ${lead.address} (${city})
Rating: ${lead.rating > 0 ? `${lead.rating}★ (${lead.review_count} reseñas)` : `Sin rating (${lead.review_count} reseñas)`}
Problemas detectados: ${pains || 'No especificados'}
Servicios recomendados: ${services || 'No especificados'}
Contexto adicional: ${lead.pitch || ''}

Requisitos del email:
- Asunto: corto, llamativo, personalizado al negocio
- Cuerpo: máximo 150 palabras, tono profesional pero cercano
- Mencionar 1-2 problemas específicos detectados
- Proponer valor concreto, no genérico
- Terminar con CTA claro (reunión de 15 min, llamada, etc.)
- NO usar plantillas genéricas ni frases vacías

Responde ÚNICAMENTE con este JSON (sin texto adicional, sin markdown):
{"subject": "...", "body": "..."}`
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') ?? ''
  const payload = verifyToken(token)
  if (!payload) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  let lead: AgencyLead
  let city: string
  try {
    const body = await req.json()
    lead = body.lead
    city = body.city ?? ''
    if (!lead?.business_name) throw new Error('invalid lead')
  } catch {
    return Response.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: buildPitchPrompt(lead, city) }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('No JSON in response')
    const { subject, body: emailBody } = JSON.parse(match[0])

    return Response.json({ subject, body: emailBody })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al generar el email'
    return Response.json({ error: message }, { status: 500 })
  }
}
```

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/credits/route.ts src/app/api/checkout/route.ts src/app/api/stripe/webhook/route.ts src/app/api/pitch/route.ts
git commit -m "refactor: api routes use pg pool + custom auth"
```

---

## Task 11: Update `src/hooks/useAuth.ts`

**Files:**
- Modify: `src/hooks/useAuth.ts`

- [ ] **Step 1: Replace file contents**

```typescript
'use client'

import { useEffect, useState } from 'react'
import { authClient, type AuthUser, type AuthSession } from '@/lib/auth-client'

export type AuthState = {
  user: AuthUser | null
  session: AuthSession | null
  loading: boolean
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ user: null, session: null, loading: true })

  useEffect(() => {
    authClient.getSession().then(({ data }) => {
      setState({
        user: data.session?.user ?? null,
        session: data.session,
        loading: false,
      })
    })

    const { data: { subscription } } = authClient.onAuthStateChange((_, session) => {
      setState({ user: session?.user ?? null, session, loading: false })
    })

    return () => subscription.unsubscribe()
  }, [])

  return state
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useAuth.ts
git commit -m "refactor: useAuth uses authClient"
```

---

## Task 12: Update `src/hooks/useAnalysisStream.ts`

**Files:**
- Modify: `src/hooks/useAnalysisStream.ts`

- [ ] **Step 1: Replace the Supabase import and token fetch**

Change line 6 from:
```typescript
import { supabaseBrowser } from '@/lib/supabase-browser'
```
To:
```typescript
import { authClient } from '@/lib/auth-client'
```

Change lines 22–23 from:
```typescript
      const { data: sessionData } = await supabaseBrowser.auth.getSession()
      const token = sessionData.session?.access_token
```
To:
```typescript
      const { data: sessionData } = await authClient.getSession()
      const token = sessionData.session?.access_token
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useAnalysisStream.ts
git commit -m "refactor: useAnalysisStream uses authClient"
```

---

## Task 13: Update `src/app/auth/login/page.tsx`

**Files:**
- Modify: `src/app/auth/login/page.tsx`

- [ ] **Step 1: Replace the Supabase import**

Change line 6 from:
```typescript
import { supabaseBrowser } from '@/lib/supabase-browser'
```
To:
```typescript
import { authClient } from '@/lib/auth-client'
```

- [ ] **Step 2: Replace signInWithPassword call (lines 74–80)**

From:
```typescript
      const { error } = await supabaseBrowser.auth.signInWithPassword({ email, password })
```
To:
```typescript
      const { error } = await authClient.signInWithPassword({ email, password })
```

- [ ] **Step 3: Replace signUp call (lines 82–107)**

From:
```typescript
      const { error } = await supabaseBrowser.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            dob,
            phone,
            country,
          },
        },
      })
      if (error) {
        setErrorMsg(error.message)
        setStatus('error')
      } else {
        const { error: signInError } = await supabaseBrowser.auth.signInWithPassword({ email, password })
        if (signInError) {
          setErrorMsg('Cuenta creada. Iniciá sesión manualmente.')
          setStatus('error')
        } else {
          router.replace(redirect)
        }
      }
```
To:
```typescript
      const { error } = await authClient.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            dob,
            phone,
            country,
          },
        },
      })
      if (error) {
        setErrorMsg(error.message)
        setStatus('error')
      } else {
        const { error: signInError } = await authClient.signInWithPassword({ email, password })
        if (signInError) {
          setErrorMsg('Cuenta creada. Iniciá sesión manualmente.')
          setStatus('error')
        } else {
          router.replace(redirect)
        }
      }
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/auth/login/page.tsx
git commit -m "refactor: login page uses authClient"
```

---

## Task 14: Update `src/app/auth/callback/page.tsx`

**Files:**
- Modify: `src/app/auth/callback/page.tsx`

The callback page was used for Supabase's implicit auth flow (magic links / OAuth). With custom auth there's no redirect callback needed — login is synchronous. Simplify to an immediate redirect.

- [ ] **Step 1: Replace file contents**

```typescript
'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

const Spinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="flex items-center gap-3 text-muted-foreground">
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <span className="text-sm">Iniciando sesión...</span>
    </div>
  </div>
)

function CallbackInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const redirect = searchParams.get('redirect') || '/buscar'
    router.replace(redirect)
  }, [router, searchParams])

  return <Spinner />
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <CallbackInner />
    </Suspense>
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
git add src/app/auth/callback/page.tsx
git commit -m "refactor: simplify auth callback page"
```

---

## Task 15: Update `src/app/historial/page.tsx`

**Files:**
- Modify: `src/app/historial/page.tsx`

- [ ] **Step 1: Replace the Supabase import**

Change line 6 from:
```typescript
import { supabaseBrowser } from '@/lib/supabase-browser'
```
To:
```typescript
import { authClient } from '@/lib/auth-client'
```

- [ ] **Step 2: Replace the data-fetch block (lines 60–80)**

From:
```typescript
    Promise.resolve(
      supabaseBrowser
        .from('search_history')
        .select('id, city, business_type, mode, created_at')
        .order('created_at', { ascending: false })
        .limit(50)
    ).then(({ data, error }) => {
      if (error) {
        console.error('[historial] error:', JSON.stringify(error))
        setLoadError(true)
      } else {
        console.log('[historial] loaded', data?.length, 'entries for user', user?.id)
        setEntries(data ?? [])
      }
      setLoading(false)
    }).catch((err) => {
      console.error('[historial] catch:', err)
      setLoadError(true)
      setLoading(false)
    })
```
To:
```typescript
    authClient.getSession().then(({ data: sessionData }) => {
      const token = sessionData.session?.access_token
      return fetch('/api/history', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
    }).then(async (res) => {
      if (!res.ok) throw new Error('fetch failed')
      const data: HistoryEntry[] = await res.json()
      console.log('[historial] loaded', data.length, 'entries for user', user?.id)
      setEntries(data)
      setLoading(false)
    }).catch((err) => {
      console.error('[historial] catch:', err)
      setLoadError(true)
      setLoading(false)
    })
```

- [ ] **Step 3: Replace the signOut call (line 83)**

From:
```typescript
    await supabaseBrowser.auth.signOut()
```
To:
```typescript
    await authClient.signOut()
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/historial/page.tsx
git commit -m "refactor: historial uses authClient + /api/history"
```

---

## Task 16: Update `src/components/results/ResultsDashboard.tsx`

**Files:**
- Modify: `src/components/results/ResultsDashboard.tsx`

- [ ] **Step 1: Replace the Supabase import**

Change the import of `supabaseBrowser` from:
```typescript
import { supabaseBrowser } from '@/lib/supabase-browser'
```
To:
```typescript
import { authClient } from '@/lib/auth-client'
```

- [ ] **Step 2: Replace signOut call in `handleSignOut`**

From:
```typescript
    await supabaseBrowser.auth.signOut()
```
To:
```typescript
    await authClient.signOut()
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/results/ResultsDashboard.tsx
git commit -m "refactor: ResultsDashboard uses authClient"
```

---

## Task 17: Delete Supabase files and update tests

**Files:**
- Delete: `src/lib/supabase.ts`
- Delete: `src/lib/supabase-browser.ts`
- Delete: `src/lib/__tests__/supabase.test.ts`

- [ ] **Step 1: Delete Supabase lib files**

```bash
rm src/lib/supabase.ts src/lib/supabase-browser.ts src/lib/__tests__/supabase.test.ts
```

- [ ] **Step 2: Run type-check to confirm no remaining imports**

```bash
npx tsc --noEmit
```
Expected: no errors. If errors appear about missing `supabase` imports, grep for remaining references and fix them.

- [ ] **Step 3: Run all tests**

```bash
npm test
```
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove supabase lib files"
```

---

## Task 18: Verify the full app works

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Register a new user**

Go to `http://localhost:3000/auth/login`, switch to "Crear cuenta", fill in all fields, submit. Expected: redirected to `/buscar`.

- [ ] **Step 3: Verify user and credits in DB**

```sql
SELECT u.email, uc.credits FROM users u JOIN user_credits uc ON uc.user_id = u.id ORDER BY u.created_at DESC LIMIT 1;
```
Expected: the new user with 1 credit.

- [ ] **Step 4: Log in**

Sign out and log back in with the same email/password. Expected: redirected to `/buscar`, credits badge shows.

- [ ] **Step 5: Run a search**

Use the test user (TEST_USER_ID). Run a search. Expected: streaming analysis completes.

- [ ] **Step 6: Check history**

Go to `/historial`. Expected: the search appears in the list.

- [ ] **Step 7: Build check**

```bash
npm run build
```
Expected: build succeeds with no errors.

- [ ] **Step 8: Final commit**

```bash
git add .env.local
git commit -m "chore: update env vars for local postgres"
```

---

## Env vars summary

Add to `.env.local`:
```
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/opplify
JWT_SECRET=change-this-to-a-long-random-string-at-least-32-chars
```

The following Supabase vars are **no longer needed** for local dev (keep them if you want to keep the Vercel/remote deployment working):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
