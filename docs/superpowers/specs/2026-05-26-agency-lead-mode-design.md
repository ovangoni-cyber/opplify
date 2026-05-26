# Agency Lead Mode — Design Spec

**Date:** 2026-05-26  
**Status:** Approved

## Overview

Add a second analysis mode to the platform: **Agency Lead Mode**. Instead of detecting market opportunities for new businesses, this mode analyzes existing businesses as potential agency clients — scoring them by how likely they are to need services like SEO, automation, chatbot, branding, or web redesign.

The platform gains a toggle on the home page. Both modes share the same Google Places pipeline, same API endpoint, and same cache infrastructure. Only the Claude prompt and result schema differ.

---

## Architecture

### Shared infrastructure (unchanged)
- `POST /api/analyze` handles both modes
- Google Places fetch is identical for both modes
- Supabase cache stores results per `(cache_key, mode)` pair

### Mode routing
- `SearchParams` gains a `mode: AppMode` field
- `mode` flows as a query param: `/results?city=Madrid&business_type=gym&mode=agency_leads`
- `streamAnalysis()` in `claude.ts` receives `mode` and selects the appropriate prompt
- `ResultsDashboard` reads `mode` from query params and renders either `AnalysisStream` or `AgencyLeadsStream`

### Cache migration
New column in `analyses` table:
```sql
ALTER TABLE analyses ADD COLUMN mode text NOT NULL DEFAULT 'market_research';
DROP INDEX idx_analyses_cache_lookup;
CREATE INDEX idx_analyses_cache_lookup ON analyses (cache_key, mode, created_at desc);
```
Cache lookup filters by both `cache_key` and `mode`.

---

## Types

```typescript
export type AppMode = 'market_research' | 'agency_leads'

export type AgencyService =
  | 'seo' | 'ai_automation' | 'chatbot' | 'branding'
  | 'ads' | 'web_redesign' | 'crm' | 'reputation'

export type AgencyLead = {
  business_name: string
  address: string
  rating: number
  review_count: number
  lead_score: number           // 0-100, higher = better prospect
  pain_points: string[]        // specific detected problems
  recommended_services: AgencyService[]
  summary: string              // AI-generated business profile
  pitch: string                // AI-generated sales argument
}

export type AgencyLeadsResult = {
  leads: AgencyLead[]          // all leads, ordered by lead_score desc
  total_analyzed: number
  generated_at: string
  model_used: string
}
```

`SearchParams` updated:
```typescript
export type SearchParams = {
  city: string
  business_type: string
  mode: AppMode
}
```

---

## Claude Prompt — Agency Lead Mode

The prompt instructs Claude to:
1. Write a 1-2 paragraph executive summary of the agency opportunity landscape in that city/sector
2. Emit `---JSON---`
3. Return `AgencyLeadsResult` JSON with all businesses evaluated as leads, ordered by `lead_score` descending

Scoring signals Claude uses per business:
- Low rating (< 3.5★) → reputation issues
- Low review count relative to competitors → weak online presence
- Negative review themes (wait times, no booking, poor response) → automation/chatbot gaps
- No response to reviews → reputation management need
- Generic or missing business description → branding/SEO opportunity

`max_tokens` stays at 8192 — Agency Lead JSON for 40 businesses is larger than Market Research JSON.

---

## UI

### Home page
- `ModeToggle` component: two tab-style buttons above the search form
  - "Investigar mercado" (market_research)
  - "Buscar leads" (agency_leads)
- Selected mode is stored in component state and appended to the query string on submit

### Results page — Agency Lead Mode
- Same header (city + business type + "Nueva búsqueda" button)
- Streaming summary text while Claude generates
- Once JSON arrives: `AgencyLeadsList` renders the leads
- Top 10 leads shown by default; "Ver X más" button expands the rest
- Each `AgencyLeadCard` shows:
  - Business name, address, rating, review count
  - `lead_score` prominently (large number or colored badge)
  - Pain points as a bullet list
  - Recommended services as colored badges (one color per service type)
  - Pitch (italicized, highlighted box)

### New components
| Component | Responsibility |
|-----------|---------------|
| `ModeToggle` | Tab switcher on home page |
| `AgencyLeadsList` | List with show/hide logic for leads beyond top 10 |
| `AgencyLeadCard` | Individual lead card |

---

## Data Flow

```
Browser (mode toggle selected)
  → POST /api/analyze { city, business_type, mode }
      ├─ Cache check (cache_key + mode)
      ├─ Google Places fetch (unchanged)
      ├─ Claude: agency leads prompt
      │    streams: [summary text] ---JSON--- [AgencyLeadsResult]
      └─ Fire-and-forget save (includes mode column)
  → useAnalysisStream (unchanged — detects ---JSON--- delimiter)
  → AgencyLeadsList + AgencyLeadCard render
```

---

## Out of Scope (MVP)

- Additional data sources (Reddit, Instagram, LinkedIn, etc.) — architecture is mode-based and extensible, but only Google Places for now
- Exporting leads (CSV, PDF)
- Saving/favoriting leads
- Per-business detail page
