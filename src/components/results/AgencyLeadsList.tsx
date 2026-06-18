'use client'

import { useState } from 'react'
import { AgencyLeadCard } from './AgencyLeadCard'
import { exportLeadsToCSV } from '@/lib/export-csv'
import { authClient } from '@/lib/auth-client'
import { downloadPdf } from '@/lib/download-pdf'
import type { AgencyLead, AgencyLeadsResult } from '@/types/analysis'

const PAGE_SIZE = 10

type Props = {
  leads: AgencyLead[]
  onLoadMore?: () => void
  loadingMore?: boolean
  city?: string
  businessType?: string
  exportDate?: string
}

export function AgencyLeadsList({ leads, onLoadMore, loadingMore, city, businessType, exportDate }: Props) {
  const [showAll, setShowAll] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [pdfError, setPdfError] = useState('')
  const visible = showAll ? leads : leads.slice(0, PAGE_SIZE)
  const remaining = leads.length - PAGE_SIZE

  const handleExportPdf = async () => {
    setExportingPdf(true)
    setPdfError('')
    const { data: sessionData } = await authClient.getSession()
    const token = sessionData.session?.access_token
    const result: AgencyLeadsResult = {
      leads,
      total_analyzed: leads.length,
      generated_at: new Date().toISOString(),
      model_used: '',
    }
    const { error } = await downloadPdf(
      { mode: 'agency_leads', city: city ?? '', business_type: businessType ?? null, result },
      token
    )
    if (error) setPdfError(error)
    setExportingPdf(false)
  }

  const handleExport = () => {
    const date = exportDate ?? new Date().toISOString().slice(0, 10)
    const filename = city
      ? `leads-${city.toLowerCase().replace(/\s+/g, '-')}-${date}.csv`
      : 'leads.csv'
    exportLeadsToCSV(leads, filename)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h3 className="font-heading font-semibold text-base">
          Leads detectados{' '}
          <span className="text-muted-foreground font-normal text-sm">({leads.length})</span>
        </h3>
        {leads.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportPdf}
              disabled={exportingPdf}
              className="text-xs font-medium text-primary hover:text-primary/80 border border-primary/30 hover:border-primary/60 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
            >
              {exportingPdf ? 'Generando...' : 'Exportar PDF →'}
            </button>
            <button
              onClick={handleExport}
              className="text-xs font-medium text-primary hover:text-primary/80 border border-primary/30 hover:border-primary/60 px-3 py-1.5 rounded-lg transition-colors"
            >
              Exportar CSV →
            </button>
          </div>
        )}
      </div>
      {pdfError && <p className="text-xs text-rose-400">{pdfError}</p>}
      {visible.map((lead, i) => (
        <div
          key={`${lead.business_name}-${i}`}
          className="stagger-item"
          style={{ animationDelay: `${Math.min(i * 50, 400)}ms` }}
        >
          <AgencyLeadCard lead={lead} city={city} />
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
