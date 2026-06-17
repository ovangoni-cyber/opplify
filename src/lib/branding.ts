export const MAX_LOGO_BYTES = 1024 * 1024
export const ALLOWED_LOGO_MIME_TYPES = ['image/png', 'image/jpeg'] as const

function base64ByteLength(base64: string): number {
  const padding = base64.match(/=+$/)?.[0].length ?? 0
  return Math.floor((base64.length * 3) / 4) - padding
}

export function validateLogo(logoBase64: string, logoMime: string): string | null {
  if (!ALLOWED_LOGO_MIME_TYPES.includes(logoMime as (typeof ALLOWED_LOGO_MIME_TYPES)[number])) {
    return 'El logo debe ser PNG o JPG.'
  }
  if (base64ByteLength(logoBase64) > MAX_LOGO_BYTES) {
    return 'El logo debe pesar menos de 1MB.'
  }
  return null
}

export function buildLogoDataUrl(logoData: Buffer, logoMime: string): string {
  return `data:${logoMime};base64,${logoData.toString('base64')}`
}
