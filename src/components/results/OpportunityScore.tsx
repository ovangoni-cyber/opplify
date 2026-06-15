type Props = {
  score: number
  label: string
}

function scoreColor(score: number) {
  if (score >= 70) return 'text-primary'
  if (score >= 40) return 'text-amber-400'
  return 'text-rose-400'
}

function scoreBorder(score: number) {
  if (score >= 70) return 'border-primary/20'
  if (score >= 40) return 'border-amber-500/20'
  return 'border-rose-500/20'
}

export function OpportunityScore({ score, label }: Props) {
  return (
    <div className={`rounded-xl border bg-card p-6 flex flex-col gap-3 ${scoreBorder(score)}`}>
      <span className="text-[10px] text-muted-foreground uppercase tracking-[0.18em]">Score de oportunidad</span>
      <div className="flex items-end gap-3">
        <span className={`font-heading text-7xl font-bold tabular-nums leading-none ${scoreColor(score)}`}>
          {score}
        </span>
        <span className="text-sm text-muted-foreground mb-1.5 leading-none">/100</span>
      </div>
      <span className="text-xs text-muted-foreground border border-border rounded px-2 py-1 self-start">
        {label}
      </span>
    </div>
  )
}
