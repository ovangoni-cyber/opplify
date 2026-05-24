import { Badge } from '@/components/ui/badge'
import type { BadgeProps } from '@/components/ui/badge'
import type { PainPoint } from '@/types/analysis'

type Variant = NonNullable<BadgeProps['variant']>

const FREQ_VARIANT: Record<string, Variant> = {
  alta: 'destructive',
  media: 'default',
  baja: 'secondary',
}

type Props = { painPoints: PainPoint[] }

export function PainPoints({ painPoints }: Props) {
  if (painPoints.length === 0) return null

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-lg">Puntos débiles del mercado</h3>
      {painPoints.map((pp, i) => (
        <div key={`${pp.issue}-${i}`} className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium text-sm">{pp.issue}</span>
            <Badge variant={FREQ_VARIANT[pp.frequency] ?? 'secondary'} className="text-xs">
              Frecuencia {pp.frequency}
            </Badge>
          </div>
          {pp.example_quote && (
            <blockquote className="text-xs text-muted-foreground border-l-2 border-muted pl-3 italic">
              &ldquo;{pp.example_quote}&rdquo;
            </blockquote>
          )}
        </div>
      ))}
    </div>
  )
}
