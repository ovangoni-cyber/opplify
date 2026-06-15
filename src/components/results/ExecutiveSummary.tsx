type Props = {
  summary: string
  streaming?: boolean
}

export function ExecutiveSummary({ summary, streaming }: Props) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <span className="text-[10px] text-muted-foreground uppercase tracking-[0.18em]">Resumen ejecutivo</span>
      <div className="mt-3 text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">
        {summary}
        {streaming && (
          <span className="inline-block w-0.5 h-4 bg-primary ml-0.5 animate-pulse align-middle" />
        )}
      </div>
    </div>
  )
}
