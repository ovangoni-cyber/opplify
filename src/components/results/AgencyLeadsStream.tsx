'use client'

import { useState, useEffect } from 'react'
import { useAnalysisStream } from '@/hooks/useAnalysisStream'
import { AgencyLeadsList } from './AgencyLeadsList'
import type { StreamState, AgencyLead, AgencyLeadsResult } from '@/types/analysis'

type Props = {
  state: StreamState
  city: string
  businessType: string
}

export function AgencyLeadsStream({ state, city, businessType }: Props) {
  const { state: loadMoreState, analyze: loadMoreAnalyze } = useAnalysisStream()
  const [accumulatedLeads, setAccumulatedLeads] = useState<AgencyLead[]>([])
  const [canLoadMore, setCanLoadMore] = useState(false)

  useEffect(() => {
    if (state.phase === 'complete') {
      const result = state.result as AgencyLeadsResult | null
      if (result?.leads && result.leads.length > 0) {
        setAccumulatedLeads(result.leads)
        setCanLoadMore(result.leads.length >= 10)
      }
    }
  }, [state.phase, state.result])

  useEffect(() => {
    if (loadMoreState.phase === 'complete') {
      const result = loadMoreState.result as AgencyLeadsResult | null
      if (result?.leads) {
        setAccumulatedLeads((prev) => {
          const existingNames = new Set(prev.map((l) => l.business_name.toLowerCase()))
          const newLeads = result.leads.filter(
            (l) => !existingNames.has(l.business_name.toLowerCase())
          )
          setCanLoadMore(newLeads.length >= 10)
          return [...prev, ...newLeads]
        })
      }
    }
  }, [loadMoreState.phase, loadMoreState.result])

  const handleLoadMore = () => {
    const excludeNames = accumulatedLeads.map((l) => l.business_name)
    loadMoreAnalyze({ city, business_type: businessType, mode: 'agency_leads', exclude: excludeNames })
  }

  const loadingMore =
    loadMoreState.phase === 'loading' ||
    loadMoreState.phase === 'streaming_summary' ||
    loadMoreState.phase === 'streaming_json'

  const { phase, error } = state

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

  return (
    <div className="space-y-6">
      {accumulatedLeads.length > 0 && (
        <AgencyLeadsList
          leads={accumulatedLeads}
          onLoadMore={canLoadMore ? handleLoadMore : undefined}
          loadingMore={loadingMore}
        />
      )}
      {loadMoreState.phase === 'error' && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700 text-sm">
          {loadMoreState.error ?? 'Error al cargar más leads. Intenta de nuevo.'}
        </div>
      )}
    </div>
  )
}
