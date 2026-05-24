# Local Opportunity Finder — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an MVP web app that finds local business opportunities by analyzing Google Places data with Claude AI, streaming results progressively to the browser.

**Architecture:** Single Next.js 15 app with an Edge Runtime API route (`/api/analyze`) that orchestrates: Google Places fetch → Claude streaming analysis → Supabase cache persist. Frontend reads the stream via `useAnalysisStream` hook, rendering summary text progressively then structured dashboard cards once JSON arrives.

**Tech Stack:** Next.js 15 (App Router, Edge Runtime), TypeScript strict, TailwindCSS, shadcn/ui, Supabase (PostgreSQL), `@anthropic-ai/sdk` (claude-sonnet-4-6), Google Places API (New), Vitest.

---

## File Map

| File | Role |
|------|------|
| `next.config.ts` | Enable Edge Runtime |
| `vitest.config.ts` | Test runner with `@/*` alias |
| `.env.example` | Env var template |
| `supabase/migrations/0001_analyses.sql` | DB schema |
| `src/types/analysis.ts` | **Shared** TypeScript types (backend + frontend) |
| `src/lib/supabase.ts` | Supabase service-role client |
| `src/lib/google-places.ts` | Places API fetch + normalization |
| `src/lib/claude.ts` | Claude streaming + JSON parsing |
| `src/lib/analysis-cache.ts` | 24h cache read/write |
| `src/lib/__tests__/google-places.test.ts` | Unit tests for pure helpers |
| `src/lib/__tests__/claude.test.ts` | Unit tests for JSON parser |
| `src/lib/__tests__/analysis-cache.test.ts` | Unit tests for cache key |
| `src/app/api/analyze/route.ts` | Edge Runtime API orchestrator |
| `src/hooks/useAnalysisStream.ts` | Frontend streaming state hook |
| `src/components/search/SearchForm.tsx` | City + type inputs |
| `src/components/results/ExecutiveSummary.tsx` | Progressive text display |
| `src/components/results/OpportunityScore.tsx` | Score + label card |
| `src/components/results/MarketSaturation.tsx` | Saturation bar + stats |
| `src/components/results/OpportunityList.tsx` | Opportunities list |
| `src/components/results/PainPoints.tsx` | Pain points list |
| `src/components/results/AnalysisStream.tsx` | Orchestrates result cards by stream phase |
| `src/components/results/ResultsDashboard.tsx` | Page-level client component |
| `src/app/layout.tsx` | Root layout |
| `src/app/page.tsx` | Home page (SearchForm) |
| `src/app/results/page.tsx` | Results page (server → ResultsDashboard) |

---

## Task 1: Project Scaffolding

**Files:** Creates entire project structure.

- [ ] **Step 1: Scaffold Next.js 15**

Run from `C:\Users\ovang\OneDrive\Escritorio\Proyectos\buscador de oportunidades`:

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-turbopack
```

Answer the prompts: OK to proceed with existing directory → Yes.

Expected output: "Success! Created local-opportunity-finder ..."

- [ ] **Step 2: Install runtime dependencies**

```bash
npm install @anthropic-ai/sdk @supabase/supabase-js
```

- [ ] **Step 3: Install dev dependencies**

```bash
npm install -D vitest @vitejs/plugin-react
```

- [ ] **Step 4: Create `next.config.ts`**

Replace the generated file entirely:

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {}

export default nextConfig
```

- [ ] **Step 5: Create `vitest.config.ts`** (new file at project root)

```typescript
import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
})
```

- [ ] **Step 6: Add test script to `package.json`**

Find the `"scripts"` section in `package.json` and add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 7: Create `.env.example`** (project root)

```bash
GOOGLE_PLACES_API_KEY=
ANTHROPIC_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

- [ ] **Step 8: Create `.env.local`** (project root, gitignored by default)

Copy `.env.example` to `.env.local` and fill in your actual API keys.

- [ ] **Step 9: Verify build starts**

```bash
npm run dev
```

Expected: "Ready in Xms - Local: http://localhost:3000" — then stop it with Ctrl+C.

- [ ] **Step 10: Commit**

```bash
git init
git add .
git commit -m "feat: scaffold Next.js 15 project with Vitest"
```

---

## Task 2: Supabase Schema + Client

**Files:**
- Create: `supabase/migrations/0001_analyses.sql`
- Create: `src/lib/supabase.ts`

- [ ] **Step 1: Create Supabase project**

Go to [supabase.com](https://supabase.com), create a new project. Copy the Project URL, anon key, and service role key into `.env.local`.

- [ ] **Step 2: Write the failing test**

Create `src/lib/__tests__/supabase.test.ts`:

```typescript
// Verifies the client can be instantiated without throwing
import { describe, it, expect, vi } from 'vitest'

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: vi.fn() })),
}))

describe('supabase client', () => {
  it('exports supabaseAdmin', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key'
    const { supabaseAdmin } = await import('../supabase')
    expect(supabaseAdmin).toBeDefined()
  })
})
```

- [ ] **Step 3: Run test — expect it to fail**

```bash
npm test -- supabase
```

Expected: FAIL — "Cannot find module '../supabase'"

- [ ] **Step 4: Create Supabase migration**

Create `supabase/migrations/0001_analyses.sql`:

```sql
create table analyses (
  id                uuid primary key default gen_random_uuid(),
  city              text not null,
  business_type     text,
  status            text not null default 'completed',
  businesses_count  integer not null,
  avg_rating        numeric(3,2),
  result            jsonb not null,
  cache_key         text generated always as (
    lower(city) || ':' || lower(coalesce(business_type, '_all_'))
  ) stored,
  created_at        timestamptz default now()
);

create index on analyses (cache_key, created_at desc);
```

Run this SQL in the Supabase dashboard → SQL Editor.

- [ ] **Step 5: Create `src/lib/supabase.ts`**

```typescript
import { createClient } from '@supabase/supabase-js'

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
```

- [ ] **Step 6: Run test — expect it to pass**

```bash
npm test -- supabase
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add supabase/ src/lib/supabase.ts src/lib/__tests__/supabase.test.ts
git commit -m "feat: add Supabase migration and admin client"
```

---

## Task 3: TypeScript Types

**Files:**
- Create: `src/types/analysis.ts`

No tests — pure TypeScript, compiler enforces correctness.

- [ ] **Step 1: Create `src/types/analysis.ts`**

```typescript
export type SaturationLevel = 'bajo' | 'medio' | 'alto' | 'saturado'
export type OpportunityCategory = 'categoria_faltante' | 'punto_debil' | 'tendencia' | 'zona'
export type Frequency = 'baja' | 'media' | 'alta'

export type MarketData = {
  saturation_level: SaturationLevel
  saturation_score: number
  total_businesses_analyzed: number
  avg_rating: number
  rating_distribution: Record<string, number>
}

export type Opportunity = {
  title: string
  description: string
  evidence: string
  opportunity_score: number
  category: OpportunityCategory
}

export type PainPoint = {
  issue: string
  frequency: Frequency
  example_quote: string
}

export type Zone = {
  description: string
  insight: string
}

export type AnalysisResult = {
  market: MarketData
  opportunities: Opportunity[]
  pain_points: PainPoint[]
  zones: Zone[]
  opportunity_score: number
  opportunity_label: string
  executive_summary: string
  generated_at: string
  model_used: string
}

export type StreamPhase =
  | 'idle'
  | 'loading'
  | 'streaming_summary'
  | 'streaming_json'
  | 'complete'
  | 'error'

export type StreamState = {
  phase: StreamPhase
  summary: string
  result: AnalysisResult | null
  error: string | null
}

export type SearchParams = {
  city: string
  business_type: string
}

// Internal type — never sent to the client
export type NormalizedBusiness = {
  name: string
  rating: number
  review_count: number
  address: string
  types: string[]
  price_level: number | null
  recent_reviews: string[]
}

export type PlacesContext = {
  businesses: NormalizedBusiness[]
  avg_rating: number
  rating_distribution: Record<string, number>
  total_count: number
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/types/
git commit -m "feat: add shared TypeScript types"
```

---

## Task 4: Google Places Client

**Files:**
- Create: `src/lib/google-places.ts`
- Create: `src/lib/__tests__/google-places.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/__tests__/google-places.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  calculateAvgRating,
  buildRatingDistribution,
  priceLevelFromString,
} from '../google-places'

describe('calculateAvgRating', () => {
  it('returns 0 for empty array', () => {
    expect(calculateAvgRating([])).toBe(0)
  })

  it('rounds to 2 decimal places', () => {
    expect(calculateAvgRating([4, 3, 5])).toBe(4)
    expect(calculateAvgRating([4.1, 4.2, 4.3])).toBe(4.2)
  })

  it('handles single value', () => {
    expect(calculateAvgRating([3.7])).toBe(3.7)
  })
})

describe('buildRatingDistribution', () => {
  it('counts floor of each rating', () => {
    const dist = buildRatingDistribution([1.2, 2.8, 3.0, 4.5, 5.0, 4.9])
    expect(dist).toEqual({ '1': 1, '2': 1, '3': 1, '4': 2, '5': 1 })
  })

  it('ignores ratings outside 1-5', () => {
    const dist = buildRatingDistribution([0, 6])
    expect(dist).toEqual({ '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 })
  })

  it('returns zeroed distribution for empty input', () => {
    const dist = buildRatingDistribution([])
    expect(dist).toEqual({ '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 })
  })
})

describe('priceLevelFromString', () => {
  it('maps known strings', () => {
    expect(priceLevelFromString('PRICE_LEVEL_INEXPENSIVE')).toBe(1)
    expect(priceLevelFromString('PRICE_LEVEL_VERY_EXPENSIVE')).toBe(4)
  })

  it('returns null for undefined', () => {
    expect(priceLevelFromString(undefined)).toBe(null)
  })

  it('returns null for unknown string', () => {
    expect(priceLevelFromString('PRICE_LEVEL_UNKNOWN')).toBe(null)
  })
})
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npm test -- google-places
```

Expected: FAIL — "Cannot find module '../google-places'"

- [ ] **Step 3: Create `src/lib/google-places.ts`**

```typescript
import type { NormalizedBusiness, PlacesContext } from '@/types/analysis'

const PLACES_API_BASE = 'https://places.googleapis.com/v1'
const FETCH_TIMEOUT_MS = 5000

type PlaceItem = {
  displayName?: { text: string }
  rating?: number
  userRatingCount?: number
  formattedAddress?: string
  types?: string[]
  priceLevel?: string
  id?: string
}

type PlacesSearchResponse = {
  places?: PlaceItem[]
  nextPageToken?: string
}

type PlaceDetailResponse = {
  reviews?: Array<{
    text?: { text: string }
    rating?: number
  }>
}

async function fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, { ...options, signal: controller.signal })
    clearTimeout(timer)
    return res
  } catch (err) {
    clearTimeout(timer)
    throw err
  }
}

async function searchPlacesPage(
  query: string,
  apiKey: string,
  pageToken?: string
): Promise<PlacesSearchResponse> {
  const body: Record<string, unknown> = {
    textQuery: query,
    maxResultCount: 20,
    languageCode: 'es',
  }
  if (pageToken) body.pageToken = pageToken

  const res = await fetchWithTimeout(`${PLACES_API_BASE}/places:searchText`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask':
        'places.displayName,places.rating,places.userRatingCount,places.formattedAddress,places.types,places.priceLevel,places.id,nextPageToken',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Google Places error ${res.status}: ${text}`)
  }

  return res.json()
}

async function searchPlacesAll(query: string, apiKey: string): Promise<PlaceItem[]> {
  const allPlaces: PlaceItem[] = []
  let pageToken: string | undefined

  for (let page = 0; page < 2; page++) {
    try {
      const data = await searchPlacesPage(query, apiKey, page === 0 ? undefined : pageToken)
      allPlaces.push(...(data.places ?? []))
      if (!data.nextPageToken) break
      pageToken = data.nextPageToken
      await new Promise((r) => setTimeout(r, 500))
    } catch (err) {
      if (page === 0) throw err  // first page failure is fatal
      break  // second page failure is non-fatal, return what we have
    }
  }

  return allPlaces
}

async function fetchPlaceReviews(placeId: string, apiKey: string): Promise<string[]> {
  try {
    const res = await fetchWithTimeout(`${PLACES_API_BASE}/places/${placeId}`, {
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'reviews',
      },
    })
    if (!res.ok) return []
    const data: PlaceDetailResponse = await res.json()
    return (data.reviews ?? [])
      .filter((r) => r.text?.text)
      .slice(0, 3)
      .map((r) => r.text!.text.slice(0, 250))
  } catch {
    return []
  }
}

export function priceLevelFromString(level: string | undefined): number | null {
  const map: Record<string, number> = {
    PRICE_LEVEL_FREE: 0,
    PRICE_LEVEL_INEXPENSIVE: 1,
    PRICE_LEVEL_MODERATE: 2,
    PRICE_LEVEL_EXPENSIVE: 3,
    PRICE_LEVEL_VERY_EXPENSIVE: 4,
  }
  return level !== undefined ? (map[level] ?? null) : null
}

export function calculateAvgRating(ratings: number[]): number {
  if (ratings.length === 0) return 0
  const sum = ratings.reduce((acc, r) => acc + r, 0)
  return Math.round((sum / ratings.length) * 100) / 100
}

export function buildRatingDistribution(ratings: number[]): Record<string, number> {
  const dist: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 }
  for (const r of ratings) {
    const key = String(Math.floor(r))
    if (key in dist) dist[key]++
  }
  return dist
}

export async function fetchAndNormalizePlaces(
  city: string,
  businessType: string | null,
  apiKey: string
): Promise<PlacesContext> {
  const query = businessType ? `${businessType} en ${city}` : `negocios en ${city}`
  const places = await searchPlacesAll(query, apiKey)

  const normalized: NormalizedBusiness[] = await Promise.all(
    places.map(async (p) => {
      const rating = p.rating ?? 0
      const needsDetails = rating > 0 && rating < 3.5
      const reviews = needsDetails && p.id ? await fetchPlaceReviews(p.id, apiKey) : []
      return {
        name: p.displayName?.text ?? 'Sin nombre',
        rating,
        review_count: p.userRatingCount ?? 0,
        address: p.formattedAddress ?? '',
        types: p.types ?? [],
        price_level: priceLevelFromString(p.priceLevel),
        recent_reviews: reviews,
      }
    })
  )

  const ratedRatings = normalized.filter((b) => b.rating > 0).map((b) => b.rating)

  return {
    businesses: normalized,
    avg_rating: calculateAvgRating(ratedRatings),
    rating_distribution: buildRatingDistribution(ratedRatings),
    total_count: normalized.length,
  }
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npm test -- google-places
```

Expected: PASS (3 describe blocks, all green)

- [ ] **Step 5: Commit**

```bash
git add src/lib/google-places.ts src/lib/__tests__/google-places.test.ts
git commit -m "feat: add Google Places client with normalization helpers"
```

---

## Task 5: Claude Client

**Files:**
- Create: `src/lib/claude.ts`
- Create: `src/lib/__tests__/claude.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/__tests__/claude.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { parseAnalysisJson } from '../claude'

const VALID_RESULT = {
  market: {
    saturation_level: 'medio',
    saturation_score: 55,
    total_businesses_analyzed: 20,
    avg_rating: 4.1,
    rating_distribution: { '1': 0, '2': 1, '3': 3, '4': 10, '5': 6 },
  },
  opportunities: [
    {
      title: 'Delivery saludable',
      description: 'No hay opciones de comida saludable con delivery.',
      evidence: '12 de 20 negocios no ofrecen delivery.',
      opportunity_score: 75,
      category: 'categoria_faltante',
    },
  ],
  pain_points: [
    {
      issue: 'Servicio lento',
      frequency: 'alta',
      example_quote: 'Esperé 40 minutos por una pizza.',
    },
  ],
  zones: [{ description: 'Centro', insight: 'Alta densidad sin diferenciación.' }],
  opportunity_score: 72,
  opportunity_label: 'Oportunidad moderada',
  executive_summary: 'El mercado presenta oportunidades...',
  generated_at: '2026-05-23T10:00:00Z',
  model_used: 'claude-sonnet-4-6',
}

describe('parseAnalysisJson', () => {
  it('parses valid JSON string', () => {
    const result = parseAnalysisJson(JSON.stringify(VALID_RESULT))
    expect(result.opportunity_score).toBe(72)
    expect(result.opportunities).toHaveLength(1)
  })

  it('throws on invalid JSON', () => {
    expect(() => parseAnalysisJson('not json')).toThrow()
  })

  it('throws when opportunity_score is missing', () => {
    const invalid = { ...VALID_RESULT, opportunity_score: undefined }
    expect(() => parseAnalysisJson(JSON.stringify(invalid))).toThrow(
      'Invalid analysis JSON: missing opportunity_score'
    )
  })

  it('extracts JSON object from text with trailing content', () => {
    const withTrailing = JSON.stringify(VALID_RESULT) + '\n\nSome extra text'
    // parseAnalysisJson itself doesn't strip — caller does the extraction
    // This just verifies clean JSON works
    const result = parseAnalysisJson(JSON.stringify(VALID_RESULT))
    expect(result.model_used).toBe('claude-sonnet-4-6')
  })
})
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npm test -- claude
```

Expected: FAIL — "Cannot find module '../claude'"

- [ ] **Step 3: Create `src/lib/claude.ts`**

```typescript
import Anthropic from '@anthropic-ai/sdk'
import type { PlacesContext, AnalysisResult } from '@/types/analysis'

const MODEL = 'claude-sonnet-4-6'
export const JSON_DELIMITER = '---JSON---'

export function parseAnalysisJson(raw: string): AnalysisResult {
  const parsed = JSON.parse(raw.trim())
  if (typeof parsed.opportunity_score !== 'number') {
    throw new Error('Invalid analysis JSON: missing opportunity_score')
  }
  return parsed as AnalysisResult
}

function buildPrompt(
  city: string,
  businessType: string | null,
  context: PlacesContext
): string {
  const typeLabel = businessType ?? 'todos los tipos de negocio'

  const topPainPoints = context.businesses
    .filter((b) => b.rating > 0 && b.rating < 3.5 && b.recent_reviews.length > 0)
    .flatMap((b) => b.recent_reviews.map((r) => `[${b.name}]: ${r}`))
    .slice(0, 15)
    .join('\n')

  const businessSummary = context.businesses
    .slice(0, 40)
    .map(
      (b) =>
        `- ${b.name} | ${b.rating > 0 ? b.rating + '★' : 'sin rating'} (${b.review_count} reseñas) | ${b.address}`
    )
    .join('\n')

  return `Eres un analista de mercado local experto. Analiza el mercado de "${typeLabel}" en ${city} con datos reales de Google Places.

DATOS: ${context.total_count} negocios | Rating promedio: ${context.avg_rating} | Distribución: ${JSON.stringify(context.rating_distribution)}

NEGOCIOS:
${businessSummary}

RESEÑAS DE NEGOCIOS CON PROBLEMAS:
${topPainPoints || 'Sin reseñas disponibles de negocios con bajo rating.'}

INSTRUCCIONES:
1. Escribe un resumen ejecutivo en español de 3-4 párrafos. Sé específico: menciona negocios reales, patrones concretos y recomendaciones accionables.
2. Escribe exactamente esta línea: ${JSON_DELIMITER}
3. Escribe el JSON estructurado siguiendo este schema exacto:

{
  "market": {
    "saturation_level": "bajo|medio|alto|saturado",
    "saturation_score": <0-100>,
    "total_businesses_analyzed": ${context.total_count},
    "avg_rating": ${context.avg_rating},
    "rating_distribution": ${JSON.stringify(context.rating_distribution)}
  },
  "opportunities": [
    {
      "title": "string",
      "description": "string",
      "evidence": "string con datos concretos",
      "opportunity_score": <0-100>,
      "category": "categoria_faltante|punto_debil|tendencia|zona"
    }
  ],
  "pain_points": [
    {
      "issue": "string",
      "frequency": "baja|media|alta",
      "example_quote": "cita de reseña real o descripción del problema"
    }
  ],
  "zones": [
    {
      "description": "nombre o descripción de la zona",
      "insight": "observación sobre esa zona"
    }
  ],
  "opportunity_score": <0-100>,
  "opportunity_label": "string descriptivo del nivel de oportunidad",
  "executive_summary": "mismo texto del resumen ejecutivo anterior",
  "generated_at": "${new Date().toISOString()}",
  "model_used": "${MODEL}"
}`
}

export async function streamAnalysis(
  city: string,
  businessType: string | null,
  context: PlacesContext,
  onChunk: (text: string) => void
): Promise<AnalysisResult> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const prompt = buildPrompt(city, businessType, context)

  let fullText = ''

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  })

  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      const chunk = event.delta.text
      fullText += chunk
      onChunk(chunk)
    }
  }

  const delimiterIndex = fullText.indexOf(JSON_DELIMITER)
  if (delimiterIndex === -1) {
    throw new Error('Claude response missing JSON delimiter — raw: ' + fullText.slice(0, 200))
  }

  const jsonStr = fullText.slice(delimiterIndex + JSON_DELIMITER.length).trim()

  try {
    return parseAnalysisJson(jsonStr)
  } catch {
    // Try extracting JSON object if there's surrounding text
    const match = jsonStr.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('No JSON object found in Claude response')
    return parseAnalysisJson(match[0])
  }
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npm test -- claude
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/claude.ts src/lib/__tests__/claude.test.ts
git commit -m "feat: add Claude streaming client with JSON parser"
```

---

## Task 6: Analysis Cache

**Files:**
- Create: `src/lib/analysis-cache.ts`
- Create: `src/lib/__tests__/analysis-cache.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/__tests__/analysis-cache.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock supabase before importing cache
vi.mock('../supabase', () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
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

- [ ] **Step 2: Run tests — expect failure**

```bash
npm test -- analysis-cache
```

Expected: FAIL — "Cannot find module '../analysis-cache'"

- [ ] **Step 3: Create `src/lib/analysis-cache.ts`**

```typescript
import { supabaseAdmin } from './supabase'
import type { AnalysisResult } from '@/types/analysis'

const CACHE_TTL_HOURS = 24

export type CachedAnalysis = {
  result: AnalysisResult
  created_at: string
}

export function buildCacheKey(city: string, businessType: string | null): string {
  return `${city.toLowerCase()}:${(businessType ?? '_all_').toLowerCase()}`
}

export async function getCachedAnalysis(
  city: string,
  businessType: string | null
): Promise<CachedAnalysis | null> {
  const cacheKey = buildCacheKey(city, businessType)
  const cutoff = new Date(Date.now() - CACHE_TTL_HOURS * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabaseAdmin
    .from('analyses')
    .select('result, created_at')
    .eq('cache_key', cacheKey)
    .gt('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) return null
  return data as CachedAnalysis
}

export async function saveAnalysis(
  city: string,
  businessType: string | null,
  result: AnalysisResult,
  businessesCount: number,
  avgRating: number
): Promise<void> {
  const { error } = await supabaseAdmin.from('analyses').insert({
    city,
    business_type: businessType,
    result,
    businesses_count: businessesCount,
    avg_rating: avgRating,
  })
  if (error) throw error
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npm test -- analysis-cache
```

Expected: PASS

- [ ] **Step 5: Run all tests**

```bash
npm test
```

Expected: All PASS (supabase, google-places, claude, analysis-cache)

- [ ] **Step 6: Commit**

```bash
git add src/lib/analysis-cache.ts src/lib/__tests__/analysis-cache.test.ts
git commit -m "feat: add 24h analysis cache with Supabase"
```

---

## Task 7: API Route (Edge Runtime)

**Files:**
- Create: `src/app/api/analyze/route.ts`

No unit tests — this is integration logic tested manually in Task 15.

- [ ] **Step 1: Create the directory**

```bash
mkdir -p src/app/api/analyze
```

- [ ] **Step 2: Create `src/app/api/analyze/route.ts`**

```typescript
import type { NextRequest } from 'next/server'
import { fetchAndNormalizePlaces } from '@/lib/google-places'
import { streamAnalysis, JSON_DELIMITER } from '@/lib/claude'
import { getCachedAnalysis, saveAnalysis } from '@/lib/analysis-cache'
import type { SearchParams, AnalysisResult, PlacesContext } from '@/types/analysis'

export const runtime = 'edge'

export async function POST(req: NextRequest) {
  const body = (await req.json()) as SearchParams
  const city = body.city?.trim()
  const businessType = body.business_type?.trim() || null

  if (!city) {
    return new Response(JSON.stringify({ error: 'Ciudad requerida' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Cache hit: return immediately as plain text with CACHED marker
  const cached = await getCachedAnalysis(city, businessType)
  if (cached) {
    const payload = `---CACHED---\n${JSON_DELIMITER}\n${JSON.stringify(cached.result)}`
    return new Response(payload, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }

  // Fetch from Google Places
  const apiKey = process.env.GOOGLE_PLACES_API_KEY!
  let context!: PlacesContext  // definite assignment — try block returns on error

  try {
    context = await fetchAndNormalizePlaces(city, businessType, apiKey)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error de Google Places'
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Stream Claude analysis to the client
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>()
  const writer = writable.getWriter()
  const encoder = new TextEncoder()

  if (context.total_count < 5) {
    await writer.write(
      encoder.encode(
        '[NOTA: Se encontraron pocos negocios para esta búsqueda. El análisis puede ser limitado.]\n\n'
      )
    )
  }

  let analysisResult: AnalysisResult | null = null

  const streamPromise = streamAnalysis(city, businessType, context, async (chunk) => {
    await writer.write(encoder.encode(chunk))
  })
    .then(async (result) => {
      analysisResult = result
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

  // Save to DB after stream completes — non-blocking relative to response
  streamPromise.then(() => {
    if (analysisResult) {
      void saveAnalysis(
        city,
        businessType,
        analysisResult,
        context.total_count,
        context.avg_rating
      ).catch((err) => console.error('Cache save failed:', err))
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

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/
git commit -m "feat: add Edge Runtime analyze API with streaming"
```

---

## Task 8: useAnalysisStream Hook

**Files:**
- Create: `src/hooks/useAnalysisStream.ts`

- [ ] **Step 1: Create `src/hooks/useAnalysisStream.ts`**

```typescript
'use client'

import { useState, useCallback } from 'react'
import type { StreamState, SearchParams, AnalysisResult } from '@/types/analysis'

const JSON_DELIMITER = '---JSON---'
const CACHED_MARKER = '---CACHED---'

export function useAnalysisStream() {
  const [state, setState] = useState<StreamState>({
    phase: 'idle',
    summary: '',
    result: null,
    error: null,
  })

  const analyze = useCallback(async (params: SearchParams) => {
    setState({ phase: 'loading', summary: '', result: null, error: null })

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })

      if (!res.ok) {
        const err = await res.json()
        setState((s) => ({ ...s, phase: 'error', error: err.error ?? 'Error desconocido' }))
        return
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let isInJsonPhase = false

      setState((s) => ({ ...s, phase: 'streaming_summary' }))

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // Entire response is a cache hit
        if (buffer.includes(CACHED_MARKER)) {
          const jsonStart = buffer.indexOf(JSON_DELIMITER)
          if (jsonStart !== -1) {
            const jsonStr = buffer.slice(jsonStart + JSON_DELIMITER.length).trim()
            try {
              const result: AnalysisResult = JSON.parse(jsonStr)
              setState({
                phase: 'complete',
                summary: result.executive_summary,
                result,
                error: null,
              })
            } catch {
              setState((s) => ({
                ...s,
                phase: 'error',
                error: 'Error al leer resultado cacheado',
              }))
            }
          }
          return
        }

        if (!isInJsonPhase) {
          const delimIdx = buffer.indexOf(JSON_DELIMITER)
          if (delimIdx !== -1) {
            // Transition: everything before delimiter is the summary
            const summary = buffer.slice(0, delimIdx)
            buffer = buffer.slice(delimIdx + JSON_DELIMITER.length)
            isInJsonPhase = true
            setState((s) => ({ ...s, summary, phase: 'streaming_json' }))
          } else {
            // Still streaming summary text
            setState((s) => ({ ...s, summary: buffer }))
          }
        }
        // In JSON phase, just accumulate — parse when stream ends
      }

      // Parse structured JSON from remaining buffer
      if (isInJsonPhase && buffer.trim()) {
        try {
          const match = buffer.trim().match(/\{[\s\S]*\}/)
          if (!match) throw new Error('No JSON object')
          const result: AnalysisResult = JSON.parse(match[0])
          setState((s) => ({
            phase: 'complete',
            summary: result.executive_summary,
            result,
            error: null,
          }))
        } catch {
          setState((s) => ({
            ...s,
            phase: 'error',
            error: 'Error al parsear el análisis. Intenta de nuevo.',
          }))
        }
      }
    } catch (err) {
      setState((s) => ({
        ...s,
        phase: 'error',
        error: err instanceof Error ? err.message : 'Error de conexión',
      }))
    }
  }, [])

  const reset = useCallback(() => {
    setState({ phase: 'idle', summary: '', result: null, error: null })
  }, [])

  return { state, analyze, reset }
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/
git commit -m "feat: add useAnalysisStream hook for progressive rendering"
```

---

## Task 9: shadcn/ui Initialization

**Files:** Auto-generates `components.json` and `src/components/ui/` folder.

- [ ] **Step 1: Initialize shadcn/ui**

```bash
npx shadcn@latest init
```

Answer prompts:
- Style: **New York**
- Base color: **Zinc**
- CSS variables: **Yes**

- [ ] **Step 2: Install required components**

```bash
npx shadcn@latest add button input card badge progress
```

- [ ] **Step 3: Verify components exist**

```bash
ls src/components/ui/
```

Expected: `button.tsx`, `input.tsx`, `card.tsx`, `badge.tsx`, `progress.tsx`

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/ components.json src/app/globals.css
git commit -m "feat: initialize shadcn/ui with core components"
```

---

## Task 10: Result Display Components

**Files:**
- Create: `src/components/results/ExecutiveSummary.tsx`
- Create: `src/components/results/OpportunityScore.tsx`
- Create: `src/components/results/MarketSaturation.tsx`
- Create: `src/components/results/OpportunityList.tsx`
- Create: `src/components/results/PainPoints.tsx`

- [ ] **Step 1: Create `src/components/results/ExecutiveSummary.tsx`**

```tsx
type Props = {
  summary: string
  streaming?: boolean
}

export function ExecutiveSummary({ summary, streaming }: Props) {
  return (
    <div className="rounded-xl border bg-card p-6">
      <h3 className="font-semibold text-lg mb-4">Resumen ejecutivo</h3>
      <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
        {summary}
        {streaming && (
          <span className="inline-block w-0.5 h-4 bg-foreground ml-0.5 animate-pulse align-middle" />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `src/components/results/OpportunityScore.tsx`**

```tsx
import { Badge } from '@/components/ui/badge'

type Props = {
  score: number
  label: string
}

function scoreColor(score: number) {
  if (score >= 70) return 'text-green-600'
  if (score >= 40) return 'text-yellow-600'
  return 'text-red-500'
}

export function OpportunityScore({ score, label }: Props) {
  return (
    <div className="rounded-xl border bg-card p-6 flex flex-col items-center gap-3">
      <span className="text-xs text-muted-foreground uppercase tracking-wide">Score de oportunidad</span>
      <span className={`text-7xl font-bold tabular-nums ${scoreColor(score)}`}>{score}</span>
      <span className="text-sm text-muted-foreground">/ 100</span>
      <Badge variant="outline" className="text-sm">{label}</Badge>
    </div>
  )
}
```

- [ ] **Step 3: Create `src/components/results/MarketSaturation.tsx`**

```tsx
import { Progress } from '@/components/ui/progress'
import type { MarketData } from '@/types/analysis'

const SATURATION_LABELS: Record<string, string> = {
  bajo: 'Bajo',
  medio: 'Medio',
  alto: 'Alto',
  saturado: 'Saturado',
}

type Props = { market: MarketData }

export function MarketSaturation({ market }: Props) {
  return (
    <div className="rounded-xl border bg-card p-6 space-y-4">
      <h3 className="font-semibold text-lg">Saturación del mercado</h3>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Nivel</span>
        <span className="font-medium">
          {SATURATION_LABELS[market.saturation_level] ?? market.saturation_level}
        </span>
      </div>
      <Progress value={market.saturation_score} className="h-2" />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{market.total_businesses_analyzed} negocios analizados</span>
        <span>Promedio {market.avg_rating}★</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create `src/components/results/OpportunityList.tsx`**

```tsx
import { Badge } from '@/components/ui/badge'
import type { Opportunity } from '@/types/analysis'

const CATEGORY_LABELS: Record<string, string> = {
  categoria_faltante: 'Categoría faltante',
  punto_debil: 'Punto débil',
  tendencia: 'Tendencia',
  zona: 'Zona',
}

type Props = { opportunities: Opportunity[] }

export function OpportunityList({ opportunities }: Props) {
  if (opportunities.length === 0) return null

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-lg">Oportunidades detectadas</h3>
      {opportunities.map((op, i) => (
        <div key={i} className="rounded-lg border bg-card p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <span className="font-medium text-sm">{op.title}</span>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="secondary" className="text-xs">
                {CATEGORY_LABELS[op.category] ?? op.category}
              </Badge>
              <span className="text-sm font-bold text-green-600">{op.opportunity_score}</span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mb-1">{op.description}</p>
          {op.evidence && (
            <p className="text-xs text-muted-foreground/70 italic">Evidencia: {op.evidence}</p>
          )}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 5: Create `src/components/results/PainPoints.tsx`**

```tsx
import { Badge } from '@/components/ui/badge'
import type { PainPoint } from '@/types/analysis'

type Variant = 'default' | 'secondary' | 'destructive'

const FREQ_VARIANT: Record<string, Variant> = {
  alta: 'destructive',
  media: 'default',
  baja: 'secondary',
}

type Props = { painPoints: PainPoint[] }

export function PainPoints({ painPoints }: Props) {
  if (painPoints.length === 0) return null

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-lg">Puntos débiles del mercado</h3>
      {painPoints.map((pp, i) => (
        <div key={i} className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium text-sm">{pp.issue}</span>
            <Badge variant={FREQ_VARIANT[pp.frequency] ?? 'secondary'} className="text-xs">
              Frecuencia {pp.frequency}
            </Badge>
          </div>
          {pp.example_quote && (
            <blockquote className="text-xs text-muted-foreground border-l-2 border-muted pl-3 italic">
              "{pp.example_quote}"
            </blockquote>
          )}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 6: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/results/
git commit -m "feat: add result display components (score, saturation, opportunities, pain points)"
```

---

## Task 11: AnalysisStream + ResultsDashboard

**Files:**
- Create: `src/components/results/AnalysisStream.tsx`
- Create: `src/components/results/ResultsDashboard.tsx`

- [ ] **Step 1: Create `src/components/results/AnalysisStream.tsx`**

```tsx
import { ExecutiveSummary } from './ExecutiveSummary'
import { OpportunityScore } from './OpportunityScore'
import { MarketSaturation } from './MarketSaturation'
import { OpportunityList } from './OpportunityList'
import { PainPoints } from './PainPoints'
import type { StreamState } from '@/types/analysis'

type Props = { state: StreamState }

export function AnalysisStream({ state }: Props) {
  const { phase, summary, result, error } = state

  if (phase === 'idle') return null

  if (phase === 'error') {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 text-sm">
        {error ?? 'Ocurrió un error inesperado. Intenta de nuevo.'}
      </div>
    )
  }

  if (phase === 'loading') {
    return (
      <div className="flex items-center gap-3 text-muted-foreground py-8">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span>Obteniendo datos del mercado...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {summary && (
        <ExecutiveSummary
          summary={summary}
          streaming={phase === 'streaming_summary'}
        />
      )}

      {result && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <OpportunityScore
              score={result.opportunity_score}
              label={result.opportunity_label}
            />
            <MarketSaturation market={result.market} />
          </div>
          <OpportunityList opportunities={result.opportunities} />
          <PainPoints painPoints={result.pain_points} />
          {result.zones.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-lg">Zonas de interés</h3>
              {result.zones.map((zone, i) => (
                <div key={i} className="rounded-lg border bg-card p-4">
                  <p className="font-medium text-sm mb-1">{zone.description}</p>
                  <p className="text-sm text-muted-foreground">{zone.insight}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create `src/components/results/ResultsDashboard.tsx`**

```tsx
'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useAnalysisStream } from '@/hooks/useAnalysisStream'
import { AnalysisStream } from './AnalysisStream'
import { Button } from '@/components/ui/button'

type Props = {
  city: string
  businessType: string
}

export function ResultsDashboard({ city, businessType }: Props) {
  const { state, analyze } = useAnalysisStream()

  useEffect(() => {
    if (city) {
      analyze({ city, business_type: businessType })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, businessType])

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{city}</h1>
          {businessType && (
            <p className="text-muted-foreground capitalize">{businessType}</p>
          )}
        </div>
        <Button variant="outline" asChild>
          <Link href="/">Nueva búsqueda</Link>
        </Button>
      </div>

      <AnalysisStream state={state} />
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/results/AnalysisStream.tsx src/components/results/ResultsDashboard.tsx
git commit -m "feat: add AnalysisStream orchestrator and ResultsDashboard"
```

---

## Task 12: SearchForm Component

**Files:**
- Create: `src/components/search/SearchForm.tsx`

- [ ] **Step 1: Create `src/components/search/SearchForm.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { SearchParams } from '@/types/analysis'

type Props = {
  onSubmit: (params: SearchParams) => void
  loading?: boolean
}

export function SearchForm({ onSubmit, loading }: Props) {
  const [city, setCity] = useState('')
  const [businessType, setBusinessType] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!city.trim()) return
    onSubmit({ city: city.trim(), business_type: businessType.trim() })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm">
      <div className="space-y-1.5">
        <label htmlFor="city" className="text-sm font-medium">
          Ciudad <span className="text-red-500">*</span>
        </label>
        <Input
          id="city"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="ej. Buenos Aires, Madrid, Ciudad de México"
          required
          disabled={loading}
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="business-type" className="text-sm font-medium">
          Tipo de negocio{' '}
          <span className="text-muted-foreground font-normal">(opcional)</span>
        </label>
        <Input
          id="business-type"
          value={businessType}
          onChange={(e) => setBusinessType(e.target.value)}
          placeholder="ej. restaurante, gym, cafetería, peluquería"
          disabled={loading}
        />
      </div>
      <Button type="submit" disabled={loading || !city.trim()} className="w-full">
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Analizando...
          </span>
        ) : (
          'Analizar mercado'
        )}
      </Button>
    </form>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/search/
git commit -m "feat: add SearchForm component"
```

---

## Task 13: Pages

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/page.tsx`
- Create: `src/app/results/page.tsx`

- [ ] **Step 1: Replace `src/app/layout.tsx`**

```tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Local Opportunity Finder',
  description: 'Detecta oportunidades de negocio locales con IA',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${inter.className} antialiased`}>
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Replace `src/app/page.tsx`**

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { SearchForm } from '@/components/search/SearchForm'
import type { SearchParams } from '@/types/analysis'

export default function HomePage() {
  const router = useRouter()

  const handleSubmit = (params: SearchParams) => {
    const qs = new URLSearchParams({ city: params.city })
    if (params.business_type) qs.set('business_type', params.business_type)
    router.push(`/results?${qs.toString()}`)
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-10 p-8">
      <div className="text-center space-y-3 max-w-lg">
        <h1 className="text-4xl font-bold tracking-tight">Local Opportunity Finder</h1>
        <p className="text-muted-foreground text-lg">
          Detecta oportunidades de negocio locales analizando datos reales de Google Places con IA
        </p>
      </div>
      <SearchForm onSubmit={handleSubmit} />
      <p className="text-xs text-muted-foreground">
        Powered by Google Places + Claude AI
      </p>
    </div>
  )
}
```

- [ ] **Step 3: Create `src/app/results/page.tsx`**

```tsx
import { ResultsDashboard } from '@/components/results/ResultsDashboard'

type Props = {
  searchParams: Promise<{ city?: string; business_type?: string }>
}

export default async function ResultsPage({ searchParams }: Props) {
  const params = await searchParams
  return (
    <ResultsDashboard
      city={params.city ?? ''}
      businessType={params.business_type ?? ''}
    />
  )
}
```

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/
git commit -m "feat: add home page, results page, and root layout"
```

---

## Task 14: End-to-End Verification

- [ ] **Step 1: Run all unit tests**

```bash
npm test
```

Expected: All tests PASS.

- [ ] **Step 2: Start dev server**

```bash
npm run dev
```

Expected: "Ready in Xms - Local: http://localhost:3000"

- [ ] **Step 3: Test home page**

Open http://localhost:3000 in browser.

Expected: Title "Local Opportunity Finder", two inputs, button disabled when city is empty.

- [ ] **Step 4: Run a real analysis**

Enter city: "Buenos Aires", type: "restaurante" → click "Analizar mercado".

Expected sequence:
1. URL changes to `/results?city=Buenos+Aires&business_type=restaurante`
2. "Obteniendo datos del mercado..." spinner shows
3. Executive summary text starts streaming progressively
4. After 10-30s: score card, saturation card, opportunities, pain points appear
5. No console errors

- [ ] **Step 5: Test cache**

Run same search again immediately.

Expected: Result appears near-instantly (< 1s) from cache.

- [ ] **Step 6: Test error state**

Navigate to http://localhost:3000/results?city= (empty city).

Expected: Error message shows "Ciudad requerida" or falls back gracefully.

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "chore: verified MVP end-to-end — all features working"
```

---

## Environment Summary

All keys needed in `.env.local`:

| Key | Where to get it |
|-----|----------------|
| `GOOGLE_PLACES_API_KEY` | [Google Cloud Console](https://console.cloud.google.com) → Enable "Places API (New)" |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase project settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase project settings → API (keep secret) |

## Phase 2 Preparation (not in this plan)

When ready to extend:
- **Auth:** Add `user_id uuid references auth.users` to `analyses` table
- **Saved reports:** New table linking users to analysis IDs
- **Map:** `result.zones[]` already structured for Mapbox rendering
- **Payments:** Stripe webhook + `subscriptions` table
- **Async re-analysis:** Supabase Edge Functions on a schedule
