import { Badge } from '@/components/ui/badge'
import type { Opportunity } from '@/types/analysis'

const CATEGORY_LABELS: Record<string, string> = {
  categoria_faltante: 'Categoría faltante',
  punto_debil: 'Punto débil',
  tendencia: 'Tendencia',
  zona: 'Zona',
}

type Props = { opportunities: Opportunity[] }

export function OpportunityList({ opportunities }: Props) {
  if (opportunities.length === 0) return null

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-lg">Oportunidades detectadas</h3>
      {opportunities.map((op, i) => (
        <div key={`${op.title}-${i}`} className="rounded-lg border bg-card p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <span className="font-medium text-sm">{op.title}</span>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="secondary" className="text-xs">
                {CATEGORY_LABELS[op.category] ?? op.category}
              </Badge>
              <span className="text-sm font-bold text-green-600">{op.opportunity_score}</span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mb-1">{op.description}</p>
          {op.evidence && (
            <p className="text-xs text-muted-foreground/70 italic">Evidencia: {op.evidence}</p>
          )}
        </div>
      ))}
    </div>
  )
}
