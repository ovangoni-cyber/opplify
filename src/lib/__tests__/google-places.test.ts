import { describe, it, expect } from 'vitest'
import {
  calculateAvgRating,
  buildRatingDistribution,
  priceLevelFromString,
} from '../google-places'

describe('calculateAvgRating', () => {
  it('returns 0 for empty array', () => {
    expect(calculateAvgRating([])).toBe(0)
  })

  it('rounds to 2 decimal places', () => {
    expect(calculateAvgRating([4, 3, 5])).toBe(4)
    expect(calculateAvgRating([4.1, 4.2, 4.3])).toBe(4.2)
  })

  it('handles single value', () => {
    expect(calculateAvgRating([3.7])).toBe(3.7)
  })
})

describe('buildRatingDistribution', () => {
  it('counts floor of each rating', () => {
    const dist = buildRatingDistribution([1.2, 2.8, 3.0, 4.5, 5.0, 4.9])
    expect(dist).toEqual({ '1': 1, '2': 1, '3': 1, '4': 2, '5': 1 })
  })

  it('ignores ratings outside 1-5', () => {
    const dist = buildRatingDistribution([0, 6])
    expect(dist).toEqual({ '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 })
  })

  it('returns zeroed distribution for empty input', () => {
    const dist = buildRatingDistribution([])
    expect(dist).toEqual({ '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 })
  })
})

describe('priceLevelFromString', () => {
  it('maps known strings', () => {
    expect(priceLevelFromString('PRICE_LEVEL_INEXPENSIVE')).toBe(1)
    expect(priceLevelFromString('PRICE_LEVEL_VERY_EXPENSIVE')).toBe(4)
  })

  it('returns null for undefined', () => {
    expect(priceLevelFromString(undefined)).toBe(null)
  })

  it('returns null for unknown string', () => {
    expect(priceLevelFromString('PRICE_LEVEL_UNKNOWN')).toBe(null)
  })

  it('maps PRICE_LEVEL_FREE to 0 (falsy — must be checked with !== null)', () => {
    expect(priceLevelFromString('PRICE_LEVEL_FREE')).toBe(0)
    expect(priceLevelFromString('PRICE_LEVEL_FREE')).not.toBeNull()
  })
})
