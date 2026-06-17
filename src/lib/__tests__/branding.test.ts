import { describe, it, expect } from 'vitest'
import { validateLogo } from '../branding'

describe('validateLogo', () => {
  it('accepts a small PNG', () => {
    const base64 = Buffer.alloc(100, 1).toString('base64')
    expect(validateLogo(base64, 'image/png')).toBeNull()
  })

  it('accepts a small JPG', () => {
    const base64 = Buffer.alloc(100, 1).toString('base64')
    expect(validateLogo(base64, 'image/jpeg')).toBeNull()
  })

  it('rejects unsupported mime types', () => {
    const base64 = Buffer.alloc(100, 1).toString('base64')
    expect(validateLogo(base64, 'image/gif')).toBe('El logo debe ser PNG o JPG.')
  })

  it('rejects logos larger than 1MB', () => {
    const base64 = Buffer.alloc(1024 * 1024 + 1).toString('base64')
    expect(validateLogo(base64, 'image/png')).toBe('El logo debe pesar menos de 1MB.')
  })

  it('accepts a logo exactly at the 1MB limit', () => {
    const base64 = Buffer.alloc(1024 * 1024).toString('base64')
    expect(validateLogo(base64, 'image/png')).toBeNull()
  })
})
