# Pitch Email Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Generar email →" button to each agency lead card that calls Claude and shows a full cold outreach email (subject + body) expanded inline.

**Architecture:** New Node.js API route `POST /api/pitch` authenticates the user and calls Claude with lead data, returning `{subject, body}`. `AgencyLeadCard` gets local state to manage the `idle → loading → done/error` flow and renders the expanded email UI. `AgencyLeadsList` passes `city` down to each card.

**Tech Stack:** Next.js 16, Anthropic SDK (`claude-sonnet-4-6`), React, TypeScript, Tailwind CSS

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `src/app/api/pitch/route.ts` | Auth + Claude call + return `{subject, body}` |
| Modify | `src/components/results/AgencyLeadCard.tsx` | Pitch state machine + button + expanded email UI |
| Modify | `src/components/results/AgencyLeadsList.tsx` | Pass `city` prop to each `AgencyLeadCard` |

---

## Task 1: API route POST /api/pitch

**Files:**
- Create: `src/app/api/pitch/route.ts`

- [ ] **Step 1: Create the route file**

```ts
import type { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabase'
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
  const services = lead.recommended_services
    .map((s) => SERVICE_LABEL[s] ?? s)
    .join(', ')
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
  if (!token) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) {
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

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/pitch/route.ts
git commit -m "feat: add POST /api/pitch endpoint for email generation"
```

---

## Task 2: AgencyLeadCard with pitch UI

**Files:**
- Modify: `src/components/results/AgencyLeadCard.tsx`

- [ ] **Step 1: Replace the full file**

```tsx
'use client'

import { useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase-browser'
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
  seo: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  ai_automation: 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
  chatbot: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  branding: 'bg-pink-500/10 text-pink-400 border border-pink-500/20',
  ads: 'bg-orange-500/10 text-orange-400 border border-orange-500/20',
  web_redesign: 'bg-primary/10 text-primary border border-primary/20',
  crm: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  reputation: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
}

function leadScoreColor(score: number) {
  if (score >= 70) return 'text-primary'
  if (score >= 40) return 'text-amber-400'
  return 'text-rose-400'
}

type PitchState = 'idle' | 'loading' | 'done' | 'error'

type Props = {
  lead: AgencyLead
  city?: string
}

export function AgencyLeadCard({ lead, city = '' }: Props) {
  const [pitchState, setPitchState] = useState<PitchState>('idle')
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [pitchError, setPitchError] = useState('')
  const [copied, setCopied] = useState<'subject' | 'body' | 'all' | null>(null)

  const handleGeneratePitch = async () => {
    setPitchState('loading')
    setPitchError('')
    try {
      const { data: sessionData } = await supabaseBrowser.auth.getSession()
      const token = sessionData.session?.access_token
      const res = await fetch('/api/pitch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ lead, city }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setPitchError(data.error ?? 'Error al generar el email')
        setPitchState('error')
        return
      }
      setEmailSubject(data.subject)
      setEmailBody(data.body)
      setPitchState('done')
    } catch {
      setPitchError('Error de conexión')
      setPitchState('error')
    }
  }

  const copyToClipboard = async (text: string, field: 'subject' | 'body' | 'all') => {
    await navigator.clipboard.writeText(text)
    setCopied(field)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="card-lift rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-heading font-semibold text-base truncate">{lead.business_name}</p>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{lead.address}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {lead.rating > 0 ? `${lead.rating}★` : 'Sin rating'} · {lead.review_count} reseñas
          </p>
        </div>
        <div className="flex flex-col items-center shrink-0 text-right">
          <span className={`font-heading text-4xl font-bold tabular-nums leading-none ${leadScoreColor(lead.lead_score)}`}>
            {lead.lead_score}
          </span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">score</span>
        </div>
      </div>

      {lead.pain_points.length > 0 && (
        <ul className="space-y-1.5">
          {lead.pain_points.map((pp, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className="mt-1.5 h-1 w-1 rounded-full bg-rose-400/60 shrink-0" />
              {pp}
            </li>
          ))}
        </ul>
      )}

      {lead.recommended_services.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {lead.recommended_services.map((svc) => (
            <span
              key={svc}
              className={`px-2 py-0.5 rounded-md text-xs font-medium ${SERVICE_COLOR[svc] ?? 'bg-muted text-muted-foreground border border-border'}`}
            >
              {SERVICE_LABEL[svc] ?? svc}
            </span>
          ))}
        </div>
      )}

      {lead.pitch && (
        <blockquote className="border-l-2 border-primary/40 pl-3 text-sm text-muted-foreground italic">
          {lead.pitch}
        </blockquote>
      )}

      {/* Pitch section */}
      {pitchState === 'idle' && (
        <button
          onClick={handleGeneratePitch}
          className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
        >
          Generar email →
        </button>
      )}

      {pitchState === 'loading' && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          Generando...
        </div>
      )}

      {pitchState === 'error' && (
        <div className="space-y-1">
          <p className="text-xs text-rose-400">{pitchError}</p>
          <button
            onClick={() => setPitchState('idle')}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Reintentar
          </button>
        </div>
      )}

      {pitchState === 'done' && (
        <div className="space-y-3 border border-border rounded-lg p-4 bg-muted/30">
          {/* Subject */}
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">Asunto</span>
              <button
                onClick={() => copyToClipboard(emailSubject, 'subject')}
                className="text-[10px] text-primary hover:text-primary/80 transition-colors"
              >
                {copied === 'subject' ? '✓ Copiado' : 'Copiar'}
              </button>
            </div>
            <p className="text-sm font-medium text-foreground">{emailSubject}</p>
          </div>

          {/* Body */}
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">Cuerpo</span>
              <button
                onClick={() => copyToClipboard(emailBody, 'body')}
                className="text-[10px] text-primary hover:text-primary/80 transition-colors"
              >
                {copied === 'body' ? '✓ Copiado' : 'Copiar'}
              </button>
            </div>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{emailBody}</p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-border">
            <button
              onClick={() => copyToClipboard(`Asunto: ${emailSubject}\n\n${emailBody}`, 'all')}
              className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
            >
              {copied === 'all' ? '✓ Copiado' : 'Copiar todo'}
            </button>
            <button
              onClick={() => setPitchState('idle')}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/components/results/AgencyLeadCard.tsx
git commit -m "feat: add pitch email UI to AgencyLeadCard with inline expand"
```

---

## Task 3: Pass city prop from AgencyLeadsList to AgencyLeadCard

**Files:**
- Modify: `src/components/results/AgencyLeadsList.tsx`

- [ ] **Step 1: Add city prop to AgencyLeadCard render**

In `src/components/results/AgencyLeadsList.tsx`, find the `<AgencyLeadCard>` render inside the map:

```tsx
<AgencyLeadCard lead={lead} />
```

Replace with:
```tsx
<AgencyLeadCard lead={lead} city={city} />
```

- [ ] **Step 2: TypeScript + full test suite**

```bash
npx tsc --noEmit
npm test
```

Expected: no TS errors, 28 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/results/AgencyLeadsList.tsx
git commit -m "feat: pass city prop to AgencyLeadCard for pitch context"
```

---

## Task 4: Verification

- [ ] **Step 1: Confirm API route exists**

```bash
ls src/app/api/pitch/route.ts
```

Expected: file exists.

- [ ] **Step 2: TypeScript final check**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 3: Full test suite**

```bash
npm test
```

Expected: 28 tests, all pass.

- [ ] **Step 4: Manual smoke test**

Run `npm run dev`. Log in, run an agency leads analysis. On any lead card:
- "Generar email →" button visible at bottom of card
- Click → spinner "Generando..."
- Email expands inline with Asunto + Cuerpo sections
- "Copiar" on subject copies subject only
- "Copiar todo" copies full email
- "Cerrar" collapses back to idle (button reappears)
