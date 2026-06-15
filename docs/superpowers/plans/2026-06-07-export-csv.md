# Export Leads to CSV Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a client-side "Exportar CSV" button to the agency leads list that downloads all leads as a UTF-8 CSV file.

**Architecture:** Pure utility function `exportLeadsToCSV` in `src/lib/export-csv.ts` handles all CSV logic (tested). `AgencyLeadsList` gets two new optional props (`city`, `exportDate`) and renders the button. `AgencyLeadsStream` passes `city` down.

**Tech Stack:** Next.js 16, TypeScript, Vitest (existing test runner), browser Blob/URL APIs

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `src/lib/export-csv.ts` | Pure CSV generation + download trigger |
| Create | `src/lib/__tests__/export-csv.test.ts` | Unit tests for CSV logic |
| Modify | `src/components/results/AgencyLeadsList.tsx` | Add export button + city/exportDate props |
| Modify | `src/components/results/AgencyLeadsStream.tsx` | Pass city prop to AgencyLeadsList |

---

## Task 1: export-csv utility with tests

**Files:**
- Create: `src/lib/export-csv.ts`
- Create: `src/lib/__tests__/export-csv.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/export-csv.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildCsvContent } from '../export-csv'
import type { AgencyLead } from '@/types/analysis'

const baseLead: AgencyLead = {
  business_name: 'La Esquina de Palermo',
  address: 'Av. Santa Fe 3241, Palermo',
  rating: 4.2,
  review_count: 187,
  lead_score: 87,
  pain_points: ['Sin web propia', 'Sin reservas online'],
  recommended_services: ['web_redesign', 'seo'],
  summary: 'Buen restaurante con poca presencia digital.',
  pitch: 'Tu web puede generar reservas automáticas.',
}

describe('buildCsvContent', () => {
  it('includes header row', () => {
    const csv = buildCsvContent([])
    expect(csv).toContain('Nombre,Dirección,Rating,Reseñas,Score,Pain Points,Servicios,Pitch')
  })

  it('renders a lead row with correct values', () => {
    const csv = buildCsvContent([baseLead])
    expect(csv).toContain('La Esquina de Palermo')
    expect(csv).toContain('87')
    expect(csv).toContain('4.2')
    expect(csv).toContain('187')
    expect(csv).toContain('Sin web propia | Sin reservas online')
    expect(csv).toContain('web_redesign | seo')
  })

  it('wraps fields containing commas in double quotes', () => {
    const lead = { ...baseLead, business_name: 'Bar, Café y Más' }
    const csv = buildCsvContent([lead])
    expect(csv).toContain('"Bar, Café y Más"')
  })

  it('escapes double quotes inside fields', () => {
    const lead = { ...baseLead, pitch: 'Decile "hola" a tus clientes.' }
    const csv = buildCsvContent([lead])
    expect(csv).toContain('"Decile ""hola"" a tus clientes."')
  })

  it('returns only header for empty leads array', () => {
    const csv = buildCsvContent([])
    const lines = csv.trim().split('\n')
    expect(lines).toHaveLength(1)
  })

  it('produces one data row per lead', () => {
    const csv = buildCsvContent([baseLead, baseLead])
    const lines = csv.trim().split('\n')
    expect(lines).toHaveLength(3) // header + 2 rows
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/lib/__tests__/export-csv.test.ts
```

Expected: FAIL — `buildCsvContent` not found.

- [ ] **Step 3: Implement `export-csv.ts`**

Create `src/lib/export-csv.ts`:

```ts
import type { AgencyLead } from '@/types/analysis'

function escapeField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return '"' + value.replace(/"/g, '""') + '"'
  }
  return value
}

export function buildCsvContent(leads: AgencyLead[]): string {
  const header = 'Nombre,Dirección,Rating,Reseñas,Score,Pain Points,Servicios,Pitch'
  const rows = leads.map((lead) => [
    escapeField(lead.business_name),
    escapeField(lead.address),
    String(lead.rating),
    String(lead.review_count),
    String(lead.lead_score),
    escapeField(lead.pain_points.join(' | ')),
    escapeField(lead.recommended_services.join(' | ')),
    escapeField(lead.pitch),
  ].join(','))
  return [header, ...rows].join('\n')
}

export function exportLeadsToCSV(leads: AgencyLead[], filename: string): void {
  const bom = '﻿'
  const content = bom + buildCsvContent(leads)
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/lib/__tests__/export-csv.test.ts
```

Expected: all 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/export-csv.ts src/lib/__tests__/export-csv.test.ts
git commit -m "feat: add exportLeadsToCSV utility with tests"
```

---

## Task 2: Export button in AgencyLeadsList

**Files:**
- Modify: `src/components/results/AgencyLeadsList.tsx`
- Modify: `src/components/results/AgencyLeadsStream.tsx`

- [ ] **Step 1: Update AgencyLeadsList with city + exportDate props and export button**

Replace the full contents of `src/components/results/AgencyLeadsList.tsx`:

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
    const date = exportDate ?? new Date().toISOString().slice(0, 10)
    const filename = city
      ? `leads-${city.toLowerCase().replace(/\s+/g, '-')}-${date}.csv`
      : 'leads.csv'
    exportLeadsToCSV(leads, filename)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h3 className="font-heading font-semibold text-base">
          Leads detectados{' '}
          <span className="text-muted-foreground font-normal text-sm">({leads.length})</span>
        </h3>
        {leads.length > 0 && (
          <button
            onClick={handleExport}
            className="text-xs font-medium text-primary hover:text-primary/80 border border-primary/30 hover:border-primary/60 px-3 py-1.5 rounded-lg transition-colors"
          >
            Exportar CSV →
          </button>
        )}
      </div>
      {visible.map((lead, i) => (
        <div
          key={`${lead.business_name}-${i}`}
          className="stagger-item"
          style={{ animationDelay: `${Math.min(i * 50, 400)}ms` }}
        >
          <AgencyLeadCard lead={lead} />
        </div>
      ))}
      {!showAll && remaining > 0 && (
        <button
          onClick={() => setShowAll(true)}
          className="btn-press w-full py-3 rounded-xl border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
        >
          Ver {remaining} leads más
        </button>
      )}
      {onLoadMore && (
        <button
          onClick={onLoadMore}
          disabled={loadingMore}
          className="btn-press w-full py-3 rounded-xl border border-primary/40 text-sm text-primary hover:bg-primary/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loadingMore ? (
            <>
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              Buscando más leads...
            </>
          ) : (
            'Cargar más leads →'
          )}
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Pass city prop from AgencyLeadsStream**

In `src/components/results/AgencyLeadsStream.tsx`, find the `<AgencyLeadsList>` JSX and add the `city` prop:

```tsx
<AgencyLeadsList
  leads={[...accumulatedLeads].sort((a, b) => b.lead_score - a.lead_score)}
  onLoadMore={canLoadMore ? handleLoadMore : undefined}
  loadingMore={loadingMore}
  city={city}
/>
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 4: Run full test suite**

```bash
npm test
```

Expected: all tests pass (the 6 new export-csv tests + existing 22).

- [ ] **Step 5: Commit**

```bash
git add src/components/results/AgencyLeadsList.tsx src/components/results/AgencyLeadsStream.tsx
git commit -m "feat: add Exportar CSV button to agency leads list"
```

---

## Task 3: Verification

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Run an agency leads analysis**

Log in at `http://localhost:3000`, run an analysis in "Leads" mode (any city + business type).

- [ ] **Step 3: Verify button appears**

After the analysis completes, "Exportar CSV →" should appear in the leads list header next to the count.

- [ ] **Step 4: Download and inspect the file**

Click the button. Browser should download `leads-{ciudad}-{fecha}.csv`. Open it in Excel or Google Sheets — verify: 8 columns, correct data, Spanish accents display correctly, pain points separated by ` | `.

- [ ] **Step 5: Load more + export**

Click "Cargar más leads →", wait for more leads. Click "Exportar CSV →" — file should contain ALL leads including the newly loaded ones.
