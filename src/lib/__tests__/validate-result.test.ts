import { describe, it, expect } from 'vitest'
import { validateResultForMode } from '../pdf/validate-result'

describe('validateResultForMode', () => {
  it('accepts a valid market_research result', () => {
    const result = { market: {}, opportunities: [], pain_points: [] }
    expect(validateResultForMode('market_research', result)).toBeNull()
  })

  it('rejects a market_research result missing market', () => {
    const result = { opportunities: [], pain_points: [] }
    expect(validateResultForMode('market_research', result)).toBe('Resultado de análisis inválido.')
  })

  it('accepts a valid agency_leads result', () => {
    const result = { leads: [] }
    expect(validateResultForMode('agency_leads', result)).toBeNull()
  })

  it('rejects an agency_leads result without a leads array', () => {
    const result = { leads: 'not-an-array' }
    expect(validateResultForMode('agency_leads', result)).toBe('Resultado de análisis inválido.')
  })

  it('rejects null', () => {
    expect(validateResultForMode('market_research', null)).toBe('Resultado de análisis inválido.')
  })
})
