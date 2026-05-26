import { ExecutiveSummary } from './ExecutiveSummary'
import { OpportunityScore } from './OpportunityScore'
import { MarketSaturation } from './MarketSaturation'
import { OpportunityList } from './OpportunityList'
import { PainPoints } from './PainPoints'
import type { StreamState, AnalysisResult } from '@/types/analysis'

type Props = { state: StreamState }

export function AnalysisStream({ state }: Props) {
  const { phase, summary, result: rawResult, error } = state
  const result = rawResult as AnalysisResult | null

  if (phase === 'idle') return null

  if (phase === 'error') {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 text-sm">
        {error ?? 'Ocurrió un error inesperado. Intenta de nuevo.'}
      </div>
    )
  }

  if (phase === 'loading') {
    return (
      <div className="flex items-center gap-3 text-muted-foreground py-8">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span>Obteniendo datos del mercado...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {summary && (
        <ExecutiveSummary
          summary={summary}
          streaming={phase === 'streaming_summary'}
        />
      )}

      {result && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <OpportunityScore
              score={result.opportunity_score}
              label={result.opportunity_label}
            />
            <MarketSaturation market={result.market} />
          </div>
          <OpportunityList opportunities={result.opportunities} />
          <PainPoints painPoints={result.pain_points} />
          {result.zones.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-lg">Zonas de interés</h3>
              {result.zones.map((zone, i) => (
                <div key={`${zone.description}-${i}`} className="rounded-lg border bg-card p-4">
                  <p className="font-medium text-sm mb-1">{zone.description}</p>
                  <p className="text-sm text-muted-foreground">{zone.insight}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
