export type SaturationLevel = 'bajo' | 'medio' | 'alto' | 'saturado'
export type OpportunityCategory = 'categoria_faltante' | 'punto_debil' | 'tendencia' | 'zona'
export type Frequency = 'baja' | 'media' | 'alta'
export type AppMode = 'market_research' | 'agency_leads'
export type AgencyService =
  | 'seo'
  | 'ai_automation'
  | 'chatbot'
  | 'branding'
  | 'ads'
  | 'web_redesign'
  | 'crm'
  | 'reputation'

export type MarketData = {
  saturation_level: SaturationLevel
  saturation_score: number
  total_businesses_analyzed: number
  avg_rating: number
  rating_distribution: Record<string, number>
}

export type Opportunity = {
  title: string
  description: string
  evidence?: string
  opportunity_score: number
  category: OpportunityCategory
}

export type PainPoint = {
  issue: string
  frequency: Frequency
  example_quote?: string
}

export type Zone = {
  description: string
  insight: string
}

export type AnalysisResult = {
  market: MarketData
  opportunities: Opportunity[]
  pain_points: PainPoint[]
  zones: Zone[]
  opportunity_score: number
  opportunity_label: string
  executive_summary: string
  generated_at: string
  model_used: string
}

export type AgencyLead = {
  business_name: string
  address: string
  rating: number
  review_count: number
  lead_score: number
  pain_points: string[]
  recommended_services: AgencyService[]
  summary: string
  pitch: string
}

export type AgencyLeadsResult = {
  leads: AgencyLead[]
  total_analyzed: number
  generated_at: string
  model_used: string
}

export type StreamPhase =
  | 'idle'
  | 'loading'
  | 'streaming_summary'
  | 'streaming_json'
  | 'complete'
  | 'error'

export type StreamState = {
  phase: StreamPhase
  summary: string
  result: AnalysisResult | AgencyLeadsResult | null
  error: string | null
}

export type SearchParams = {
  city: string
  business_type: string
  mode: AppMode
}

// Internal type — never sent to the client
export type NormalizedBusiness = {
  name: string
  rating: number
  review_count: number
  address: string
  types: string[]
  price_level: number | null
  recent_reviews: string[]
}

export type PlacesContext = {
  businesses: NormalizedBusiness[]
  avg_rating: number
  rating_distribution: Record<string, number>
  total_count: number
}
