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

function buildPrompt(
  city: string,
  businessType: string | null,
  context: PlacesContext
): string {
  const typeLabel = businessType ?? 'todos los tipos de negocio'

  const topPainPoints = context.businesses
    .filter((b) => b.rating > 0 && b.rating < 3.5 && b.recent_reviews.length > 0)
    .flatMap((b) => b.recent_reviews.map((r) => `[${b.name}]: ${r}`))
    .slice(0, 15)
    .join('\n')

  const businessSummary = context.businesses
    .slice(0, 40)
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
3. Escribe el JSON estructurado siguiendo este schema exacto:

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
  "executive_summary": "mismo texto del resumen ejecutivo anterior",
  "generated_at": "${new Date().toISOString()}",
  "model_used": "${MODEL}"
}`
}

export async function streamAnalysis(
  city: string,
  businessType: string | null,
  context: PlacesContext,
  onChunk: (text: string) => void
): Promise<AnalysisResult> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const prompt = buildPrompt(city, businessType, context)

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

  try {
    return parseAnalysisJson(jsonStr)
  } catch {
    // Try extracting JSON object if there's surrounding text
    const match = jsonStr.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('No JSON object found in Claude response')
    return parseAnalysisJson(match[0])
  }
}
