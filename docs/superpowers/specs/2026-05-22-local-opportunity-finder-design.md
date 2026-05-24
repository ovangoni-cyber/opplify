# Local Opportunity Finder — Design Spec
**Date:** 2026-05-22  
**Status:** Approved

---

## Overview

A web application that detects local business opportunities by analyzing public data and business reviews using AI. The user inputs a city and optional business type; the system fetches real businesses from Google Places, analyzes ratings/reviews/density, and generates actionable market insights via Claude.

---

## Decisions Made During Brainstorming

| Question | Decision | Rationale |
|----------|----------|-----------|
| Response mode | Streaming (sync) | Best UX for 10-30s wait; progressive rendering feels live |
| Businesses per search | 30-60 | Representativo del mercado, costo ~$0.05-0.10/búsqueda |
| Output language | Spanish (always) | Single-locale MVP, no i18n complexity |
| Persistence from Day 1 | Yes (Fase 1) | 24h cache avoids repeat API costs; Fase 2 history is free |

---

## Architecture

### Runtime Choice: Next.js Edge Runtime

The full analysis pipeline runs in a single Next.js API route using Edge Runtime. No Supabase Edge Functions in Fase 1. Supabase is used purely as a database.

**Why Edge Runtime over Node.js:** No timeout limit (vs 10-60s on Vercel Node), native streaming, no extra configuration.

```
Browser → POST /api/analyze (Edge) → Google Places + Claude → Supabase DB
                    ↑
              ReadableStream (streaming response)
```

### Component Responsibilities

| Layer | Responsibility | Does NOT |
|-------|---------------|----------|
| `SearchForm` | Capture city + business type | No business logic |
| `POST /api/analyze` | Orchestrate full pipeline | No rendering |
| Google Places | Raw business data | No analysis |
| Claude | Generate Spanish insights | No knowledge of Places |
| Supabase | Persist results | No processing |
| `ResultsDashboard` | Render analysis | No API calls |

---

## Data Models

### Supabase Schema

```sql
create table analyses (
  id                uuid primary key default gen_random_uuid(),
  city              text not null,
  business_type     text,                    -- null = all types
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

### AnalysisResult Type (JSONB structure)

```typescript
type AnalysisResult = {
  market: {
    saturation_level: 'bajo' | 'medio' | 'alto' | 'saturado'
    saturation_score: number           // 0-100
    total_businesses_analyzed: number
    avg_rating: number
    rating_distribution: Record<string, number>
  }
  opportunities: Array<{
    title: string
    description: string
    evidence: string
    opportunity_score: number          // 0-100
    category: 'categoria_faltante' | 'punto_debil' | 'tendencia' | 'zona'
  }>
  pain_points: Array<{
    issue: string
    frequency: 'baja' | 'media' | 'alta'
    example_quote: string
  }>
  zones: Array<{
    description: string
    insight: string
  }>
  opportunity_score: number            // 0-100, main score
  opportunity_label: string
  executive_summary: string            // 3-4 paragraphs in Spanish
  generated_at: string
  model_used: string
}
```

**Why JSONB:** The AI result schema will evolve between versions without migrations. First-level columns (city, status, avg_rating) handle filtering needs.

**Why generated cache_key:** Enables indexed lookups `WHERE cache_key = $1 AND created_at > now() - interval '24 hours'` without app-layer logic.

---

## Folder Structure

```
local-opportunity-finder/
│
├── src/
│   ├── app/
│   │   ├── page.tsx                  # Home: SearchForm
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   ├── results/
│   │   │   └── page.tsx              # ResultsDashboard
│   │   └── api/
│   │       └── analyze/
│   │           └── route.ts          # POST — full pipeline (Edge Runtime)
│   │
│   ├── components/
│   │   ├── search/
│   │   │   ├── SearchForm.tsx
│   │   │   └── SearchForm.types.ts
│   │   ├── results/
│   │   │   ├── ResultsDashboard.tsx
│   │   │   ├── OpportunityScore.tsx
│   │   │   ├── MarketSaturation.tsx
│   │   │   ├── OpportunityList.tsx
│   │   │   ├── PainPoints.tsx
│   │   │   ├── ExecutiveSummary.tsx
│   │   │   └── AnalysisStream.tsx
│   │   └── ui/                       # shadcn/ui (auto-generated)
│   │
│   ├── lib/
│   │   ├── google-places.ts
│   │   ├── claude.ts
│   │   ├── supabase.ts
│   │   └── analysis-cache.ts
│   │
│   ├── types/
│   │   └── analysis.ts               # Shared types (frontend + backend)
│   │
│   └── hooks/
│       └── useAnalysisStream.ts
│
├── supabase/
│   └── migrations/
│       └── 0001_analyses.sql
│
├── .env.local
├── .env.example
├── next.config.ts
├── tailwind.config.ts
└── package.json
```

---

## Data Flow

### Request Lifecycle

```
1. User submits city + business_type

2. useAnalysisStream hook
   └─ POST /api/analyze
   └─ Opens ReadableStream
   └─ Shows skeleton UI

3. API Route (Edge Runtime)
   ├─ 3a. Cache check (24h window)
   │      └─ If hit → stream cached result → END
   │
   ├─ 3b. Google Places fetch
   │      └─ /textsearch: up to 60 businesses
   │      └─ /details for low-rated or high-review businesses
   │
   ├─ 3c. Normalize
   │      └─ avg_rating, rating distribution
   │      └─ Extract pain point keywords from reviews
   │      └─ Group by geographic zone
   │      └─ Compress to < 8k tokens for Claude
   │
   ├─ 3d. Claude API (streaming)
   │      └─ System: market analyst role, respond in Spanish
   │      └─ User: normalized context + JSON schema instruction
   │
   ├─ 3e. Stream to browser
   │      └─ Each chunk forwarded via TransformStream
   │
   └─ 3f. Persist (waitUntil — non-blocking)
          └─ INSERT INTO analyses on stream completion
          └─ DB failure → silent log, user unaffected
```

### Two-Phase Streaming Protocol

```
[PHASE 1] Executive summary text tokens → rendered progressively in ExecutiveSummary
[PHASE 2] "---JSON---" delimiter + structured JSON → parsed and rendered as dashboard
```

This gives immediate visual feedback while structured data arrives at the end.

---

## Error Handling

| Error | Behavior |
|-------|----------|
| Google Places timeout | Retry ×2 with 1s backoff; then user-facing error |
| Google Places < 5 results | Analysis with warning: "datos limitados para esta búsqueda" |
| Claude returns invalid JSON | Retry parse with correction prompt; fallback to text-only summary |
| Supabase save fails | Silent log — user already has their result |

---

## Environment Variables

```bash
GOOGLE_PLACES_API_KEY=
ANTHROPIC_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

---

## Identified Risks

| Risk | Mitigation |
|------|-----------|
| Google Places cost ($0.20/search) | 24h cache by city+type in Supabase |
| Claude returns malformed JSON | Explicit JSON schema in prompt + parse retry |
| Google Places slow (>5s) | 5s timeout per request, retry ×2 |
| Supabase blocks stream | Use `waitUntil()` — save never blocks streaming response |

---

## Phase 2 Preparation

The current schema and structure do not block Fase 2. When ready to add:
- **Auth:** Add `user_id uuid references auth.users` to `analyses`
- **Saved reports:** Add `saved_reports` table linking users to analyses
- **Payments:** Stripe webhook → update `subscriptions` table
- **Interactive map:** Mapbox renders `zones[]` from `AnalysisResult`
- **Async jobs:** Supabase Edge Functions for scheduled re-analysis

---

## Stack Rationale

| Technology | Role | Why |
|------------|------|-----|
| Next.js 15 App Router | Full-stack framework | File-based routing, Edge Runtime, streaming native |
| TypeScript | Type safety | Shared types between API and UI |
| TailwindCSS + shadcn/ui | UI | Speed of development, consistent design system |
| Supabase | Database + future auth | PostgreSQL with built-in auth for Fase 2 |
| Claude API | AI analysis | Best-in-class for structured reasoning in Spanish |
| Google Places API | Business data | Most complete local business database |
| Mapbox | Maps (Fase 2) | Structure ready, implementation deferred |
