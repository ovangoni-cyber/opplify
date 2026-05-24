import { describe, it, expect, vi } from 'vitest'

vi.mock('../supabase', () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}))

import { buildCacheKey } from '../analysis-cache'

describe('buildCacheKey', () => {
  it('lowercases city and business type', () => {
    expect(buildCacheKey('Buenos Aires', 'Restaurante')).toBe('buenos aires:restaurante')
  })

  it('uses _all_ for null business type', () => {
    expect(buildCacheKey('Madrid', null)).toBe('madrid:_all_')
  })

  it('does not trim — caller is responsible for passing trimmed values', () => {
    expect(buildCacheKey('Lima ', ' Gym ')).toBe('lima : gym ')
  })
})
