import { Progress } from '@/components/ui/progress'
import type { MarketData, SaturationLevel } from '@/types/analysis'

const SATURATION_LABELS: Record<SaturationLevel, string> = {
  bajo: 'Bajo',
  medio: 'Medio',
  alto: 'Alto',
  saturado: 'Saturado',
}

const SATURATION_COLOR: Record<SaturationLevel, string> = {
  bajo: 'text-primary',
  medio: 'text-amber-400',
  alto: 'text-orange-400',
  saturado: 'text-rose-400',
}

type Props = { market: MarketData }

export function MarketSaturation({ market }: Props) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-4">
      <h3 className="font-heading font-semibold text-base">Saturación del mercado</h3>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Nivel actual</span>
        <span className={`font-heading font-bold text-lg ${SATURATION_COLOR[market.saturation_level]}`}>
          {SATURATION_LABELS[market.saturation_level]}
        </span>
      </div>
      <Progress value={market.saturation_score} className="h-1.5" />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{market.total_businesses_analyzed} negocios analizados</span>
        <span>Promedio {market.avg_rating}★</span>
      </div>
    </div>
  )
}
