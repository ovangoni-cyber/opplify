import { describe, it, expect } from 'vitest'
import { parseAnalysisJson, parseAgencyLeadsJson } from '../claude'

const VALID_RESULT = {
  market: {
    saturation_level: 'medio',
    saturation_score: 55,
    total_businesses_analyzed: 20,
    avg_rating: 4.1,
    rating_distribution: { '1': 0, '2': 1, '3': 3, '4': 10, '5': 6 },
  },
  opportunities: [
    {
      title: 'Delivery saludable',
      description: 'No hay opciones de comida saludable con delivery.',
      evidence: '12 de 20 negocios no ofrecen delivery.',
      opportunity_score: 75,
      category: 'categoria_faltante',
    },
  ],
  pain_points: [
    {
      issue: 'Servicio lento',
      frequency: 'alta',
      example_quote: 'Esperé 40 minutos por una pizza.',
    },
  ],
  zones: [{ description: 'Centro', insight: 'Alta densidad sin diferenciación.' }],
  opportunity_score: 72,
  opportunity_label: 'Oportunidad moderada',
  executive_summary: 'El mercado presenta oportunidades...',
  generated_at: '2026-05-23T10:00:00Z',
  model_used: 'claude-sonnet-4-6',
}

describe('parseAnalysisJson', () => {
  it('parses valid JSON string', () => {
    const result = parseAnalysisJson(JSON.stringify(VALID_RESULT))
    expect(result.opportunity_score).toBe(72)
    expect(result.opportunities).toHaveLength(1)
  })

  it('throws on invalid JSON', () => {
    expect(() => parseAnalysisJson('not json')).toThrow()
  })

  it('throws when opportunity_score is missing', () => {
    const invalid = { ...VALID_RESULT, opportunity_score: undefined }
    expect(() => parseAnalysisJson(JSON.stringify(invalid))).toThrow(
      'Invalid analysis JSON: missing opportunity_score'
    )
  })

  it('handles whitespace around JSON', () => {
    const result = parseAnalysisJson('  ' + JSON.stringify(VALID_RESULT) + '\n')
    expect(result.model_used).toBe('claude-sonnet-4-6')
  })
})

const VALID_LEADS_RESULT = {
  leads: [
    {
      business_name: 'Pizzería Roma',
      address: 'Calle Mayor 10',
      rating: 2.8,
      review_count: 34,
      lead_score: 82,
      pain_points: ['No responde reviews', 'Sin sistema de reservas'],
      recommended_services: ['reputation', 'chatbot'],
      summary: 'Pizzería con alto tráfico pero mala gestión digital.',
      pitch: 'Sus competidores responden reviews y usted no. Podemos cambiar eso.',
    },
  ],
  total_analyzed: 20,
  generated_at: '2026-05-26T10:00:00Z',
  model_used: 'claude-sonnet-4-6',
}

describe('parseAgencyLeadsJson', () => {
  it('parses valid agency leads JSON', () => {
    const result = parseAgencyLeadsJson(JSON.stringify(VALID_LEADS_RESULT))
    expect(result.leads).toHaveLength(1)
    expect(result.leads[0].lead_score).toBe(82)
  })

  it('throws on invalid JSON', () => {
    expect(() => parseAgencyLeadsJson('not json')).toThrow()
  })

  it('throws when leads array is missing', () => {
    const invalid = { ...VALID_LEADS_RESULT, leads: undefined }
    expect(() => parseAgencyLeadsJson(JSON.stringify(invalid))).toThrow(
      'Invalid agency leads JSON: missing leads array'
    )
  })

  it('handles whitespace around JSON', () => {
    const result = parseAgencyLeadsJson('  ' + JSON.stringify(VALID_LEADS_RESULT) + '\n')
    expect(result.total_analyzed).toBe(20)
  })
})
