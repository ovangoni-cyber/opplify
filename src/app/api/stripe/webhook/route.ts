import type { NextRequest } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { pool } from '@/lib/db'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const sig = req.headers.get('stripe-signature') ?? ''
  const secret = process.env.STRIPE_WEBHOOK_SECRET

  if (!secret) return Response.json({ error: 'Webhook no configurado' }, { status: 500 })

  let event
  try {
    event = getStripe().webhooks.constructEvent(rawBody, sig, secret)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Firma inválida'
    return Response.json({ error: message }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const userId = session.metadata?.user_id
    const creditsStr = session.metadata?.credits

    if (userId && creditsStr) {
      const credits = parseInt(creditsStr, 10)
      if (!isNaN(credits) && credits > 0) {
        await pool.query(
          `INSERT INTO user_credits (user_id, credits, updated_at) VALUES ($1, $2, now())
           ON CONFLICT (user_id) DO UPDATE SET credits = user_credits.credits + $2, updated_at = now()`,
          [userId, credits]
        )
      }
    }
  }

  return Response.json({ received: true })
}
