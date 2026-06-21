import Anthropic from '@anthropic-ai/sdk'
import type { PlacesContext, AnalysisResult, AgencyLeadsResult, AppMode } from '@/types/analysis'

const MODEL = 'claude-sonnet-4-6'
export const JSON_DELIMITER = '---JSON---'

export function parseAnalysisJson(raw: string): AnalysisResult {
  const parsed = JSON.parse(raw.trim())
  if (typeof parsed.opportunity_score !== 'number') {
    throw new Error('Invalid analysis JSON: missing opportunity_score')
  }
  return parsed as AnalysisResult
}

export function parseAgencyLeadsJson(raw: string): AgencyLeadsResult {
  const parsed = JSON.parse(raw.trim())
  if (!Array.isArray(parsed.leads)) {
    throw new Error('Invalid agency leads JSON: missing leads array')
  }
  return parsed as AgencyLeadsResult
}

export function attachContactInfo(
  result: AgencyLeadsResult,
  context: PlacesContext
): AgencyLeadsResult {
  const byName = new Map(context.businesses.map((b) => [b.name.toLowerCase(), b]))
  return {
    ...result,
    leads: result.leads.map((lead) => {
      const match = byName.get(lead.business_name.toLowerCase())
      return {
        ...lead,
        phone: match?.phone ?? null,
        website: match?.website ?? null,
      }
    }),
  }
}

function buildPrompt(
  city: string,
  businessType: string | null,
  context: PlacesContext
): string {
  const typeLabel = businessType ?? 'todos los tipos de negocio'

  const topPainPoints = context.businesses
    .filter((b) => b.rating > 0 && b.rating < 3.5 && b.recent_reviews.length > 0)
    .flatMap((b) => b.recent_reviews.map((r) => `[${b.name}]: ${r}`))
    .slice(0, 8)
    .join('\n')

  const businessSummary = context.businesses
    .slice(0, 20)
    .map(
      (b) =>
        `- ${b.name} | ${b.rating > 0 ? b.rating + '★' : 'sin rating'} (${b.review_count} reseñas) | ${b.address}`
    )
    .join('\n')

  return `Eres un analista de mercado local experto. Analiza el mercado de "${typeLabel}" en ${city} con datos reales de Google Places.

DATOS: ${context.total_count} negocios | Rating promedio: ${context.avg_rating} | Distribución: ${JSON.stringify(context.rating_distribution)}

NEGOCIOS:
${businessSummary}

RESEÑAS DE NEGOCIOS CON PROBLEMAS:
${topPainPoints || 'Sin reseñas disponibles de negocios con bajo rating.'}

INSTRUCCIONES:
1. Escribe un resumen ejecutivo en español de 3-4 párrafos. Sé específico: menciona negocios reales, patrones concretos y recomendaciones accionables.
2. Escribe exactamente esta línea: ${JSON_DELIMITER}
3. Escribe el JSON estructurado siguiendo este schema exacto (máx. 5 opportunities, 5 pain_points, 3 zones):

{
  "market": {
    "saturation_level": "bajo|medio|alto|saturado",
    "saturation_score": <0-100>,
    "total_businesses_analyzed": ${context.total_count},
    "avg_rating": ${context.avg_rating},
    "rating_distribution": ${JSON.stringify(context.rating_distribution)}
  },
  "opportunities": [
    {
      "title": "string",
      "description": "string",
      "evidence": "string con datos concretos",
      "opportunity_score": <0-100>,
      "category": "categoria_faltante|punto_debil|tendencia|zona"
    }
  ],
  "pain_points": [
    {
      "issue": "string",
      "frequency": "baja|media|alta",
      "example_quote": "cita de reseña real o descripción del problema"
    }
  ],
  "zones": [
    {
      "description": "nombre o descripción de la zona",
      "insight": "observación sobre esa zona"
    }
  ],
  "opportunity_score": <0-100>,
  "opportunity_label": "string descriptivo del nivel de oportunidad",
  "executive_summary": "resumen en 1-2 frases",
  "generated_at": "${new Date().toISOString()}",
  "model_used": "${MODEL}"
}`
}

function buildAgencyLeadsPrompt(
  city: string,
  businessType: string | null,
  context: PlacesContext
): string {
  const typeLabel = businessType ?? 'todos los tipos de negocio'

  const businessSummary = context.businesses
    .slice(0, 20)
    .map(
      (b) =>
        `- ${b.name} | ${b.rating > 0 ? b.rating + '★' : 'sin rating'} (${b.review_count} reseñas) | ${b.address}${
          b.recent_reviews.length > 0
            ? '\n  Reseñas: ' + b.recent_reviews.slice(0, 2).join(' | ')
            : ''
        }`
    )
    .join('\n')

  return `Eres un analista de prospección comercial para agencias digitales. Analiza los negocios de "${typeLabel}" en ${city} como leads potenciales para servicios de marketing, automatización, SEO, diseño web o IA.

DATOS GLOBALES: ${context.total_count} negocios | Rating promedio: ${context.avg_rating}

NEGOCIOS A EVALUAR:
${businessSummary}

INSTRUCCIONES:
1. Escribe exactamente esta línea sin nada antes: ${JSON_DELIMITER}
2. Devuelve los TOP 10 leads con mayor potencial como JSON:

{
  "leads": [
    {
      "business_name": "nombre del negocio",
      "address": "dirección",
      "rating": <número>,
      "review_count": <número>,
      "lead_score": <0-100>,
      "pain_points": ["problema detectado"],
      "recommended_services": ["seo"|"ai_automation"|"chatbot"|"branding"|"ads"|"web_redesign"|"crm"|"reputation"],
      "summary": "1 frase sobre el negocio",
      "pitch": "1-2 frases de argumento de venta"
    }
  ],
  "total_analyzed": ${context.total_count},
  "generated_at": "${new Date().toISOString()}",
  "model_used": "${MODEL}"
}

SCORING (lead_score 0-100):
- Rating < 3.5★: +30pts | Pocas reseñas: +20pts | Sin respuesta a reviews: +20pts | Señales de ineficiencia: +15pts

Devuelve exactamente 10 leads ordenados por lead_score descendente.`
}

export async function streamAnalysis(
  city: string,
  businessType: string | null,
  context: PlacesContext,
  mode: AppMode,
  onChunk: (text: string) => void
): Promise<AnalysisResult | AgencyLeadsResult> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const prompt =
    mode === 'agency_leads'
      ? buildAgencyLeadsPrompt(city, businessType, context)
      : buildPrompt(city, businessType, context)

  let fullText = ''

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 8192,
    messages: [{ role: 'user', content: prompt }],
  })

  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      const chunk = event.delta.text
      fullText += chunk
      onChunk(chunk)
    }
  }

  const delimiterIndex = fullText.indexOf(JSON_DELIMITER)
  if (delimiterIndex === -1) {
    throw new Error('Claude response missing JSON delimiter — raw: ' + fullText.slice(0, 200))
  }

  const jsonStr = fullText.slice(delimiterIndex + JSON_DELIMITER.length).trim()

  if (mode === 'agency_leads') {
    try {
      return attachContactInfo(parseAgencyLeadsJson(jsonStr), context)
    } catch {
      const match = jsonStr.match(/\{[\s\S]*\}/)
      if (!match) throw new Error('No JSON object found in Claude agency leads response')
      return attachContactInfo(parseAgencyLeadsJson(match[0]), context)
    }
  }

  try {
    return parseAnalysisJson(jsonStr)
  } catch {
    const match = jsonStr.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('No JSON object found in Claude response')
    return parseAnalysisJson(match[0])
  }
}
