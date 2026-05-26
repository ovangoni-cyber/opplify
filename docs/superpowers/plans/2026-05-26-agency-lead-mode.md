# Agency Lead Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Agency Lead Mode that analyzes businesses as potential agency clients, surfacing lead scores, pain points, and personalized pitches alongside the existing Market Research Mode.

**Architecture:** Same `/api/analyze` endpoint receives a `mode` field and switches the Claude prompt. A `ModeToggle` on the home page sets the mode, which flows as a query param to `/results`. `ResultsDashboard` renders either `AnalysisStream` or `AgencyLeadsStream` based on mode.

**Tech Stack:** Next.js 16, TypeScript, Tailwind CSS, Anthropic SDK, Supabase

---

## File Map

| Action | File |
|--------|------|
| Modify | `src/types/analysis.ts` |
| Modify | `src/lib/analysis-cache.ts` |
| Modify | `src/lib/__tests__/analysis-cache.test.ts` |
| Modify | `src/lib/claude.ts` |
| Modify | `src/lib/__tests__/claude.test.ts` |
| Modify | `src/app/api/analyze/route.ts` |
| Create | `src/components/search/ModeToggle.tsx` |
| Modify | `src/components/search/SearchForm.tsx` |
| Modify | `src/app/page.tsx` |
| Modify | `src/app/results/page.tsx` |
| Modify | `src/components/results/ResultsDashboard.tsx` |
| Create | `src/components/results/AgencyLeadCard.tsx` |
| Create | `src/components/results/AgencyLeadsList.tsx` |
| Create | `src/components/results/AgencyLeadsStream.tsx` |
| Create | `supabase/migrations/0002_add_mode_column.sql` |

---

## Task 1: DB Migration

**Files:**
- Create: `supabase/migrations/0002_add_mode_column.sql`

- [ ] **Step 1: Write the migration file**

```sql
ALTER TABLE analyses ADD COLUMN mode text NOT NULL DEFAULT 'market_research';
DROP INDEX idx_analyses_cache_lookup;
CREATE INDEX idx_analyses_cache_lookup ON analyses (cache_key, mode, created_at DESC);
```

Save this to `supabase/migrations/0002_add_mode_column.sql`.

- [ ] **Step 2: Run the migration in Supabase**

Go to your Supabase project → SQL Editor → New query. Paste the SQL above and click Run.
Expected output: `Success. No rows returned`

- [ ] **Step 3: Commit the migration file**

```bash
git add supabase/migrations/0002_add_mode_column.sql
git commit -m "feat: add mode column to analyses table"
```

---

## Task 2: Update Types

**Files:**
- Modify: `src/types/analysis.ts`

- [ ] **Step 1: Add new types and update SearchParams**

Replace the entire contents of `src/types/analysis.ts` with:

```typescript
export type SaturationLevel = 'bajo' | 'medio' | 'alto' | 'saturado'
export type OpportunityCategory = 'categoria_faltante' | 'punto_debil' | 'tendencia' | 'zona'
export type Frequency = 'baja' | 'media' | 'alta'
export type AppMode = 'market_research' | 'agency_leads'
export type AgencyService =
  | 'seo'
  | 'ai_automation'
  | 'chatbot'
  | 'branding'
  | 'ads'
  | 'web_redesign'
  | 'crm'
  | 'reputation'

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
  evidence?: string
  opportunity_score: number
  category: OpportunityCategory
}

export type PainPoint = {
  issue: string
  frequency: Frequency
  example_quote?: string
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

export type AgencyLead = {
  business_name: string
  address: string
  rating: number
  review_count: number
  lead_score: number
  pain_points: string[]
  recommended_services: AgencyService[]
  summary: string
  pitch: string
}

export type AgencyLeadsResult = {
  leads: AgencyLead[]
  total_analyzed: number
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
  result: AnalysisResult | AgencyLeadsResult | null
  error: string | null
}

export type SearchParams = {
  city: string
  business_type: string
  mode: AppMode
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

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: errors about callers that now need `mode` — that's expected and will be fixed in subsequent tasks. If there are other unexpected errors, fix them before continuing.

- [ ] **Step 3: Commit**

```bash
git add src/types/analysis.ts
git commit -m "feat: add AppMode, AgencyLead, AgencyLeadsResult types"
```

---

## Task 3: Update Cache

**Files:**
- Modify: `src/lib/analysis-cache.ts`

- [ ] **Step 1: Add `mode` param to getCachedAnalysis and saveAnalysis**

Replace the entire contents of `src/lib/analysis-cache.ts` with:

```typescript
import { supabaseAdmin } from './supabase'
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

  const { data, error } = await supabaseAdmin
    .from('analyses')
    .select('result, created_at')
    .eq('cache_key', cacheKey)
    .eq('mode', mode)
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
  result: AnalysisResult | AgencyLeadsResult,
  businessesCount: number,
  avgRating: number,
  mode: AppMode
): Promise<void> {
  const { error } = await supabaseAdmin.from('analyses').insert({
    city,
    business_type: businessType,
    result,
    businesses_count: businessesCount,
    avg_rating: avgRating,
    mode,
  })
  if (error) throw error
}
```

- [ ] **Step 2: Run existing cache tests — they should still pass**

```bash
npx vitest run src/lib/__tests__/analysis-cache.test.ts
```

Expected: all 3 `buildCacheKey` tests pass (that function didn't change).

- [ ] **Step 3: Commit**

```bash
git add src/lib/analysis-cache.ts
git commit -m "feat: add mode param to getCachedAnalysis and saveAnalysis"
```

---

## Task 4: Add parseAgencyLeadsJson (TDD)

**Files:**
- Modify: `src/lib/__tests__/claude.test.ts`
- Modify: `src/lib/claude.ts`

- [ ] **Step 1: Write the failing test**

Add this block at the end of `src/lib/__tests__/claude.test.ts`:

```typescript
import { parseAnalysisJson, parseAgencyLeadsJson } from '../claude'

const VALID_LEADS_RESULT = {
  leads: [
    {
      business_name: 'Pizzería Roma',
      address: 'Calle Mayor 10',
      rating: 2.8,
      review_count: 34,
      lead_score: 82,
      pain_points: ['No responde reviews', 'Sin sistema de reservas'],
      recommended_services: ['reputation', 'chatbot'],
      summary: 'Pizzería con alto tráfico pero mala gestión digital.',
      pitch: 'Sus competidores responden reviews y usted no. Podemos cambiar eso.',
    },
  ],
  total_analyzed: 20,
  generated_at: '2026-05-26T10:00:00Z',
  model_used: 'claude-sonnet-4-6',
}

describe('parseAgencyLeadsJson', () => {
  it('parses valid agency leads JSON', () => {
    const result = parseAgencyLeadsJson(JSON.stringify(VALID_LEADS_RESULT))
    expect(result.leads).toHaveLength(1)
    expect(result.leads[0].lead_score).toBe(82)
  })

  it('throws on invalid JSON', () => {
    expect(() => parseAgencyLeadsJson('not json')).toThrow()
  })

  it('throws when leads array is missing', () => {
    const invalid = { ...VALID_LEADS_RESULT, leads: undefined }
    expect(() => parseAgencyLeadsJson(JSON.stringify(invalid))).toThrow(
      'Invalid agency leads JSON: missing leads array'
    )
  })

  it('handles whitespace around JSON', () => {
    const result = parseAgencyLeadsJson('  ' + JSON.stringify(VALID_LEADS_RESULT) + '\n')
    expect(result.total_analyzed).toBe(20)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
npx vitest run src/lib/__tests__/claude.test.ts
```

Expected: FAIL — `parseAgencyLeadsJson is not a function`

- [ ] **Step 3: Add parseAgencyLeadsJson to claude.ts**

Add after the `parseAnalysisJson` function in `src/lib/claude.ts`:

```typescript
export function parseAgencyLeadsJson(raw: string): AgencyLeadsResult {
  const parsed = JSON.parse(raw.trim())
  if (!Array.isArray(parsed.leads)) {
    throw new Error('Invalid agency leads JSON: missing leads array')
  }
  return parsed as AgencyLeadsResult
}
```

Also add `AgencyLeadsResult` to the import at the top of `claude.ts`:

```typescript
import type { PlacesContext, AnalysisResult, AgencyLeadsResult, AppMode } from '@/types/analysis'
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/lib/__tests__/claude.test.ts
```

Expected: all tests pass (both `parseAnalysisJson` and `parseAgencyLeadsJson` suites)

- [ ] **Step 5: Commit**

```bash
git add src/lib/claude.ts src/lib/__tests__/claude.test.ts
git commit -m "feat: add parseAgencyLeadsJson with tests"
```

---

## Task 5: Add Agency Leads Prompt and Update streamAnalysis

**Files:**
- Modify: `src/lib/claude.ts`

- [ ] **Step 1: Add the agency leads prompt builder**

Add this function after `buildPrompt` in `src/lib/claude.ts`:

```typescript
function buildAgencyLeadsPrompt(
  city: string,
  businessType: string | null,
  context: PlacesContext
): string {
  const typeLabel = businessType ?? 'todos los tipos de negocio'

  const businessSummary = context.businesses
    .slice(0, 40)
    .map(
      (b) =>
        `- ${b.name} | ${b.rating > 0 ? b.rating + '★' : 'sin rating'} (${b.review_count} reseñas) | ${b.address}${
          b.recent_reviews.length > 0
            ? '\n  Reseñas: ' + b.recent_reviews.slice(0, 3).join(' | ')
            : ''
        }`
    )
    .join('\n')

  return `Eres un analista de prospección comercial para agencias digitales. Analiza cada negocio de "${typeLabel}" en ${city} como lead potencial para servicios de marketing, automatización, SEO, diseño web o IA.

DATOS GLOBALES: ${context.total_count} negocios | Rating promedio: ${context.avg_rating}

NEGOCIOS A EVALUAR:
${businessSummary}

INSTRUCCIONES:
1. Escribe un resumen ejecutivo de 1-2 párrafos sobre el panorama de oportunidades para agencias en este sector y ciudad.
2. Escribe exactamente esta línea: ${JSON_DELIMITER}
3. Devuelve el JSON estructurado según este schema exacto:

{
  "leads": [
    {
      "business_name": "nombre del negocio",
      "address": "dirección",
      "rating": <número con un decimal>,
      "review_count": <número entero>,
      "lead_score": <0-100>,
      "pain_points": ["problema específico detectado en lenguaje directo", ...],
      "recommended_services": ["seo"|"ai_automation"|"chatbot"|"branding"|"ads"|"web_redesign"|"crm"|"reputation"],
      "summary": "resumen de 1-2 frases del negocio como prospecto de agencia",
      "pitch": "argumento de venta personalizado de 2-3 frases para este negocio"
    }
  ],
  "total_analyzed": ${context.total_count},
  "generated_at": "${new Date().toISOString()}",
  "model_used": "${MODEL}"
}

CRITERIOS DE SCORING (lead_score 0-100, mayor = mejor prospecto para agencia):
- Rating < 3.5★: suma 30 puntos (problemas de reputación urgentes)
- Menos de 20 reseñas: suma 20 puntos (presencia online débil)
- Reseñas mencionan esperas, sin reservas, sin respuesta del negocio: suma 15 pts cada señal
- Rating 3.5-4.0★ con volumen alto: suma 10 puntos (potencial de mejora)

Ordena los leads por lead_score descendente. Incluye TODOS los negocios evaluados.`
}
```

- [ ] **Step 2: Update streamAnalysis signature to accept mode**

Replace the existing `streamAnalysis` function signature and body in `src/lib/claude.ts`:

```typescript
export async function streamAnalysis(
  city: string,
  businessType: string | null,
  context: PlacesContext,
  mode: AppMode,
  onChunk: (text: string) => void
): Promise<AnalysisResult | AgencyLeadsResult> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const prompt =
    mode === 'agency_leads'
      ? buildAgencyLeadsPrompt(city, businessType, context)
      : buildPrompt(city, businessType, context)

  let fullText = ''

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 8192,
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

  if (mode === 'agency_leads') {
    try {
      return parseAgencyLeadsJson(jsonStr)
    } catch {
      const match = jsonStr.match(/\{[\s\S]*\}/)
      if (!match) throw new Error('No JSON object found in Claude agency leads response')
      return parseAgencyLeadsJson(match[0])
    }
  }

  try {
    return parseAnalysisJson(jsonStr)
  } catch {
    const match = jsonStr.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('No JSON object found in Claude response')
    return parseAnalysisJson(match[0])
  }
}
```

- [ ] **Step 3: Run all tests**

```bash
npx vitest run
```

Expected: all tests pass

- [ ] **Step 4: Commit**

```bash
git add src/lib/claude.ts
git commit -m "feat: add agency leads prompt and update streamAnalysis to accept mode"
```

---

## Task 6: Update API Route

**Files:**
- Modify: `src/app/api/analyze/route.ts`

- [ ] **Step 1: Update the route to handle mode**

Replace the entire contents of `src/app/api/analyze/route.ts`:

```typescript
import type { NextRequest } from 'next/server'
import { fetchAndNormalizePlaces } from '@/lib/google-places'
import { streamAnalysis, JSON_DELIMITER } from '@/lib/claude'
import { getCachedAnalysis, saveAnalysis } from '@/lib/analysis-cache'
import type { SearchParams, AnalysisResult, AgencyLeadsResult, PlacesContext, AppMode } from '@/types/analysis'

export const runtime = 'edge'

export async function POST(req: NextRequest) {
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

  if (!city) {
    return new Response(JSON.stringify({ error: 'Ciudad requerida' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const cached = await getCachedAnalysis(city, businessType, mode)
  if (cached) {
    const payload = `---CACHED---\n${JSON_DELIMITER}\n${JSON.stringify(cached.result)}`
    return new Response(payload, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
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
      encoder.encode(
        '[NOTA: Se encontraron pocos negocios para esta búsqueda. El análisis puede ser limitado.]\n\n'
      )
    )
  }

  let analysisResult: AnalysisResult | AgencyLeadsResult | null = null

  const streamPromise = streamAnalysis(city, businessType, context, mode, async (chunk) => {
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

  streamPromise.then(() => {
    if (analysisResult) {
      void saveAnalysis(
        city,
        businessType,
        analysisResult,
        context.total_count,
        context.avg_rating,
        mode
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

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors in the route file. Errors in UI files are expected at this point.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/analyze/route.ts
git commit -m "feat: pass mode through API route to cache and streamAnalysis"
```

---

## Task 7: Create ModeToggle Component

**Files:**
- Create: `src/components/search/ModeToggle.tsx`

- [ ] **Step 1: Create the component**

```typescript
'use client'

import type { AppMode } from '@/types/analysis'

type Props = {
  mode: AppMode
  onChange: (mode: AppMode) => void
}

export function ModeToggle({ mode, onChange }: Props) {
  return (
    <div className="flex rounded-lg border bg-muted p-1 gap-1 w-full max-w-sm">
      <button
        type="button"
        onClick={() => onChange('market_research')}
        className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
          mode === 'market_research'
            ? 'bg-background shadow text-foreground'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        Investigar mercado
      </button>
      <button
        type="button"
        onClick={() => onChange('agency_leads')}
        className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
          mode === 'agency_leads'
            ? 'bg-background shadow text-foreground'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        Buscar leads
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/search/ModeToggle.tsx
git commit -m "feat: add ModeToggle component"
```

---

## Task 8: Update SearchForm and Home Page

**Files:**
- Modify: `src/components/search/SearchForm.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Add mode prop to SearchForm**

Replace the entire contents of `src/components/search/SearchForm.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { SearchParams, AppMode } from '@/types/analysis'

type Props = {
  onSubmit: (params: SearchParams) => void
  mode: AppMode
  loading?: boolean
}

export function SearchForm({ onSubmit, mode, loading }: Props) {
  const [city, setCity] = useState('')
  const [businessType, setBusinessType] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!city.trim()) return
    onSubmit({ city: city.trim(), business_type: businessType.trim(), mode })
  }

  const buttonLabel =
    mode === 'agency_leads' ? 'Buscar leads' : 'Analizar mercado'

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
          buttonLabel
        )}
      </Button>
    </form>
  )
}
```

- [ ] **Step 2: Update home page to include ModeToggle**

Replace the entire contents of `src/app/page.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SearchForm } from '@/components/search/SearchForm'
import { ModeToggle } from '@/components/search/ModeToggle'
import type { SearchParams, AppMode } from '@/types/analysis'

export default function HomePage() {
  const router = useRouter()
  const [mode, setMode] = useState<AppMode>('market_research')

  const handleSubmit = (params: SearchParams) => {
    const qs = new URLSearchParams({ city: params.city, mode: params.mode })
    if (params.business_type) qs.set('business_type', params.business_type)
    router.push(`/results?${qs.toString()}`)
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-8 p-8">
      <div className="text-center space-y-3 max-w-lg">
        <h1 className="text-4xl font-bold tracking-tight">Local Opportunity Finder</h1>
        <p className="text-muted-foreground text-lg">
          Detecta oportunidades de negocio locales analizando datos reales de Google Places con IA
        </p>
      </div>
      <ModeToggle mode={mode} onChange={setMode} />
      <SearchForm mode={mode} onSubmit={handleSubmit} />
      <p className="text-xs text-muted-foreground">Powered by Google Places + Claude AI</p>
    </div>
  )
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: errors only in ResultsDashboard (not yet updated). No errors in page.tsx or SearchForm.tsx.

- [ ] **Step 4: Commit**

```bash
git add src/components/search/SearchForm.tsx src/app/page.tsx
git commit -m "feat: add ModeToggle to home page and mode prop to SearchForm"
```

---

## Task 9: Create AgencyLeadCard Component

**Files:**
- Create: `src/components/results/AgencyLeadCard.tsx`

- [ ] **Step 1: Create the component**

```typescript
import type { AgencyLead, AgencyService } from '@/types/analysis'

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

const SERVICE_COLOR: Record<AgencyService, string> = {
  seo: 'bg-blue-100 text-blue-700',
  ai_automation: 'bg-purple-100 text-purple-700',
  chatbot: 'bg-green-100 text-green-700',
  branding: 'bg-pink-100 text-pink-700',
  ads: 'bg-orange-100 text-orange-700',
  web_redesign: 'bg-cyan-100 text-cyan-700',
  crm: 'bg-yellow-100 text-yellow-700',
  reputation: 'bg-red-100 text-red-700',
}

function leadScoreColor(score: number) {
  if (score >= 70) return 'text-red-600'
  if (score >= 40) return 'text-yellow-600'
  return 'text-green-600'
}

type Props = { lead: AgencyLead }

export function AgencyLeadCard({ lead }: Props) {
  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-semibold text-base truncate">{lead.business_name}</p>
          <p className="text-xs text-muted-foreground truncate">{lead.address}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {lead.rating > 0 ? `${lead.rating}★` : 'Sin rating'} · {lead.review_count} reseñas
          </p>
        </div>
        <div className="flex flex-col items-center shrink-0">
          <span className={`text-4xl font-bold tabular-nums ${leadScoreColor(lead.lead_score)}`}>
            {lead.lead_score}
          </span>
          <span className="text-xs text-muted-foreground">lead score</span>
        </div>
      </div>

      {lead.pain_points.length > 0 && (
        <ul className="space-y-1">
          {lead.pain_points.map((pp, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-red-400 shrink-0" />
              {pp}
            </li>
          ))}
        </ul>
      )}

      {lead.recommended_services.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {lead.recommended_services.map((svc) => (
            <span
              key={svc}
              className={`px-2 py-0.5 rounded-full text-xs font-medium ${SERVICE_COLOR[svc] ?? 'bg-gray-100 text-gray-700'}`}
            >
              {SERVICE_LABEL[svc] ?? svc}
            </span>
          ))}
        </div>
      )}

      {lead.pitch && (
        <blockquote className="border-l-2 border-primary pl-3 text-sm text-muted-foreground italic">
          {lead.pitch}
        </blockquote>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/results/AgencyLeadCard.tsx
git commit -m "feat: add AgencyLeadCard component"
```

---

## Task 10: Create AgencyLeadsList Component

**Files:**
- Create: `src/components/results/AgencyLeadsList.tsx`

- [ ] **Step 1: Create the component**

```typescript
'use client'

import { useState } from 'react'
import { AgencyLeadCard } from './AgencyLeadCard'
import type { AgencyLead } from '@/types/analysis'

const PAGE_SIZE = 10

type Props = { leads: AgencyLead[] }

export function AgencyLeadsList({ leads }: Props) {
  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? leads : leads.slice(0, PAGE_SIZE)
  const remaining = leads.length - PAGE_SIZE

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-lg">
        Leads detectados{' '}
        <span className="text-muted-foreground font-normal text-base">({leads.length})</span>
      </h3>
      {visible.map((lead, i) => (
        <AgencyLeadCard key={`${lead.business_name}-${i}`} lead={lead} />
      ))}
      {!showAll && remaining > 0 && (
        <button
          onClick={() => setShowAll(true)}
          className="w-full py-3 rounded-xl border border-dashed text-sm text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
        >
          Ver {remaining} leads más
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/results/AgencyLeadsList.tsx
git commit -m "feat: add AgencyLeadsList with show-more pagination"
```

---

## Task 11: Create AgencyLeadsStream Component

**Files:**
- Create: `src/components/results/AgencyLeadsStream.tsx`

- [ ] **Step 1: Create the component**

```typescript
import { ExecutiveSummary } from './ExecutiveSummary'
import { AgencyLeadsList } from './AgencyLeadsList'
import type { StreamState, AgencyLeadsResult } from '@/types/analysis'

type Props = { state: StreamState }

export function AgencyLeadsStream({ state }: Props) {
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
        <span>Analizando prospectos...</span>
      </div>
    )
  }

  const leadsResult = result as AgencyLeadsResult | null

  return (
    <div className="space-y-6">
      {summary && (
        <ExecutiveSummary
          summary={summary}
          streaming={phase === 'streaming_summary'}
        />
      )}
      {leadsResult?.leads && leadsResult.leads.length > 0 && (
        <AgencyLeadsList leads={leadsResult.leads} />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/results/AgencyLeadsStream.tsx
git commit -m "feat: add AgencyLeadsStream component"
```

---

## Task 12: Update ResultsDashboard and Results Page

**Files:**
- Modify: `src/components/results/ResultsDashboard.tsx`
- Modify: `src/app/results/page.tsx`

- [ ] **Step 1: Update ResultsDashboard to accept mode and render the right stream**

Replace the entire contents of `src/components/results/ResultsDashboard.tsx`:

```typescript
'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useAnalysisStream } from '@/hooks/useAnalysisStream'
import { AnalysisStream } from './AnalysisStream'
import { AgencyLeadsStream } from './AgencyLeadsStream'
import { Button } from '@/components/ui/button'
import type { AppMode } from '@/types/analysis'

type Props = {
  city: string
  businessType: string
  mode: AppMode
}

export function ResultsDashboard({ city, businessType, mode }: Props) {
  const { state, analyze } = useAnalysisStream()

  useEffect(() => {
    if (city) {
      analyze({ city, business_type: businessType, mode })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, businessType, mode])

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

      {mode === 'agency_leads' ? (
        <AgencyLeadsStream state={state} />
      ) : (
        <AnalysisStream state={state} />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Update results page to pass mode**

Replace the entire contents of `src/app/results/page.tsx`:

```typescript
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

- [ ] **Step 3: Type-check — should be clean**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Run all tests**

```bash
npx vitest run
```

Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/components/results/ResultsDashboard.tsx src/app/results/page.tsx
git commit -m "feat: wire mode through ResultsDashboard and results page"
```

---

## Task 13: End-to-End Verification

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Test Market Research Mode (regression)**

1. Go to `http://localhost:3000`
2. Verify "Investigar mercado" tab is selected by default
3. Search a city (e.g. "Madrid") with a business type (e.g. "restaurante")
4. Verify: summary streams token by token, then cards appear (score, saturation, opportunities, pain points)

- [ ] **Step 3: Test Agency Lead Mode**

1. Go to `http://localhost:3000`
2. Click "Buscar leads" tab — verify it highlights
3. Verify the submit button now says "Buscar leads"
4. Search same city/business type as step 2
5. Verify: summary streams, then lead cards appear ordered by lead_score
6. Verify each card shows: business name, address, rating, lead score (colored), pain points, service badges, pitch
7. If more than 10 leads: verify "Ver X leads más" button appears and expands the list on click

- [ ] **Step 4: Test cache**

1. Run the same Agency Leads search again
2. Verify it returns instantly (cached response)
3. Run the same Market Research search from step 2 again — should also be cached (separate cache entry)

- [ ] **Step 5: Final commit if anything was fixed during testing**

```bash
git add -p
git commit -m "fix: <describe what was fixed>"
```
