import { describe, it, expect } from 'vitest'
import { buildCsvContent } from '../export-csv'
import type { AgencyLead } from '@/types/analysis'

const baseLead: AgencyLead = {
  business_name: 'La Esquina de Palermo',
  address: 'Av. Santa Fe 3241, Palermo',
  rating: 4.2,
  review_count: 187,
  lead_score: 87,
  pain_points: ['Sin web propia', 'Sin reservas online'],
  recommended_services: ['web_redesign', 'seo'],
  summary: 'Buen restaurante con poca presencia digital.',
  pitch: 'Tu web puede generar reservas automáticas.',
}

describe('buildCsvContent', () => {
  it('includes header row', () => {
    const csv = buildCsvContent([])
    expect(csv).toContain('Nombre,Dirección,Rating,Reseñas,Score,Pain Points,Servicios,Pitch')
  })

  it('renders a lead row with correct values', () => {
    const csv = buildCsvContent([baseLead])
    expect(csv).toContain('La Esquina de Palermo')
    expect(csv).toContain('87')
    expect(csv).toContain('4.2')
    expect(csv).toContain('187')
    expect(csv).toContain('Sin web propia | Sin reservas online')
    expect(csv).toContain('web_redesign | seo')
  })

  it('wraps fields containing commas in double quotes', () => {
    const lead = { ...baseLead, business_name: 'Bar, Café y Más' }
    const csv = buildCsvContent([lead])
    expect(csv).toContain('"Bar, Café y Más"')
  })

  it('escapes double quotes inside fields', () => {
    const lead = { ...baseLead, pitch: 'Decile "hola" a tus clientes.' }
    const csv = buildCsvContent([lead])
    expect(csv).toContain('"Decile ""hola"" a tus clientes."')
  })

  it('returns only header for empty leads array', () => {
    const csv = buildCsvContent([])
    const lines = csv.trim().split('\n')
    expect(lines).toHaveLength(1)
  })

  it('produces one data row per lead', () => {
    const csv = buildCsvContent([baseLead, baseLead])
    const lines = csv.trim().split('\n')
    expect(lines).toHaveLength(3)
  })
})
