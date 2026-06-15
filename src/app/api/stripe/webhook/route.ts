import type { NextRequest } from 'next/server'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const sig = req.headers.get('stripe-signature') ?? ''
  const secret = process.env.STRIPE_WEBHOOK_SECRET

  if (!secret) return Response.json({ error: 'Webhook no configurado' }, { status: 500 })

  let event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret)
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
        await supabaseAdmin.rpc('add_credits', { p_user_id: userId, p_amount: credits })
      }
    }
  }

  return Response.json({ received: true })
}
