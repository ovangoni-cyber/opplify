import { supabaseAdmin } from './supabase'
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
  mode: AppMode
): Promise<CachedAnalysis | null> {
  const cacheKey = buildCacheKey(city, businessType)
  const cutoff = new Date(Date.now() - CACHE_TTL_HOURS * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabaseAdmin
    .from('analyses')
    .select('result, created_at')
    .eq('cache_key', cacheKey)
    .eq('mode', mode)
    .gt('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) return null
  return data as CachedAnalysis
}

export async function saveAnalysis(
  city: string,
  businessType: string | null,
  result: AnalysisResult | AgencyLeadsResult,
  businessesCount: number,
  avgRating: number,
  mode: AppMode
): Promise<void> {
  const { error } = await supabaseAdmin.from('analyses').insert({
    city,
    business_type: businessType,
    result,
    businesses_count: businessesCount,
    avg_rating: avgRating,
    mode,
  })
  if (error) throw error
}
