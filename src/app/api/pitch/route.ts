import type { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabase'
import type { AgencyLead, AgencyService } from '@/types/analysis'

export const runtime = 'nodejs'

const client = new Anthropic()

const SERVICE_LABEL: Record<AgencyService, string> = {
  seo: 'SEO',
  ai_automation: 'Automatización IA',
  chatbot: 'Chatbot',
  branding: 'Branding',
  ads: 'Ads',
  web_redesign: 'Rediseño Web',
  crm: 'CRM',
  reputation: 'Reputación',
}

function buildPitchPrompt(lead: AgencyLead, city: string): string {
  const services = lead.recommended_services
    .map((s) => SERVICE_LABEL[s] ?? s)
    .join(', ')
  const pains = lead.pain_points.join(', ')

  return `Eres un consultor de marketing digital que trabaja para una agencia. Escribe un email frío profesional en español para contactar a este negocio potencial como cliente.

Negocio: ${lead.business_name}
Ubicación: ${lead.address} (${city})
Rating: ${lead.rating > 0 ? `${lead.rating}★ (${lead.review_count} reseñas)` : `Sin rating (${lead.review_count} reseñas)`}
Problemas detectados: ${pains || 'No especificados'}
Servicios recomendados: ${services || 'No especificados'}
Contexto adicional: ${lead.pitch || ''}

Requisitos del email:
- Asunto: corto, llamativo, personalizado al negocio
- Cuerpo: máximo 150 palabras, tono profesional pero cercano
- Mencionar 1-2 problemas específicos detectados
- Proponer valor concreto, no genérico
- Terminar con CTA claro (reunión de 15 min, llamada, etc.)
- NO usar plantillas genéricas ni frases vacías

Responde ÚNICAMENTE con este JSON (sin texto adicional, sin markdown):
{"subject": "...", "body": "..."}`
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') ?? ''
  if (!token) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  let lead: AgencyLead
  let city: string
  try {
    const body = await req.json()
    lead = body.lead
    city = body.city ?? ''
    if (!lead?.business_name) throw new Error('invalid lead')
  } catch {
    return Response.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: buildPitchPrompt(lead, city) }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('No JSON in response')
    const { subject, body: emailBody } = JSON.parse(match[0])

    return Response.json({ subject, body: emailBody })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al generar el email'
    return Response.json({ error: message }, { status: 500 })
  }
}
