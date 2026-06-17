import type { AppMode } from '@/types/analysis'

export function validateResultForMode(mode: AppMode, result: unknown): string | null {
  if (!result || typeof result !== 'object') {
    return 'Resultado de análisis inválido.'
  }
  const r = result as Record<string, unknown>

  if (mode === 'agency_leads') {
    return Array.isArray(r.leads) ? null : 'Resultado de análisis inválido.'
  }

  const hasMarket = typeof r.market === 'object' && r.market !== null
  const hasOpportunities = Array.isArray(r.opportunities)
  const hasPainPoints = Array.isArray(r.pain_points)
  return hasMarket && hasOpportunities && hasPainPoints ? null : 'Resultado de análisis inválido.'
}
