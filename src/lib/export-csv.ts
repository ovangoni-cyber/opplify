import type { AgencyLead } from '@/types/analysis'

function escapeField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return '"' + value.replace(/"/g, '""') + '"'
  }
  return value
}

export function buildCsvContent(leads: AgencyLead[]): string {
  const header = 'Nombre,Dirección,Rating,Reseñas,Score,Pain Points,Servicios,Pitch'
  const rows = leads.map((lead) => [
    escapeField(lead.business_name),
    escapeField(lead.address),
    String(lead.rating),
    String(lead.review_count),
    String(lead.lead_score),
    escapeField(lead.pain_points.join(' | ')),
    escapeField(lead.recommended_services.join(' | ')),
    escapeField(lead.pitch),
  ].join(','))
  return [header, ...rows].join('\n')
}

export function exportLeadsToCSV(leads: AgencyLead[], filename: string): void {
  const bom = '﻿'
  const content = bom + buildCsvContent(leads)
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 100)
}
