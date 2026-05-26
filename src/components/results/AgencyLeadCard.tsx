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
  seo: 'bg-blue-100 text-blue-700',
  ai_automation: 'bg-purple-100 text-purple-700',
  chatbot: 'bg-green-100 text-green-700',
  branding: 'bg-pink-100 text-pink-700',
  ads: 'bg-orange-100 text-orange-700',
  web_redesign: 'bg-cyan-100 text-cyan-700',
  crm: 'bg-yellow-100 text-yellow-700',
  reputation: 'bg-red-100 text-red-700',
}

function leadScoreColor(score: number) {
  if (score >= 70) return 'text-red-600'
  if (score >= 40) return 'text-yellow-600'
  return 'text-green-600'
}

type Props = { lead: AgencyLead }

export function AgencyLeadCard({ lead }: Props) {
  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-semibold text-base truncate">{lead.business_name}</p>
          <p className="text-xs text-muted-foreground truncate">{lead.address}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {lead.rating > 0 ? `${lead.rating}★` : 'Sin rating'} · {lead.review_count} reseñas
          </p>
        </div>
        <div className="flex flex-col items-center shrink-0">
          <span className={`text-4xl font-bold tabular-nums ${leadScoreColor(lead.lead_score)}`}>
            {lead.lead_score}
          </span>
          <span className="text-xs text-muted-foreground">lead score</span>
        </div>
      </div>

      {lead.pain_points.length > 0 && (
        <ul className="space-y-1">
          {lead.pain_points.map((pp, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-red-400 shrink-0" />
              {pp}
            </li>
          ))}
        </ul>
      )}

      {lead.recommended_services.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {lead.recommended_services.map((svc) => (
            <span
              key={svc}
              className={`px-2 py-0.5 rounded-full text-xs font-medium ${SERVICE_COLOR[svc] ?? 'bg-gray-100 text-gray-700'}`}
            >
              {SERVICE_LABEL[svc] ?? svc}
            </span>
          ))}
        </div>
      )}

      {lead.pitch && (
        <blockquote className="border-l-2 border-primary pl-3 text-sm text-muted-foreground italic">
          {lead.pitch}
        </blockquote>
      )}
    </div>
  )
}
