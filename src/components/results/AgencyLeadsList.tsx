'use client'

import { useState } from 'react'
import { AgencyLeadCard } from './AgencyLeadCard'
import type { AgencyLead } from '@/types/analysis'

const PAGE_SIZE = 10

type Props = { leads: AgencyLead[] }

export function AgencyLeadsList({ leads }: Props) {
  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? leads : leads.slice(0, PAGE_SIZE)
  const remaining = leads.length - PAGE_SIZE

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-lg">
        Leads detectados{' '}
        <span className="text-muted-foreground font-normal text-base">({leads.length})</span>
      </h3>
      {visible.map((lead, i) => (
        <AgencyLeadCard key={`${lead.business_name}-${i}`} lead={lead} />
      ))}
      {!showAll && remaining > 0 && (
        <button
          onClick={() => setShowAll(true)}
          className="w-full py-3 rounded-xl border border-dashed text-sm text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
        >
          Ver {remaining} leads más
        </button>
      )}
    </div>
  )
}
