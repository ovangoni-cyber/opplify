type Props = {
  summary: string
  streaming?: boolean
}

export function ExecutiveSummary({ summary, streaming }: Props) {
  return (
    <div className="rounded-xl border bg-card p-6">
      <h3 className="font-semibold text-lg mb-4">Resumen ejecutivo</h3>
      <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
        {summary}
        {streaming && (
          <span className="inline-block w-0.5 h-4 bg-foreground ml-0.5 animate-pulse align-middle" />
        )}
      </div>
    </div>
  )
}
