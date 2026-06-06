'use client'

import { useState } from 'react'
import { AgencyLeadCard } from './AgencyLeadCard'
import type { AgencyLead } from '@/types/analysis'

const PAGE_SIZE = 10

type Props = {
  leads: AgencyLead[]
  onLoadMore?: () => void
  loadingMore?: boolean
}

export function AgencyLeadsList({ leads, onLoadMore, loadingMore }: Props) {
  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? leads : leads.slice(0, PAGE_SIZE)
  const remaining = leads.length - PAGE_SIZE

  return (
    <div className="space-y-4">
      <h3 className="font-heading font-semibold text-base">
        Leads detectados{' '}
        <span className="text-muted-foreground font-normal text-sm">({leads.length})</span>
      </h3>
      {visible.map((lead, i) => (
        <div
          key={`${lead.business_name}-${i}`}
          className="stagger-item"
          style={{ animationDelay: `${Math.min(i * 50, 400)}ms` }}
        >
          <AgencyLeadCard lead={lead} />
        </div>
      ))}
      {!showAll && remaining > 0 && (
        <button
          onClick={() => setShowAll(true)}
          className="btn-press w-full py-3 rounded-xl border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
        >
          Ver {remaining} leads más
        </button>
      )}
      {onLoadMore && (
        <button
          onClick={onLoadMore}
          disabled={loadingMore}
          className="btn-press w-full py-3 rounded-xl border border-primary/40 text-sm text-primary hover:bg-primary/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loadingMore ? (
            <>
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              Buscando más leads...
            </>
          ) : (
            'Cargar más leads →'
          )}
        </button>
      )}
    </div>
  )
}
