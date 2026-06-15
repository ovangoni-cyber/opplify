import type { NextRequest } from 'next/server'
import { fetchAndNormalizePlaces } from '@/lib/google-places'
import { streamAnalysis, JSON_DELIMITER } from '@/lib/claude'
import { getCachedAnalysis, saveAnalysis } from '@/lib/analysis-cache'
import { supabaseAdmin } from '@/lib/supabase'
import type { SearchParams, AnalysisResult, AgencyLeadsResult, PlacesContext, AppMode } from '@/types/analysis'

export const runtime = 'edge'

export async function POST(req: NextRequest) {
  // Auth check
  const token = req.headers.get('authorization')?.replace('Bearer ', '') ?? ''
  if (!token) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

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

  // Cache hits are free — return without deducting credits
  if (!hasExclusions) {
    const cached = await getCachedAnalysis(city, businessType, mode)
    if (cached) {
      const payload = `---CACHED---\n${JSON_DELIMITER}\n${JSON.stringify(cached.result)}`
      return new Response(payload, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    }
  }

  // Deduct 1 credit for a fresh analysis (skipped for the test account)
  if (user.id !== process.env.TEST_USER_ID) {
    const { data: remaining } = await supabaseAdmin.rpc('decrement_credit', { p_user_id: user.id })
    if (remaining === -1) {
      return new Response(JSON.stringify({ error: 'Sin créditos' }), {
        status: 402,
        headers: { 'Content-Type': 'application/json' },
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
      const filteredBusinesses = context.businesses.filter(
        (b) => !excludeSet.has(b.name.toLowerCase())
      )
      context = {
        ...context,
        businesses: filteredBusinesses,
        total_count: filteredBusinesses.length,
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

      void Promise.resolve(
        supabaseAdmin
          .from('search_history')
          .insert({ user_id: user.id, city, business_type: businessType, mode })
      ).catch((err: unknown) => console.error('History save failed:', err))
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
