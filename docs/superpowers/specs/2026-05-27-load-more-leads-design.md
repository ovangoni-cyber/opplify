# Load More Leads — Design Spec

**Date:** 2026-05-27
**Status:** Approved

## Overview

Add a "Cargar más leads" button to Agency Lead Mode that fetches a second (and subsequent) batch of leads different from those already shown. The frontend tracks which businesses have been seen and passes them as exclusions to the API, which filters them before analysis.

---

## Architecture

### Backend changes

**`SearchParams`** gains an optional field:
```typescript
exclude?: string[]  // business_name values already shown to the user
```

**`/api/analyze` route:**
- If `exclude` has items: skip cache lookup entirely (personalized request)
- After `fetchAndNormalizePlaces`, filter out any business whose `name` is in `exclude` (case-insensitive)
- Do not save to cache if `exclude` has items
- Pass the filtered `PlacesContext` to `streamAnalysis` as usual

No changes to `claude.ts`, `analysis-cache.ts`, or `google-places.ts`.

### Frontend changes

**`AgencyLeadsStream`** accumulates leads across calls:
- Local state: `accumulatedLeads: AgencyLead[]`
- When `state.phase === 'complete'` and `result` is `AgencyLeadsResult`: append new leads (deduplicate by `business_name`)
- Passes `accumulatedLeads` to `AgencyLeadsList`
- Passes `() => handleLoadMore()` callback to `AgencyLeadsList`

**`handleLoadMore` in `AgencyLeadsStream`:**
```typescript
const excludeNames = accumulatedLeads.map(l => l.business_name)
analyze({ city, business_type: businessType, mode: 'agency_leads', exclude: excludeNames })
```

`AgencyLeadsStream` needs `city` and `businessType` props (passed from `ResultsDashboard`).

**`AgencyLeadsList`** gains:
- `onLoadMore?: () => void` prop
- `loadingMore?: boolean` prop (shows spinner on button while fetching)
- "Cargar más leads" button at the bottom, disabled/spinner while `loadingMore`

**`ResultsDashboard`** passes `city` and `businessType` down to `AgencyLeadsStream`.

---

## Data Flow

```
User clicks "Cargar más leads"
  → AgencyLeadsStream calls analyze({ city, business_type, mode, exclude: [names already shown] })
  → useAnalysisStream: phase → loading → streaming_json → complete
  → AgencyLeadsStream detects new complete result, appends to accumulatedLeads (dedup by business_name)
  → AgencyLeadsList re-renders with expanded list
  → If fewer than 10 new leads returned, hide "Cargar más" button (no more data)
```

---

## Types

```typescript
// SearchParams updated:
export type SearchParams = {
  city: string
  business_type: string
  mode: AppMode
  exclude?: string[]
}
```

---

## Edge Cases

- **No more leads available**: if the new batch returns 0 leads (all businesses were excluded), hide the "Cargar más" button permanently.
- **Deduplication**: append with dedup by `business_name` in case Claude returns an overlap.
- **Cache**: requests with `exclude` are never cached and never save to cache.
- **Market Research mode**: `exclude` is only used in agency_leads mode — the route ignores it otherwise.

---

## Out of Scope

- Infinite scroll (button click is sufficient)
- Saving accumulated leads between sessions
- Showing how many leads remain available
