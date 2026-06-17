import type { NextRequest } from 'next/server'
import { verifyToken } from '@/lib/auth-server'
import { getStripe, STRIPE_PRICE_IDS } from '@/lib/stripe'
import { CREDIT_PACKS } from '@/lib/credit-packs'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') ?? ''
  const payload = verifyToken(token)
  if (!payload) return Response.json({ error: 'No autorizado' }, { status: 401 })

  let packId: string
  try {
    const body = await req.json()
    packId = body.packId
  } catch {
    return Response.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }

  const pack = CREDIT_PACKS.find(p => p.id === packId)
  const priceId = STRIPE_PRICE_IDS[packId]
  if (!pack || !priceId) {
    return Response.json({ error: 'Pack no encontrado o no configurado' }, { status: 400 })
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

  try {
    const session = await getStripe().checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${siteUrl}/?credits_added=1`,
      cancel_url: `${siteUrl}/#precios`,
      metadata: {
        user_id: payload.sub,
        pack_id: pack.id,
        credits: String(pack.credits),
      },
      client_reference_id: payload.sub,
    })
    return Response.json({ url: session.url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al crear sesión de pago'
    return Response.json({ error: message }, { status: 500 })
  }
}
