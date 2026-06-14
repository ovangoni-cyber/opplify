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
