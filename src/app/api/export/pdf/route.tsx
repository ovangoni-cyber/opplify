import type { NextRequest } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { pool } from '@/lib/db'
import { verifyToken } from '@/lib/auth-server'
import { buildLogoDataUrl } from '@/lib/branding'
import { validateResultForMode } from '@/lib/pdf/validate-result'
import { MarketResearchPdf } from '@/lib/pdf/market-research-template'
import { AgencyLeadsPdf } from '@/lib/pdf/agency-leads-template'
import type { AppMode, AnalysisResult, AgencyLeadsResult } from '@/types/analysis'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') ?? ''
  const payload = verifyToken(token)
  if (!payload) return Response.json({ error: 'No autorizado' }, { status: 401 })

  let mode: AppMode
  let city: string
  let businessType: string | null
  let result: unknown
  try {
    const body = await req.json()
    mode = body.mode === 'agency_leads' ? 'agency_leads' : 'market_research'
    city = body.city ?? ''
    businessType = body.business_type ?? null
    result = body.result
  } catch {
    return Response.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }

  const validationError = validateResultForMode(mode, result)
  if (validationError) return Response.json({ error: validationError }, { status: 400 })

  const { rows } = await pool.query(
    'SELECT agency_name, logo_data, logo_mime FROM user_branding WHERE user_id = $1',
    [payload.sub]
  )
  const branding = rows[0]
  const agencyName: string | null = branding?.agency_name ?? null
  const logoDataUrl =
    branding?.logo_data && branding?.logo_mime ? buildLogoDataUrl(branding.logo_data, branding.logo_mime) : null

  try {
    const document =
      mode === 'agency_leads' ? (
        <AgencyLeadsPdf
          result={result as AgencyLeadsResult}
          city={city}
          businessType={businessType}
          agencyName={agencyName}
          logoDataUrl={logoDataUrl}
        />
      ) : (
        <MarketResearchPdf
          result={result as AnalysisResult}
          city={city}
          businessType={businessType}
          agencyName={agencyName}
          logoDataUrl={logoDataUrl}
        />
      )

    const buffer = await renderToBuffer(document)
    const slug = city.toLowerCase().replace(/[^a-z0-9]+/g, '-')

    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="opplify-${slug}-${mode}.pdf"`,
      },
    })
  } catch (err) {
    console.error('[export/pdf] generation failed:', err)
    return Response.json({ error: 'No se pudo generar el PDF, intenta de nuevo.' }, { status: 500 })
  }
}
