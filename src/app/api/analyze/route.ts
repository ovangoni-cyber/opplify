import type { NextRequest } from 'next/server'
import { fetchAndNormalizePlaces } from '@/lib/google-places'
import { streamAnalysis, JSON_DELIMITER } from '@/lib/claude'
import { getCachedAnalysis, saveAnalysis } from '@/lib/analysis-cache'
import type { SearchParams, AnalysisResult, AgencyLeadsResult, PlacesContext, AppMode } from '@/types/analysis'

export const runtime = 'edge'

export async function POST(req: NextRequest) {
  let body: SearchParams
  try {
    body = (await req.json()) as SearchParams
  } catch {
    return new Response(JSON.stringify({ error: 'Cuerpo de solicitud inválido' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const city = body.city?.trim()
  const businessType = body.business_type?.trim() || null
  const mode: AppMode = body.mode === 'agency_leads' ? 'agency_leads' : 'market_research'
  const exclude: string[] = Array.isArray(body.exclude) ? body.exclude : []
  const hasExclusions = exclude.length > 0

  if (!city) {
    return new Response(JSON.stringify({ error: 'Ciudad requerida' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!hasExclusions) {
    const cached = await getCachedAnalysis(city, businessType, mode)
    if (cached) {
      const payload = `---CACHED---\n${JSON_DELIMITER}\n${JSON.stringify(cached.result)}`
      return new Response(payload, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    }
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Configuración del servidor incompleta' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let context!: PlacesContext
  try {
    context = await fetchAndNormalizePlaces(city, businessType, apiKey)
    if (hasExclusions) {
      const excludeSet = new Set(exclude.map((n) => n.toLowerCase()))
      context = {
        ...context,
        businesses: context.businesses.filter(
          (b) => !excludeSet.has(b.name.toLowerCase())
        ),
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error de Google Places'
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>()
  const writer = writable.getWriter()
  const encoder = new TextEncoder()

  if (context.total_count < 5) {
    await writer.write(
      encoder.encode(
        '[NOTA: Se encontraron pocos negocios para esta búsqueda. El análisis puede ser limitado.]\n\n'
      )
    )
  }

  let analysisResult: AnalysisResult | AgencyLeadsResult | null = null

  const streamPromise = streamAnalysis(city, businessType, context, mode, async (chunk) => {
    await writer.write(encoder.encode(chunk))
  })
    .then(async (result) => {
      analysisResult = result
      await writer.close()
    })
    .catch(async (err) => {
      const errMsg = `\n\n[ERROR]: ${err instanceof Error ? err.message : 'Error desconocido'}`
      try {
        await writer.write(encoder.encode(errMsg))
        await writer.close()
      } catch {
        // writer may already be closed
      }
    })

  streamPromise.then(() => {
    if (analysisResult && !hasExclusions) {
      void saveAnalysis(
        city,
        businessType,
        analysisResult,
        context.total_count,
        context.avg_rating,
        mode
      ).catch((err) => console.error('Cache save failed:', err))
    }
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  })
}
