# Pitch Email Generator Design

**Date:** 2026-06-07  
**Status:** Approved

## Context

Each `AgencyLead` already has a short `pitch` tagline generated during analysis. This feature adds a "Generar email →" button per lead card that produces a full cold outreach email (subject + body) using Claude, expanding inline inside the card. No credits are consumed — it's a value-add to the analysis already paid.

## Decision

New API endpoint `POST /api/pitch` calls Claude with lead data and returns a structured email. The UI expands inline in `AgencyLeadCard` with copy-to-clipboard functionality. `AgencyLeadCard` receives an optional `city` prop for richer prompt context.

## API Endpoint

**File:** `src/app/api/pitch/route.ts`  
**Runtime:** Node.js (not Edge — uses Anthropic SDK)  
**Auth:** Requires valid Bearer token (same pattern as `/api/analyze`)

**Request body:**
```ts
{ lead: AgencyLead; city: string }
```

**Response (success):**
```json
{ "subject": "...", "body": "..." }
```

**Response (error):**
```json
{ "error": "..." }
```
with appropriate HTTP status (401 unauthorized, 400 bad request, 500 server error).

**Claude call:**
- Model: `claude-sonnet-4-6` (same as analysis)
- `max_tokens: 1024`
- Non-streaming (simple request/response)
- Prompt instructs Claude to write a professional cold email in Spanish from a digital agency perspective, referencing the specific pain points and recommended services of the lead

**Prompt template:**
```
Eres un consultor de marketing digital que trabaja para una agencia. Escribe un email frío profesional en español para contactar a este negocio potencial como cliente.

Negocio: {business_name}
Ubicación: {address} ({city})
Rating: {rating}★ ({review_count} reseñas)
Problemas detectados: {pain_points joined with ", "}
Servicios recomendados: {recommended_services joined with ", "}
Contexto adicional: {pitch}

Requisitos del email:
- Asunto: corto, llamativo, personalizado al negocio
- Cuerpo: máximo 150 palabras, tono profesional pero cercano
- Mencionar 1-2 problemas específicos detectados
- Proponer valor concreto, no genérico
- Terminar con CTA claro (reunión de 15 min, llamada, etc.)
- NO usar plantillas genéricas ni frases vacías

Responde ÚNICAMENTE con este JSON (sin texto adicional):
{"subject": "...", "body": "..."}
```

## UI: AgencyLeadCard

**File:** `src/components/results/AgencyLeadCard.tsx`

New optional prop: `city?: string`

State added to the component:
- `pitchState: 'idle' | 'loading' | 'done' | 'error'`
- `emailSubject: string`
- `emailBody: string`
- `pitchError: string`

**Button:** "Generar email →" shown at the bottom of the card when `pitchState === 'idle'`. On click: calls `POST /api/pitch`, handles all states.

**Expanded email UI** (shown when `pitchState === 'done'`):

```
┌─────────────────────────────────────┐
│ Asunto                              │
│ [subject text]              [Copiar]│
├─────────────────────────────────────┤
│ Cuerpo                              │
│ [body text...]              [Copiar]│
├─────────────────────────────────────┤
│ [Copiar todo]              [Cerrar] │
└─────────────────────────────────────┘
```

Each "Copiar" button uses `navigator.clipboard.writeText()`. "Copiar todo" copies `Asunto: {subject}\n\n{body}`. "Cerrar" resets `pitchState` to `'idle'`.

## AgencyLeadsList → AgencyLeadCard

`AgencyLeadsList` already receives `city?: string` (added in the CSV export feature). Pass it down to each `AgencyLeadCard`:

```tsx
<AgencyLeadCard lead={lead} city={city} />
```

## Credit Model

No credit deduction. The pitch call is lightweight (≤150 words output) and is a value-add to the analysis credit already consumed. Auth is still required.

## Files Changed

| Action | File |
|--------|------|
| Create | `src/app/api/pitch/route.ts` |
| Modify | `src/components/results/AgencyLeadCard.tsx` |
| Modify | `src/components/results/AgencyLeadsList.tsx` |

## Verification

1. Click "Generar email →" on a lead card → spinner shows
2. Email expands inline with subject + body
3. "Copiar" buttons copy individual fields to clipboard
4. "Copiar todo" copies full email
5. "Cerrar" collapses back to idle state
6. No auth → 401 handled gracefully (error message shown in card)
7. `npx tsc --noEmit` → no errors
