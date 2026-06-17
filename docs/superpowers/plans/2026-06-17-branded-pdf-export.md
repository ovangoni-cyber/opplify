# Branded PDF Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users configure their agency's logo + name once, then export a branded PDF report of any completed analysis (both `market_research` and `agency_leads` modes).

**Architecture:** New `user_branding` table (one row per user, logo stored as `bytea` directly in Postgres — no external blob storage). New `/ajustes` page to manage branding. New `POST /api/export/pdf` route that renders a PDF server-side with `@react-pdf/renderer`, using one of two mode-specific templates, with the user's branding (or a generic fallback) in the header. The client sends the `result` it already has in memory — no server-side recompute or cache lookup.

**Tech Stack:** `@react-pdf/renderer` (server-side PDF rendering, Node runtime), existing `pg` pool, existing JWT auth.

**Spec:** `docs/superpowers/specs/2026-06-17-branded-pdf-export-design.md`

**Deviation from spec (resolved during planning):** The spec describes the "Exportar PDF" button living in `ResultsDashboard.tsx`. During planning, found that `agency_leads` mode accumulates leads across "Load More" clicks in local state inside `AgencyLeadsStream.tsx` — `ResultsDashboard`'s `state.result` only ever holds the *first* batch. Exporting from `ResultsDashboard` would silently drop leads loaded via "Load More". Fix: the button lives in `AnalysisStream.tsx` for `market_research` (which has no accumulation — `state.result` is already complete) and in `AgencyLeadsList.tsx` for `agency_leads` (which already receives the complete, deduped `leads` array as a prop — same place the existing "Exportar CSV" button lives). Same user-facing behavior, correct data in both cases.

---

## Task 1: Add `user_branding` table

**Files:**
- Modify: `database/schema.sql`

- [ ] **Step 1: Append the table to the schema file**

Add to the end of `database/schema.sql`:

```sql

CREATE TABLE user_branding (
  user_id     uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  agency_name text,
  logo_data   bytea,
  logo_mime   text,
  updated_at  timestamptz DEFAULT now()
);
```

- [ ] **Step 2: Apply it to the local dev database**

This project has no migration runner — `schema.sql` is applied once and changes are run by hand against the running Postgres instance. Run:

```bash
"/c/Program Files/PostgreSQL/18/bin/psql.exe" "$DATABASE_URL" -c "CREATE TABLE user_branding (user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, agency_name text, logo_data bytea, logo_mime text, updated_at timestamptz DEFAULT now());"
```

(Read `DATABASE_URL` from `.env.local` if the shell doesn't have it exported.)

- [ ] **Step 3: Verify**

```bash
"/c/Program Files/PostgreSQL/18/bin/psql.exe" "$DATABASE_URL" -c "\d user_branding"
```
Expected: column list showing `user_id`, `agency_name`, `logo_data`, `logo_mime`, `updated_at`.

- [ ] **Step 4: Commit**

```bash
git add database/schema.sql
git commit -m "feat: add user_branding table"
```

---

## Task 2: Install and verify `@react-pdf/renderer`

**Files:**
- Modify: `package.json`
- Modify: `next.config.ts`
- Create (temporary, deleted in Step 4): `scripts/pdf-smoke-test.mjs`

- [ ] **Step 1: Install**

```bash
npm install @react-pdf/renderer
```

- [ ] **Step 2: Mark it as a server-external package**

`@react-pdf/renderer` ships native/WASM layout dependencies (`yoga-layout`, `fontkit`) that don't bundle cleanly through Turbopack. Edit `next.config.ts`:

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['@react-pdf/renderer'],
  async headers() {
    return [
      {
        source: '/.well-known/apple-developer-merchantid-domain-association',
        headers: [{ key: 'Content-Type', value: 'application/octet-stream' }],
      },
    ]
  },
}

export default nextConfig
```

- [ ] **Step 3: Smoke-test that it actually renders in this Node version**

Create `scripts/pdf-smoke-test.mjs`:

```javascript
import { renderToBuffer, Document, Page, Text } from '@react-pdf/renderer'
import React from 'react'
import { writeFileSync } from 'fs'

const element = React.createElement(
  Document,
  null,
  React.createElement(Page, null, React.createElement(Text, null, 'hello'))
)

const buffer = await renderToBuffer(element)
writeFileSync('smoke-test.pdf', buffer)
console.log('OK bytes=' + buffer.length)
```

Run: `node scripts/pdf-smoke-test.mjs`

Expected: prints `OK bytes=<some number>` and creates `smoke-test.pdf` in the repo root that's a few KB.

**If this fails** with an import error on `renderToBuffer`: open `node_modules/@react-pdf/renderer/package.json` and check the `exports`/`main` field for the actual Node entry, and try `import { pdf } from '@react-pdf/renderer'` with `await pdf(element).toBuffer()` instead. Whichever works, use that API consistently in Task 9.

- [ ] **Step 4: Clean up the smoke test**

```bash
rm scripts/pdf-smoke-test.mjs smoke-test.pdf
```

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json next.config.ts
git commit -m "feat: add @react-pdf/renderer, mark as server-external package"
```

---

## Task 3: `src/lib/branding.ts` — logo validation (TDD)

**Files:**
- Create: `src/lib/branding.ts`
- Test: `src/lib/__tests__/branding.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/branding.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { validateLogo } from '../branding'

describe('validateLogo', () => {
  it('accepts a small PNG', () => {
    const base64 = Buffer.alloc(100, 1).toString('base64')
    expect(validateLogo(base64, 'image/png')).toBeNull()
  })

  it('accepts a small JPG', () => {
    const base64 = Buffer.alloc(100, 1).toString('base64')
    expect(validateLogo(base64, 'image/jpeg')).toBeNull()
  })

  it('rejects unsupported mime types', () => {
    const base64 = Buffer.alloc(100, 1).toString('base64')
    expect(validateLogo(base64, 'image/gif')).toBe('El logo debe ser PNG o JPG.')
  })

  it('rejects logos larger than 1MB', () => {
    const base64 = Buffer.alloc(1024 * 1024 + 1).toString('base64')
    expect(validateLogo(base64, 'image/png')).toBe('El logo debe pesar menos de 1MB.')
  })

  it('accepts a logo exactly at the 1MB limit', () => {
    const base64 = Buffer.alloc(1024 * 1024).toString('base64')
    expect(validateLogo(base64, 'image/png')).toBeNull()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/__tests__/branding.test.ts`
Expected: FAIL — `Cannot find module '../branding'` (or similar).

- [ ] **Step 3: Implement**

Create `src/lib/branding.ts`:

```typescript
export const MAX_LOGO_BYTES = 1024 * 1024
export const ALLOWED_LOGO_MIME_TYPES = ['image/png', 'image/jpeg'] as const

function base64ByteLength(base64: string): number {
  const padding = base64.match(/=+$/)?.[0].length ?? 0
  return Math.floor((base64.length * 3) / 4) - padding
}

export function validateLogo(logoBase64: string, logoMime: string): string | null {
  if (!ALLOWED_LOGO_MIME_TYPES.includes(logoMime as (typeof ALLOWED_LOGO_MIME_TYPES)[number])) {
    return 'El logo debe ser PNG o JPG.'
  }
  if (base64ByteLength(logoBase64) > MAX_LOGO_BYTES) {
    return 'El logo debe pesar menos de 1MB.'
  }
  return null
}

export function buildLogoDataUrl(logoData: Buffer, logoMime: string): string {
  return `data:${logoMime};base64,${logoData.toString('base64')}`
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/lib/__tests__/branding.test.ts`
Expected: PASS, 5/5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/branding.ts src/lib/__tests__/branding.test.ts
git commit -m "feat: add logo validation helpers"
```

---

## Task 4: `GET`/`POST /api/branding`

**Files:**
- Create: `src/app/api/branding/route.ts`

- [ ] **Step 1: Create the file**

```typescript
import type { NextRequest } from 'next/server'
import { pool } from '@/lib/db'
import { verifyToken } from '@/lib/auth-server'
import { validateLogo, buildLogoDataUrl } from '@/lib/branding'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') ?? ''
  const payload = verifyToken(token)
  if (!payload) return Response.json({ error: 'No autorizado' }, { status: 401 })

  const { rows } = await pool.query(
    'SELECT agency_name, logo_data, logo_mime FROM user_branding WHERE user_id = $1',
    [payload.sub]
  )
  const row = rows[0]
  if (!row) return Response.json({ agency_name: null, logo: null })

  const logo = row.logo_data && row.logo_mime ? buildLogoDataUrl(row.logo_data, row.logo_mime) : null
  return Response.json({ agency_name: row.agency_name, logo })
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') ?? ''
  const payload = verifyToken(token)
  if (!payload) return Response.json({ error: 'No autorizado' }, { status: 401 })

  let agencyName: string
  let logoBase64: string | null
  let logoMime: string | null
  try {
    const body = await req.json()
    agencyName = body.agency_name ?? ''
    logoBase64 = body.logo_base64 ?? null
    logoMime = body.logo_mime ?? null
  } catch {
    return Response.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }

  if (logoBase64 && logoMime) {
    const error = validateLogo(logoBase64, logoMime)
    if (error) return Response.json({ error }, { status: 400 })
  }

  const logoBuffer = logoBase64 ? Buffer.from(logoBase64, 'base64') : null

  await pool.query(
    `INSERT INTO user_branding (user_id, agency_name, logo_data, logo_mime, updated_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (user_id) DO UPDATE SET
       agency_name = $2, logo_data = $3, logo_mime = $4, updated_at = now()`,
    [payload.sub, agencyName, logoBuffer, logoMime]
  )

  return Response.json({ ok: true })
}
```

Note: the client (Task 10) always resends the full current state (existing logo, newly picked logo, or `null` if removed) — `POST` always fully replaces the row, it never does a partial update. This is what keeps this handler simple.

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/branding/route.ts
git commit -m "feat: add GET/POST /api/branding"
```

---

## Task 5: `src/lib/download-pdf.ts` — shared client-side download helper

**Files:**
- Create: `src/lib/download-pdf.ts`

- [ ] **Step 1: Create the file**

```typescript
import type { AppMode, AnalysisResult, AgencyLeadsResult } from '@/types/analysis'

type DownloadPdfPayload = {
  mode: AppMode
  city: string
  business_type: string | null
  result: AnalysisResult | AgencyLeadsResult
}

export async function downloadPdf(
  payload: DownloadPdfPayload,
  token: string | undefined
): Promise<{ error?: string }> {
  const res = await fetch('/api/export/pdf', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: data.error ?? 'No se pudo generar el PDF, intenta de nuevo.' }
  }

  const blob = await res.blob()
  const disposition = res.headers.get('content-disposition') ?? ''
  const match = disposition.match(/filename="([^"]+)"/)
  const filename = match?.[1] ?? 'opplify-export.pdf'

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 100)

  return {}
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/download-pdf.ts
git commit -m "feat: add shared PDF download helper"
```

---

## Task 6: `src/lib/pdf/validate-result.ts` (TDD)

**Files:**
- Create: `src/lib/pdf/validate-result.ts`
- Test: `src/lib/__tests__/validate-result.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/validate-result.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { validateResultForMode } from '../pdf/validate-result'

describe('validateResultForMode', () => {
  it('accepts a valid market_research result', () => {
    const result = { market: {}, opportunities: [], pain_points: [] }
    expect(validateResultForMode('market_research', result)).toBeNull()
  })

  it('rejects a market_research result missing market', () => {
    const result = { opportunities: [], pain_points: [] }
    expect(validateResultForMode('market_research', result)).toBe('Resultado de análisis inválido.')
  })

  it('accepts a valid agency_leads result', () => {
    const result = { leads: [] }
    expect(validateResultForMode('agency_leads', result)).toBeNull()
  })

  it('rejects an agency_leads result without a leads array', () => {
    const result = { leads: 'not-an-array' }
    expect(validateResultForMode('agency_leads', result)).toBe('Resultado de análisis inválido.')
  })

  it('rejects null', () => {
    expect(validateResultForMode('market_research', null)).toBe('Resultado de análisis inválido.')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/__tests__/validate-result.test.ts`
Expected: FAIL — `Cannot find module '../pdf/validate-result'`.

- [ ] **Step 3: Implement**

Create `src/lib/pdf/validate-result.ts`:

```typescript
import type { AppMode } from '@/types/analysis'

export function validateResultForMode(mode: AppMode, result: unknown): string | null {
  if (!result || typeof result !== 'object') {
    return 'Resultado de análisis inválido.'
  }
  const r = result as Record<string, unknown>

  if (mode === 'agency_leads') {
    return Array.isArray(r.leads) ? null : 'Resultado de análisis inválido.'
  }

  const hasMarket = typeof r.market === 'object' && r.market !== null
  const hasOpportunities = Array.isArray(r.opportunities)
  const hasPainPoints = Array.isArray(r.pain_points)
  return hasMarket && hasOpportunities && hasPainPoints ? null : 'Resultado de análisis inválido.'
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/lib/__tests__/validate-result.test.ts`
Expected: PASS, 5/5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pdf/validate-result.ts src/lib/__tests__/validate-result.test.ts
git commit -m "feat: add PDF export result validation"
```

---

## Task 7: PDF color constants

**Files:**
- Create: `src/lib/pdf/colors.ts`

- [ ] **Step 1: Create the file**

Values taken from `DESIGN.md` (the app's own design tokens), since `@react-pdf/renderer` styles can't read CSS custom properties:

```typescript
export const PDF_COLORS = {
  border: '#1a1a35',
  mutedForeground: '#64748b',
  primary: '#0891b2',
  amber: '#d97706',
  rose: '#e11d48',
  bodyText: '#334155',
} as const
```

Note: these are darker/more saturated than the app's dark-theme accents (`#22d3ee` cyan, `#fbbf24` amber, `#fb7185` rose) because the PDF page background is white, not `#06060f` — the on-screen colors would have poor contrast on white paper.

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/pdf/colors.ts
git commit -m "feat: add PDF color constants"
```

---

## Task 8: Market research PDF template

**Files:**
- Create: `src/lib/pdf/market-research-template.tsx`

- [ ] **Step 1: Create the file**

```tsx
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import type { AnalysisResult } from '@/types/analysis'
import { PDF_COLORS } from './colors'

const styles = StyleSheet.create({
  page: { backgroundColor: '#ffffff', color: '#0f172a', padding: 32, fontSize: 10 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: PDF_COLORS.border,
    paddingBottom: 12,
  },
  logo: { width: 32, height: 32, objectFit: 'contain' },
  agencyName: { fontSize: 14, fontWeight: 700 },
  cityLine: { fontSize: 9, color: PDF_COLORS.mutedForeground, marginTop: 2 },
  sectionLabel: {
    fontSize: 8,
    color: PDF_COLORS.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
    marginTop: 14,
  },
  card: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 6, padding: 12 },
  summaryText: { fontSize: 10, lineHeight: 1.5 },
  scoreRow: { flexDirection: 'row', gap: 16 },
  scoreBox: { flex: 1, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 6, padding: 12 },
  scoreValue: { fontSize: 24, fontWeight: 700 },
  scoreLabel: { fontSize: 8, color: PDF_COLORS.mutedForeground, marginTop: 4 },
  rowItem: { borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingVertical: 8 },
  rowItemLast: { paddingVertical: 8 },
  rowTitle: { fontSize: 10, fontWeight: 700, marginBottom: 2 },
  rowDescription: { fontSize: 9, color: PDF_COLORS.bodyText },
})

function scoreColor(score: number): string {
  if (score >= 70) return PDF_COLORS.primary
  if (score >= 40) return PDF_COLORS.amber
  return PDF_COLORS.rose
}

const SATURATION_LABELS: Record<string, string> = {
  bajo: 'Bajo',
  medio: 'Medio',
  alto: 'Alto',
  saturado: 'Saturado',
}

const FREQ_LABEL: Record<string, string> = {
  alta: 'Alta',
  media: 'Media',
  baja: 'Baja',
}

type Props = {
  result: AnalysisResult
  city: string
  businessType: string | null
  agencyName: string | null
  logoDataUrl: string | null
}

export function MarketResearchPdf({ result, city, businessType, agencyName, logoDataUrl }: Props) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          {logoDataUrl && <Image src={logoDataUrl} style={styles.logo} />}
          <View>
            <Text style={styles.agencyName}>{agencyName || 'Opplify.ai'}</Text>
            <Text style={styles.cityLine}>
              {city}{businessType ? ` · ${businessType}` : ''}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Resumen ejecutivo</Text>
        <View style={styles.card}>
          <Text style={styles.summaryText}>{result.executive_summary}</Text>
        </View>

        <View style={[styles.scoreRow, { marginTop: 14 }]}>
          <View style={styles.scoreBox}>
            <Text style={[styles.scoreValue, { color: scoreColor(result.opportunity_score) }]}>
              {result.opportunity_score}/100
            </Text>
            <Text style={styles.scoreLabel}>{result.opportunity_label}</Text>
          </View>
          <View style={styles.scoreBox}>
            <Text style={styles.scoreValue}>
              {SATURATION_LABELS[result.market.saturation_level] ?? result.market.saturation_level}
            </Text>
            <Text style={styles.scoreLabel}>
              {result.market.total_businesses_analyzed} negocios · {result.market.avg_rating}★ promedio
            </Text>
          </View>
        </View>

        {result.opportunities.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Oportunidades detectadas ({result.opportunities.length})</Text>
            <View style={styles.card}>
              {result.opportunities.map((op, i) => (
                <View
                  key={`${op.title}-${i}`}
                  style={i === result.opportunities.length - 1 ? styles.rowItemLast : styles.rowItem}
                >
                  <Text style={styles.rowTitle}>{op.opportunity_score} · {op.title}</Text>
                  <Text style={styles.rowDescription}>{op.description}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {result.pain_points.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Puntos débiles del mercado ({result.pain_points.length})</Text>
            <View style={styles.card}>
              {result.pain_points.map((pp, i) => (
                <View
                  key={`${pp.issue}-${i}`}
                  style={i === result.pain_points.length - 1 ? styles.rowItemLast : styles.rowItem}
                >
                  <Text style={styles.rowTitle}>
                    {FREQ_LABEL[pp.frequency] ?? pp.frequency} · {pp.issue}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}
      </Page>
    </Document>
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
git add src/lib/pdf/market-research-template.tsx
git commit -m "feat: add market research PDF template"
```

---

## Task 9: Agency leads PDF template

**Files:**
- Create: `src/lib/pdf/agency-leads-template.tsx`

- [ ] **Step 1: Create the file**

```tsx
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import type { AgencyLeadsResult, AgencyService } from '@/types/analysis'
import { PDF_COLORS } from './colors'

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

const styles = StyleSheet.create({
  page: { backgroundColor: '#ffffff', color: '#0f172a', padding: 32, fontSize: 10 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: PDF_COLORS.border,
    paddingBottom: 12,
  },
  logo: { width: 32, height: 32, objectFit: 'contain' },
  agencyName: { fontSize: 14, fontWeight: 700 },
  cityLine: { fontSize: 9, color: PDF_COLORS.mutedForeground, marginTop: 2 },
  sectionLabel: {
    fontSize: 8,
    color: PDF_COLORS.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  leadCard: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 6, padding: 10, marginBottom: 8 },
  leadHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  leadName: { fontSize: 11, fontWeight: 700 },
  leadScore: { fontSize: 11, fontWeight: 700 },
  leadMeta: { fontSize: 8, color: PDF_COLORS.mutedForeground, marginBottom: 4 },
  leadServices: { fontSize: 8, color: PDF_COLORS.bodyText },
})

function scoreColor(score: number): string {
  if (score >= 70) return PDF_COLORS.primary
  if (score >= 40) return PDF_COLORS.amber
  return PDF_COLORS.rose
}

type Props = {
  result: AgencyLeadsResult
  city: string
  businessType: string | null
  agencyName: string | null
  logoDataUrl: string | null
}

export function AgencyLeadsPdf({ result, city, businessType, agencyName, logoDataUrl }: Props) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          {logoDataUrl && <Image src={logoDataUrl} style={styles.logo} />}
          <View>
            <Text style={styles.agencyName}>{agencyName || 'Opplify.ai'}</Text>
            <Text style={styles.cityLine}>
              {city}{businessType ? ` · ${businessType}` : ''}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Leads detectados ({result.leads.length})</Text>
        {result.leads.map((lead, i) => (
          <View key={`${lead.business_name}-${i}`} style={styles.leadCard}>
            <View style={styles.leadHeader}>
              <Text style={styles.leadName}>{lead.business_name}</Text>
              <Text style={[styles.leadScore, { color: scoreColor(lead.lead_score) }]}>{lead.lead_score}</Text>
            </View>
            <Text style={styles.leadMeta}>
              {lead.address} · {lead.rating > 0 ? `${lead.rating}★ (${lead.review_count})` : 'Sin rating'}
            </Text>
            {lead.recommended_services.length > 0 && (
              <Text style={styles.leadServices}>
                {lead.recommended_services.map((s) => SERVICE_LABEL[s] ?? s).join(' · ')}
              </Text>
            )}
          </View>
        ))}
      </Page>
    </Document>
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
git add src/lib/pdf/agency-leads-template.tsx
git commit -m "feat: add agency leads PDF template"
```

---

## Task 10: `POST /api/export/pdf`

**Files:**
- Create: `src/app/api/export/pdf/route.tsx` (note `.tsx` — this route returns JSX, so it can't be `route.ts`)

- [ ] **Step 1: Create the file**

```tsx
import type { NextRequest } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { pool } from '@/lib/db'
import { verifyToken } from '@/lib/auth-server'
import { buildLogoDataUrl } from '@/lib/branding'
import { validateResultForMode } from '@/lib/pdf/validate-result'
import { MarketResearchPdf } from '@/lib/pdf/market-research-template'
import { AgencyLeadsPdf } from '@/lib/pdf/agency-leads-template'
import type { AppMode, AnalysisResult, AgencyLeadsResult } from '@/types/analysis'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') ?? ''
  const payload = verifyToken(token)
  if (!payload) return Response.json({ error: 'No autorizado' }, { status: 401 })

  let mode: AppMode
  let city: string
  let businessType: string | null
  let result: unknown
  try {
    const body = await req.json()
    mode = body.mode === 'agency_leads' ? 'agency_leads' : 'market_research'
    city = body.city ?? ''
    businessType = body.business_type ?? null
    result = body.result
  } catch {
    return Response.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }

  const validationError = validateResultForMode(mode, result)
  if (validationError) return Response.json({ error: validationError }, { status: 400 })

  const { rows } = await pool.query(
    'SELECT agency_name, logo_data, logo_mime FROM user_branding WHERE user_id = $1',
    [payload.sub]
  )
  const branding = rows[0]
  const agencyName: string | null = branding?.agency_name ?? null
  const logoDataUrl =
    branding?.logo_data && branding?.logo_mime ? buildLogoDataUrl(branding.logo_data, branding.logo_mime) : null

  try {
    const document =
      mode === 'agency_leads' ? (
        <AgencyLeadsPdf
          result={result as AgencyLeadsResult}
          city={city}
          businessType={businessType}
          agencyName={agencyName}
          logoDataUrl={logoDataUrl}
        />
      ) : (
        <MarketResearchPdf
          result={result as AnalysisResult}
          city={city}
          businessType={businessType}
          agencyName={agencyName}
          logoDataUrl={logoDataUrl}
        />
      )

    const buffer = await renderToBuffer(document)
    const slug = city.toLowerCase().replace(/\s+/g, '-')

    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="opplify-${slug}-${mode}.pdf"`,
      },
    })
  } catch (err) {
    console.error('[export/pdf] generation failed:', err)
    return Response.json({ error: 'No se pudo generar el PDF, intenta de nuevo.' }, { status: 500 })
  }
}
```

If Task 2's smoke test required the `pdf().toBuffer()` fallback API instead of `renderToBuffer`, use that same API here instead.

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/export/pdf/route.tsx
git commit -m "feat: add POST /api/export/pdf"
```

---

## Task 11: `/ajustes` page

**Files:**
- Create: `src/app/ajustes/page.tsx`

- [ ] **Step 1: Create the file**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { authClient } from '@/lib/auth-client'
import { useAuth } from '@/hooks/useAuth'
import { ThemeSwitcher } from '@/components/ThemeSwitcher'
import { CreditsBadge } from '@/components/CreditsBadge'

const INPUT_CLASS =
  'w-full px-3 py-2.5 rounded-lg border border-border bg-input text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 transition-colors'

function splitDataUrl(dataUrl: string): { mime: string; base64: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) return null
  return { mime: match[1], base64: match[2] }
}

export default function AjustesPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [agencyName, setAgencyName] = useState('')
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace('/auth/login?redirect=/ajustes')
      return
    }

    authClient
      .getSession()
      .then(({ data: sessionData }) => {
        const token = sessionData.session?.access_token
        return fetch('/api/branding', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
      })
      .then(async (res) => {
        const data = await res.json()
        setAgencyName(data.agency_name ?? '')
        setLogoDataUrl(data.logo ?? null)
        setLoading(false)
      })
      .catch(() => {
        setLoading(false)
      })
  }, [user, authLoading, router])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setLogoDataUrl(reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaveStatus('saving')
    setErrorMsg('')

    const split = logoDataUrl ? splitDataUrl(logoDataUrl) : null
    const { data: sessionData } = await authClient.getSession()
    const token = sessionData.session?.access_token

    const res = await fetch('/api/branding', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        agency_name: agencyName,
        logo_base64: split?.base64 ?? null,
        logo_mime: split?.mime ?? null,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      setErrorMsg(data.error ?? 'Error al guardar')
      setSaveStatus('error')
    } else {
      setSaveStatus('saved')
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-background" />
  }

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="font-heading font-bold text-sm tracking-tight hover:text-primary transition-colors">
            Opplify<span className="text-primary">.</span>ai
          </Link>
          <div className="flex items-center gap-3">
            <ThemeSwitcher />
            <Link href="/historial" className="text-xs text-muted-foreground hover:text-foreground transition-colors hidden sm:block">
              Historial
            </Link>
            <CreditsBadge />
          </div>
        </div>
      </div>

      <div className="max-w-sm mx-auto px-6 py-10">
        <h1 className="font-heading font-bold text-2xl tracking-tight mb-1" style={{ letterSpacing: '-0.02em' }}>
          Ajustes de marca
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          Tu logo y nombre de agencia aparecerán en los PDFs que exportes.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              Nombre de agencia
            </label>
            <input
              type="text"
              value={agencyName}
              onChange={(e) => setAgencyName(e.target.value)}
              placeholder="Mi Agencia Digital"
              className={INPUT_CLASS}
            />
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              Logo (PNG o JPG, máx. 1MB)
            </label>
            {logoDataUrl && (
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoDataUrl} alt="Logo actual" className="h-12 w-12 object-contain rounded border border-border" />
                <button
                  type="button"
                  onClick={() => setLogoDataUrl(null)}
                  className="text-xs text-rose-400 hover:text-rose-300 transition-colors"
                >
                  Quitar logo
                </button>
              </div>
            )}
            <input type="file" accept="image/png,image/jpeg" onChange={handleFileChange} className={INPUT_CLASS} />
          </div>

          {errorMsg && <p className="text-xs text-rose-400">{errorMsg}</p>}
          {saveStatus === 'saved' && <p className="text-xs text-primary">Guardado correctamente.</p>}

          <button
            type="submit"
            disabled={saveStatus === 'saving'}
            className="btn-press w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {saveStatus === 'saving' ? 'Guardando...' : 'Guardar'}
          </button>
        </form>
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
git add src/app/ajustes/page.tsx
git commit -m "feat: add /ajustes branding settings page"
```

---

## Task 12: Add "Ajustes" nav link everywhere "Historial" appears

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/historial/page.tsx`
- Modify: `src/components/results/ResultsDashboard.tsx`

- [ ] **Step 1: `src/app/page.tsx`**

Find:
```tsx
            {user && (
              <Link
                href="/historial"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors hidden sm:block"
              >
                Historial
              </Link>
            )}
```
Replace with:
```tsx
            {user && (
              <>
                <Link
                  href="/ajustes"
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors hidden sm:block"
                >
                  Ajustes
                </Link>
                <Link
                  href="/historial"
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors hidden sm:block"
                >
                  Historial
                </Link>
              </>
            )}
```

- [ ] **Step 2: `src/app/historial/page.tsx`**

Find the nav `<div className="flex items-center gap-3">` block (it has `ThemeSwitcher`, a "Nueva búsqueda" link, `CreditsBadge`, email pill, "Salir"). Add an "Ajustes" link right after `<ThemeSwitcher />`:

Find:
```tsx
          <div className="flex items-center gap-3">
            <ThemeSwitcher />
            <Link href="/buscar" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Nueva búsqueda
            </Link>
```
Replace with:
```tsx
          <div className="flex items-center gap-3">
            <ThemeSwitcher />
            <Link href="/ajustes" className="text-xs text-muted-foreground hover:text-foreground transition-colors hidden sm:block">
              Ajustes
            </Link>
            <Link href="/buscar" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Nueva búsqueda
            </Link>
```

- [ ] **Step 3: `src/components/results/ResultsDashboard.tsx`**

Find:
```tsx
          <ThemeSwitcher />
          <Link
            href="/historial"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors hidden sm:block"
          >
            Historial
          </Link>
```
Replace with:
```tsx
          <ThemeSwitcher />
          <Link
            href="/ajustes"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors hidden sm:block"
          >
            Ajustes
          </Link>
          <Link
            href="/historial"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors hidden sm:block"
          >
            Historial
          </Link>
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx src/app/historial/page.tsx src/components/results/ResultsDashboard.tsx
git commit -m "feat: add Ajustes link to navbars"
```

---

## Task 13: "Exportar PDF" for `market_research` mode

**Files:**
- Modify: `src/components/results/AnalysisStream.tsx`
- Modify: `src/components/results/ResultsDashboard.tsx`

- [ ] **Step 1: Pass `city`/`businessType` into `AnalysisStream`**

In `src/components/results/ResultsDashboard.tsx`, find:
```tsx
        ) : (
          <AnalysisStream state={state} />
        )}
```
Replace with:
```tsx
        ) : (
          <AnalysisStream state={state} city={city} businessType={businessType} />
        )}
```

- [ ] **Step 2: Add the button to `AnalysisStream.tsx`**

Find the top of `src/components/results/AnalysisStream.tsx`:
```tsx
import { ExecutiveSummary } from './ExecutiveSummary'
import { OpportunityScore } from './OpportunityScore'
import { MarketSaturation } from './MarketSaturation'
import { OpportunityList } from './OpportunityList'
import { PainPoints } from './PainPoints'
import type { StreamState, AnalysisResult } from '@/types/analysis'

type Props = { state: StreamState }

export function AnalysisStream({ state }: Props) {
  const { phase, summary, result: rawResult, error } = state
  const result = rawResult as AnalysisResult | null

  if (phase === 'idle') return null
```
Replace with:
```tsx
'use client'

import { useState } from 'react'
import { ExecutiveSummary } from './ExecutiveSummary'
import { OpportunityScore } from './OpportunityScore'
import { MarketSaturation } from './MarketSaturation'
import { OpportunityList } from './OpportunityList'
import { PainPoints } from './PainPoints'
import { authClient } from '@/lib/auth-client'
import { downloadPdf } from '@/lib/download-pdf'
import type { StreamState, AnalysisResult } from '@/types/analysis'

type Props = { state: StreamState; city: string; businessType: string }

export function AnalysisStream({ state, city, businessType }: Props) {
  const { phase, summary, result: rawResult, error } = state
  const result = rawResult as AnalysisResult | null
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')

  const handleExportPdf = async () => {
    if (!result) return
    setExporting(true)
    setExportError('')
    const { data: sessionData } = await authClient.getSession()
    const token = sessionData.session?.access_token
    const { error: err } = await downloadPdf(
      { mode: 'market_research', city, business_type: businessType || null, result },
      token
    )
    if (err) setExportError(err)
    setExporting(false)
  }

  if (phase === 'idle') return null
```

- [ ] **Step 3: Render the button when the result is complete**

Find (the `return` for the complete/streaming state — right after the `streaming_json` skeleton block, before `{summary && (`):
```tsx
  return (
    <div className="space-y-6">
      {summary && (
```
Replace with:
```tsx
  return (
    <div className="space-y-6">
      {phase === 'complete' && result && (
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={handleExportPdf}
            disabled={exporting}
            className="text-xs font-medium text-primary hover:text-primary/80 border border-primary/30 hover:border-primary/60 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
          >
            {exporting ? 'Generando...' : 'Exportar PDF →'}
          </button>
        </div>
      )}
      {exportError && <p className="text-xs text-rose-400">{exportError}</p>}
      {summary && (
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/results/AnalysisStream.tsx src/components/results/ResultsDashboard.tsx
git commit -m "feat: add Exportar PDF button to market research results"
```

---

## Task 14: "Exportar PDF" for `agency_leads` mode

**Files:**
- Modify: `src/components/results/AgencyLeadsList.tsx`
- Modify: `src/components/results/AgencyLeadsStream.tsx`

- [ ] **Step 1: Forward `businessType` from `AgencyLeadsStream` to `AgencyLeadsList`**

In `src/components/results/AgencyLeadsStream.tsx`, find:
```tsx
        <AgencyLeadsList
          leads={[...accumulatedLeads].sort((a, b) => b.lead_score - a.lead_score)}
          onLoadMore={canLoadMore ? handleLoadMore : undefined}
          loadingMore={loadingMore}
          city={city}
        />
```
Replace with:
```tsx
        <AgencyLeadsList
          leads={[...accumulatedLeads].sort((a, b) => b.lead_score - a.lead_score)}
          onLoadMore={canLoadMore ? handleLoadMore : undefined}
          loadingMore={loadingMore}
          city={city}
          businessType={businessType}
        />
```

- [ ] **Step 2: Add the `businessType` prop and PDF export to `AgencyLeadsList.tsx`**

Find the top of `src/components/results/AgencyLeadsList.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { AgencyLeadCard } from './AgencyLeadCard'
import { exportLeadsToCSV } from '@/lib/export-csv'
import type { AgencyLead } from '@/types/analysis'

const PAGE_SIZE = 10

type Props = {
  leads: AgencyLead[]
  onLoadMore?: () => void
  loadingMore?: boolean
  city?: string
  exportDate?: string
}

export function AgencyLeadsList({ leads, onLoadMore, loadingMore, city, exportDate }: Props) {
  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? leads : leads.slice(0, PAGE_SIZE)
  const remaining = leads.length - PAGE_SIZE

  const handleExport = () => {
```
Replace with:
```tsx
'use client'

import { useState } from 'react'
import { AgencyLeadCard } from './AgencyLeadCard'
import { exportLeadsToCSV } from '@/lib/export-csv'
import { authClient } from '@/lib/auth-client'
import { downloadPdf } from '@/lib/download-pdf'
import type { AgencyLead, AgencyLeadsResult } from '@/types/analysis'

const PAGE_SIZE = 10

type Props = {
  leads: AgencyLead[]
  onLoadMore?: () => void
  loadingMore?: boolean
  city?: string
  businessType?: string
  exportDate?: string
}

export function AgencyLeadsList({ leads, onLoadMore, loadingMore, city, businessType, exportDate }: Props) {
  const [showAll, setShowAll] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [pdfError, setPdfError] = useState('')
  const visible = showAll ? leads : leads.slice(0, PAGE_SIZE)
  const remaining = leads.length - PAGE_SIZE

  const handleExportPdf = async () => {
    setExportingPdf(true)
    setPdfError('')
    const { data: sessionData } = await authClient.getSession()
    const token = sessionData.session?.access_token
    const result: AgencyLeadsResult = {
      leads,
      total_analyzed: leads.length,
      generated_at: new Date().toISOString(),
      model_used: '',
    }
    const { error } = await downloadPdf(
      { mode: 'agency_leads', city: city ?? '', business_type: businessType ?? null, result },
      token
    )
    if (error) setPdfError(error)
    setExportingPdf(false)
  }

  const handleExport = () => {
```

- [ ] **Step 3: Render the PDF button next to the CSV button**

Find:
```tsx
        {leads.length > 0 && (
          <button
            onClick={handleExport}
            className="text-xs font-medium text-primary hover:text-primary/80 border border-primary/30 hover:border-primary/60 px-3 py-1.5 rounded-lg transition-colors"
          >
            Exportar CSV →
          </button>
        )}
      </div>
```
Replace with:
```tsx
        {leads.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportPdf}
              disabled={exportingPdf}
              className="text-xs font-medium text-primary hover:text-primary/80 border border-primary/30 hover:border-primary/60 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
            >
              {exportingPdf ? 'Generando...' : 'Exportar PDF →'}
            </button>
            <button
              onClick={handleExport}
              className="text-xs font-medium text-primary hover:text-primary/80 border border-primary/30 hover:border-primary/60 px-3 py-1.5 rounded-lg transition-colors"
            >
              Exportar CSV →
            </button>
          </div>
        )}
      </div>
      {pdfError && <p className="text-xs text-rose-400">{pdfError}</p>}
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/results/AgencyLeadsList.tsx src/components/results/AgencyLeadsStream.tsx
git commit -m "feat: add Exportar PDF button to agency leads results"
```

---

## Task 15: Verify everything end-to-end

- [ ] **Step 1: Full test suite + build**

```bash
npm test
npx tsc --noEmit
npm run build
```
Expected: all pass, build succeeds.

- [ ] **Step 2: Start dev server**

```bash
npm run dev
```

- [ ] **Step 3: Save branding**

Log in, go to `/ajustes`, set an agency name and upload a small PNG/JPG logo, click Guardar. Expected: "Guardado correctamente." Reload the page — name and logo preview should still be there (proves `GET /api/branding` round-trips correctly).

- [ ] **Step 4: Export a market_research PDF**

Run a market research search to completion. Click "Exportar PDF →". Expected: a PDF downloads, opens correctly, shows the agency name/logo in the header and the executive summary/score/opportunities/pain points sections.

- [ ] **Step 5: Export an agency_leads PDF**

Run a leads search to completion (optionally click "Cargar más" once first). Click "Exportar PDF →" next to "Exportar CSV →". Expected: a PDF downloads with one row per lead, including the ones loaded via "Cargar más".

- [ ] **Step 6: Verify branding persists without a logo**

In `/ajustes`, click "Quitar logo", save. Export another PDF. Expected: PDF generates fine with no logo image and "Opplify.ai" or the agency name as header text (no broken image, no error).

- [ ] **Step 7: Clean up test data**

```bash
"/c/Program Files/PostgreSQL/18/bin/psql.exe" "$DATABASE_URL" -c "DELETE FROM user_branding WHERE user_id = '<test user id used above>';"
```
(Skip this step if testing was done on the real account and the branding should be kept.)
