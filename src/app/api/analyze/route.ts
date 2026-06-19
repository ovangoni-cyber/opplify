import type { NextRequest } from 'next/server'

export const runtime = 'nodejs'

import { fetchAndNormalizePlaces } from '@/lib/google-places'
import { streamAnalysis, JSON_DELIMITER } from '@/lib/claude'
import { getCachedAnalysis, saveAnalysis } from '@/lib/analysis-cache'
import { pool } from '@/lib/db'
import { verifyToken } from '@/lib/auth-server'
import type { SearchParams, AnalysisResult, AgencyLeadsResult, PlacesContext, AppMode } from '@/types/analysis'

async function decrementCredit(userId: string): Promise<number> {
  const { rows } = await pool.query(
    `UPDATE user_credits SET credits = credits - 1, updated_at = now()
     WHERE user_id = $1 AND credits > 0 RETURNING credits`,
    [userId]
  )
  return rows[0]?.credits ?? -1
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') ?? ''
  if (!token) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  const payload = verifyToken(token)
  if (!payload) {
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
  const fromHistory = body.from_history === true

  if (!city) {
    return new Response(JSON.stringify({ error: 'Ciudad requerida' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!hasExclusions) {
    const cached = await getCachedAnalysis(city, businessType, mode, fromHistory)
    if (cached) {
      const payload2 = `---CACHED---\n${JSON_DELIMITER}\n${JSON.stringify(cached.result)}`
      return new Response(payload2, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    }
  }

  if (payload.sub !== process.env.TEST_USER_ID) {
    const remaining = await decrementCredit(payload.sub)
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
      context = { ...context, businesses: filteredBusinesses, total_count: filteredBusinesses.length }
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
      encoder.encode('[NOTA: Se encontraron pocos negocios para esta búsqueda. El análisis puede ser limitado.]\n\n')
    )
  }

  let analysisResult: AnalysisResult | AgencyLeadsResult | null = null

  const streamPromise = streamAnalysis(city, businessType, context, mode, async (chunk) => {
    await writer.write(encoder.encode(chunk))
  })
    .then(async (result) => {
      analysisResult = result
      if (result && !hasExclusions) {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
        const dupResult = await pool.query(
          `SELECT id FROM search_history WHERE user_id = $1 AND city = $2 AND mode = $3 AND created_at >= $4 AND ${
            businessType ? 'business_type = $5' : 'business_type IS NULL'
          } LIMIT 1`,
          businessType
            ? [payload.sub, city, mode, fiveMinutesAgo, businessType]
            : [payload.sub, city, mode, fiveMinutesAgo]
        )
        if (dupResult.rows.length === 0) {
          await pool.query(
            'INSERT INTO search_history (user_id, city, business_type, mode) VALUES ($1, $2, $3, $4)',
            [payload.sub, city, businessType, mode]
          ).catch((err) => console.error('[history] insert failed:', err))
          console.log('[history] inserted for user', payload.sub)
        }
      }
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
      void saveAnalysis(city, businessType, analysisResult, context.total_count, context.avg_rating, mode)
        .catch((err) => console.error('Cache save failed:', err))
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
