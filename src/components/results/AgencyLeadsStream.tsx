import { ExecutiveSummary } from './ExecutiveSummary'
import { AgencyLeadsList } from './AgencyLeadsList'
import type { StreamState, AgencyLeadsResult } from '@/types/analysis'

type Props = { state: StreamState }

export function AgencyLeadsStream({ state }: Props) {
  const { phase, summary, result, error } = state

  if (phase === 'idle') return null

  if (phase === 'error') {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 text-sm">
        {error ?? 'Ocurrió un error inesperado. Intenta de nuevo.'}
      </div>
    )
  }

  if (phase === 'loading' || phase === 'streaming_summary' || phase === 'streaming_json') {
    return (
      <div className="flex items-center gap-3 text-muted-foreground py-8">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span>Analizando prospectos...</span>
      </div>
    )
  }

  const leadsResult = result as AgencyLeadsResult | null

  return (
    <div className="space-y-6">
      {summary && (
        <ExecutiveSummary
          summary={summary}
          streaming={phase === 'streaming_summary'}
        />
      )}
      {leadsResult?.leads && leadsResult.leads.length > 0 && (
        <AgencyLeadsList leads={leadsResult.leads} />
      )}
    </div>
  )
}
