'use client'

import { useState } from 'react'
import { ExecutiveSummary } from './ExecutiveSummary'
import { OpportunityScore } from './OpportunityScore'
import { MarketSaturation } from './MarketSaturation'
import { OpportunityList } from './OpportunityList'
import { PainPoints } from './PainPoints'
import { authClient } from '@/lib/auth-client'
import { downloadPdf } from '@/lib/download-pdf'
import type { StreamState, AnalysisResult } from '@/types/analysis'

type Props = { state: StreamState; city: string; businessType: string }

export function AnalysisStream({ state, city, businessType }: Props) {
  const { phase, summary, result: rawResult, error } = state
  const result = rawResult as AnalysisResult | null
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')

  const handleExportPdf = async () => {
    if (!result) return
    setExporting(true)
    setExportError('')
    const { data: sessionData } = await authClient.getSession()
    const token = sessionData.session?.access_token
    const { error: err } = await downloadPdf(
      { mode: 'market_research', city, business_type: businessType || null, result },
      token
    )
    if (err) setExportError(err)
    setExporting(false)
  }

  if (phase === 'idle') return null

  if (phase === 'error') {
    return (
      <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-4 text-rose-400 text-sm">
        {error ?? 'Ocurrió un error inesperado. Intenta de nuevo.'}
      </div>
    )
  }

  if (phase === 'loading') {
    return (
      <div className="flex items-center gap-3 text-muted-foreground py-12">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="text-sm">Obteniendo datos del mercado...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {phase === 'complete' && result && (
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={handleExportPdf}
            disabled={exporting}
            className="text-xs font-medium text-primary hover:text-primary/80 border border-primary/30 hover:border-primary/60 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
          >
            {exporting ? 'Generando...' : 'Exportar PDF →'}
          </button>
        </div>
      )}
      {exportError && <p className="text-xs text-rose-400">{exportError}</p>}
      {summary && (
        <ExecutiveSummary
          summary={summary}
          streaming={phase === 'streaming_summary'}
        />
      )}

      {phase === 'streaming_json' && (
        <div className="space-y-6 animate-pulse">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl border bg-card p-5 h-28" />
            <div className="rounded-xl border bg-card p-5 h-28" />
          </div>
          <div className="space-y-3">
            <div className="h-5 bg-muted rounded w-44" />
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-xl border bg-card p-5 h-20" />
            ))}
          </div>
          <div className="space-y-3">
            <div className="h-5 bg-muted rounded w-36" />
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-lg border bg-card p-4 h-10" />
            ))}
          </div>
        </div>
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
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="flex items-baseline justify-between px-5 py-4 border-b border-border">
                <h3 className="font-heading font-semibold text-sm">Zonas de interés</h3>
                <span className="text-[10px] text-muted-foreground tabular-nums">{result.zones.length} zonas</span>
              </div>
              <div className="divide-y divide-border">
                {result.zones.map((zone, i) => (
                  <div key={`${zone.description}-${i}`} className="px-5 py-4 hover:bg-muted/30 transition-colors duration-150">
                    <p className="font-medium text-sm mb-1">{zone.description}</p>
                    <p className="text-sm text-muted-foreground">{zone.insight}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
