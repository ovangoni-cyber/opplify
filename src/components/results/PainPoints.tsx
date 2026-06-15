import type { PainPoint } from '@/types/analysis'

const FREQ_DOT: Record<string, string> = {
  alta: 'bg-rose-400',
  media: 'bg-amber-400',
  baja: 'bg-muted-foreground/40',
}

const FREQ_LABEL: Record<string, string> = {
  alta: 'Alta',
  media: 'Media',
  baja: 'Baja',
}

const FREQ_TEXT: Record<string, string> = {
  alta: 'text-rose-400',
  media: 'text-amber-400',
  baja: 'text-muted-foreground',
}

type Props = { painPoints: PainPoint[] }

export function PainPoints({ painPoints }: Props) {
  if (painPoints.length === 0) return null

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-baseline justify-between px-5 py-4 border-b border-border">
        <h3 className="font-heading font-semibold text-sm">Puntos débiles del mercado</h3>
        <span className="text-[10px] text-muted-foreground tabular-nums">{painPoints.length} identificados</span>
      </div>
      <div className="divide-y divide-border">
        {painPoints.map((pp, i) => (
          <div key={`${pp.issue}-${i}`} className="grid grid-cols-[5rem_1fr] gap-4 px-5 py-4 hover:bg-muted/30 transition-colors duration-150">
            <div className="flex items-center gap-1.5 pt-0.5">
              <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${FREQ_DOT[pp.frequency] ?? FREQ_DOT.baja}`} />
              <span className={`text-xs font-medium tabular-nums ${FREQ_TEXT[pp.frequency] ?? FREQ_TEXT.baja}`}>
                {FREQ_LABEL[pp.frequency] ?? pp.frequency}
              </span>
            </div>
            <div className="min-w-0">
              <p className="font-medium text-sm leading-snug mb-1.5">{pp.issue}</p>
              {pp.example_quote && (
                <blockquote className="text-xs text-muted-foreground/60 border-l-2 border-border pl-3 italic leading-relaxed">
                  &ldquo;{pp.example_quote}&rdquo;
                </blockquote>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
