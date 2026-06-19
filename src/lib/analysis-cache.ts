import { pool } from './db'
import type { AnalysisResult, AgencyLeadsResult, AppMode } from '@/types/analysis'

const CACHE_TTL_HOURS = 24

export type CachedAnalysis = {
  result: AnalysisResult | AgencyLeadsResult
  created_at: string
}

export function buildCacheKey(city: string, businessType: string | null): string {
  return `${city.toLowerCase()}:${(businessType ?? '_all_').toLowerCase()}`
}

export async function getCachedAnalysis(
  city: string,
  businessType: string | null,
  mode: AppMode,
  ignoreTtl = false
): Promise<CachedAnalysis | null> {
  const cacheKey = buildCacheKey(city, businessType)

  if (ignoreTtl) {
    const { rows } = await pool.query(
      'SELECT result, created_at FROM analyses WHERE cache_key = $1 AND mode = $2 ORDER BY created_at DESC LIMIT 1',
      [cacheKey, mode]
    )
    return rows[0] ?? null
  }

  const cutoff = new Date(Date.now() - CACHE_TTL_HOURS * 60 * 60 * 1000).toISOString()
  const { rows } = await pool.query(
    'SELECT result, created_at FROM analyses WHERE cache_key = $1 AND mode = $2 AND created_at > $3 ORDER BY created_at DESC LIMIT 1',
    [cacheKey, mode, cutoff]
  )
  return rows[0] ?? null
}

export async function saveAnalysis(
  city: string,
  businessType: string | null,
  result: AnalysisResult | AgencyLeadsResult,
  businessesCount: number,
  avgRating: number,
  mode: AppMode
): Promise<void> {
  await pool.query(
    'INSERT INTO analyses (city, business_type, result, businesses_count, avg_rating, mode) VALUES ($1, $2, $3, $4, $5, $6)',
    [city, businessType, JSON.stringify(result), businessesCount, avgRating, mode]
  )
}
