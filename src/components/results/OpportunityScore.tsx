import { Badge } from '@/components/ui/badge'

type Props = {
  score: number
  label: string
}

function scoreColor(score: number) {
  if (score >= 70) return 'text-green-600'
  if (score >= 40) return 'text-yellow-600'
  return 'text-red-500'
}

export function OpportunityScore({ score, label }: Props) {
  return (
    <div className="rounded-xl border bg-card p-6 flex flex-col items-center gap-3">
      <span className="text-xs text-muted-foreground uppercase tracking-wide">Score de oportunidad</span>
      <span className={`text-7xl font-bold tabular-nums ${scoreColor(score)}`}>{score}</span>
      <span className="text-sm text-muted-foreground">/ 100</span>
      <Badge variant="outline" className="text-sm">{label}</Badge>
    </div>
  )
}
