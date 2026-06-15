import type { Opportunity } from '@/types/analysis'

const CATEGORY_LABELS: Record<string, string> = {
  categoria_faltante: 'Categoría faltante',
  punto_debil: 'Punto débil',
  tendencia: 'Tendencia',
  zona: 'Zona',
}

function opportunityScoreColor(score: number) {
  if (score >= 70) return 'text-primary'
  if (score >= 40) return 'text-amber-400'
  return 'text-rose-400'
}

type Props = { opportunities: Opportunity[] }

export function OpportunityList({ opportunities }: Props) {
  if (opportunities.length === 0) return null

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-baseline justify-between px-5 py-4 border-b border-border">
        <h3 className="font-heading font-semibold text-sm">Oportunidades detectadas</h3>
        <span className="text-[10px] text-muted-foreground tabular-nums">{opportunities.length} encontradas</span>
      </div>
      <div className="divide-y divide-border">
        {opportunities.map((op, i) => (
          <div key={`${op.title}-${i}`} className="grid grid-cols-[3rem_1fr] gap-4 px-5 py-4 hover:bg-muted/30 transition-colors duration-150">
            <div className="pt-0.5">
              <span className={`font-heading font-bold text-xl tabular-nums leading-none ${opportunityScoreColor(op.opportunity_score)}`}>
                {op.opportunity_score}
              </span>
            </div>
            <div className="min-w-0">
              <div className="flex items-start justify-between gap-3 mb-1">
                <span className="font-medium text-sm leading-snug">{op.title}</span>
                <span className="shrink-0 text-[10px] uppercase tracking-[0.12em] text-muted-foreground/60 border border-border/60 px-1.5 py-0.5 rounded whitespace-nowrap">
                  {CATEGORY_LABELS[op.category] ?? op.category}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{op.description}</p>
              {op.evidence && (
                <p className="text-xs text-muted-foreground/50 italic mt-1.5">{op.evidence}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
