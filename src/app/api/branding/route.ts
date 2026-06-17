import type { NextRequest } from 'next/server'
import { pool } from '@/lib/db'
import { verifyToken } from '@/lib/auth-server'
import { validateLogo, buildLogoDataUrl } from '@/lib/branding'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') ?? ''
  const payload = verifyToken(token)
  if (!payload) return Response.json({ error: 'No autorizado' }, { status: 401 })

  const { rows } = await pool.query(
    'SELECT agency_name, logo_data, logo_mime FROM user_branding WHERE user_id = $1',
    [payload.sub]
  )
  const row = rows[0]
  if (!row) return Response.json({ agency_name: null, logo: null })

  const logo = row.logo_data && row.logo_mime ? buildLogoDataUrl(row.logo_data, row.logo_mime) : null
  return Response.json({ agency_name: row.agency_name, logo })
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') ?? ''
  const payload = verifyToken(token)
  if (!payload) return Response.json({ error: 'No autorizado' }, { status: 401 })

  let agencyName: string
  let logoBase64: string | null
  let logoMime: string | null
  try {
    const body = await req.json()
    agencyName = body.agency_name ?? ''
    logoBase64 = body.logo_base64 ?? null
    logoMime = body.logo_mime ?? null
  } catch {
    return Response.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }

  if (logoBase64 && logoMime) {
    const error = validateLogo(logoBase64, logoMime)
    if (error) return Response.json({ error }, { status: 400 })
  }

  const logoBuffer = logoBase64 ? Buffer.from(logoBase64, 'base64') : null

  await pool.query(
    `INSERT INTO user_branding (user_id, agency_name, logo_data, logo_mime, updated_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (user_id) DO UPDATE SET
       agency_name = $2, logo_data = $3, logo_mime = $4, updated_at = now()`,
    [payload.sub, agencyName, logoBuffer, logoMime]
  )

  return Response.json({ ok: true })
}
