# Export Leads to CSV Design

**Date:** 2026-06-07  
**Status:** Approved

## Context

After running an agency leads analysis, users have no way to take the lead list into their CRM or outreach tools. Adding a CSV export button gives immediate practical value with zero backend changes.

## Decision

Client-side CSV generation using a pure utility function + a button in `AgencyLeadsList`. No new dependencies, no backend.

## Utility Function

**File:** `src/lib/export-csv.ts`

```ts
export function exportLeadsToCSV(leads: AgencyLead[], filename: string): void
```

**Columns (in order):**
| Column | Source |
|--------|--------|
| Nombre | `business_name` |
| Dirección | `address` |
| Rating | `rating` |
| Reseñas | `review_count` |
| Score | `lead_score` |
| Pain Points | `pain_points.join(' | ')` |
| Servicios | `recommended_services.join(' | ')` |
| Pitch | `pitch` |

**Implementation details:**
- Header row: `Nombre,Dirección,Rating,Reseñas,Score,Pain Points,Servicios,Pitch`
- Each field is escaped: if the value contains a comma, newline, or double-quote, wrap in double quotes and escape internal double quotes by doubling them (`"` → `""`)
- Prepend UTF-8 BOM (`﻿`) so Excel opens the file with correct encoding for Spanish characters
- Build `Blob` with `type: 'text/csv;charset=utf-8;'`
- Create a temporary `<a>` element, set `href` to `URL.createObjectURL(blob)`, set `download` to `filename`, click it, then revoke the object URL

**Filename format:** `leads-{city}-{YYYY-MM-DD}.csv` — passed in by the caller.

## UI: Export Button

**File:** `src/components/results/AgencyLeadsList.tsx`

Add an "Exportar CSV" button in the list header, next to the lead count. Visible only when `leads.length > 0`.

```tsx
<div className="flex items-center justify-between">
  <h3>Leads detectados <span>({leads.length})</span></h3>
  {leads.length > 0 && (
    <button onClick={() => exportLeadsToCSV(leads, `leads-${city}-${date}.csv`)}>
      Exportar CSV
    </button>
  )}
</div>
```

The `AgencyLeadsList` component needs two new optional props: `city?: string` and `exportDate?: string` for the filename. If not provided, fallback filename is `leads.csv`.

Exports ALL leads in the `leads` array — not just the currently visible page.

## Files Changed

| Action | File |
|--------|------|
| Create | `src/lib/export-csv.ts` |
| Modify | `src/components/results/AgencyLeadsList.tsx` |

## Non-goals

- No Excel (.xlsx) format
- No column selection
- No server-side generation
- No progress indicator (exports are instant for ≤100 leads)

## Verification

1. Run an agency leads analysis
2. "Exportar CSV" button appears in the leads list header
3. Click → browser downloads `leads-{ciudad}-{fecha}.csv`
4. Open in Excel/Google Sheets → correct columns, Spanish accents render correctly, arrays separated by ` | `
5. Button exports ALL leads including those loaded via "Cargar más"
6. `npx tsc --noEmit` → no errors
