// Server-only — never import this from client components
import Stripe from 'stripe'

let stripeInstance: Stripe | undefined

// Lazily constructed so importing this module doesn't require
// STRIPE_SECRET_KEY at build time (e.g. during `next build` in Docker).
export function getStripe(): Stripe {
  if (!stripeInstance) {
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2026-05-27.dahlia',
    })
  }
  return stripeInstance
}

// Pack definitions with server-side Price IDs
export const STRIPE_PRICE_IDS: Record<string, string> = {
  starter: process.env.STRIPE_PRICE_STARTER!,
  pro: process.env.STRIPE_PRICE_PRO!,
}
