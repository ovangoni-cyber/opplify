import type { NextRequest } from 'next/server'
import { fetchAndNormalizePlaces } from '@/lib/google-places'
import { streamAnalysis, JSON_DELIMITER } from '@/lib/claude'
import { getCachedAnalysis, saveAnalysis } from '@/lib/analysis-cache'
import type { SearchParams, AnalysisResult, PlacesContext } from '@/types/analysis'

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

  if (!city) {
    return new Response(JSON.stringify({ error: 'Ciudad requerida' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Cache hit: return immediately as plain text with CACHED marker
  const cached = await getCachedAnalysis(city, businessType)
  if (cached) {
    const payload = `---CACHED---\n${JSON_DELIMITER}\n${JSON.stringify(cached.result)}`
    return new Response(payload, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }

  // Fetch from Google Places
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Configuración del servidor incompleta' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  let context!: PlacesContext  // definite assignment — try block returns on error

  try {
    context = await fetchAndNormalizePlaces(city, businessType, apiKey)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error de Google Places'
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Stream Claude analysis to the client
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

  let analysisResult: AnalysisResult | null = null

  const streamPromise = streamAnalysis(city, businessType, context, async (chunk) => {
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

  // Save to DB after stream completes — non-blocking relative to the response
  streamPromise.then(() => {
    if (analysisResult) {
      void saveAnalysis(
        city,
        businessType,
        analysisResult,
        context.total_count,
        context.avg_rating
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
