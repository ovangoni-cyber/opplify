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

type Props = { lead: AgencyLead }

export function AgencyLeadCard({ lead }: Props) {
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
    </div>
  )
}
