// Server-only — never import this from client components
import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-05-27.dahlia',
})

// Pack definitions with server-side Price IDs
export const STRIPE_PRICE_IDS: Record<string, string> = {
  starter: process.env.STRIPE_PRICE_STARTER!,
  pro: process.env.STRIPE_PRICE_PRO!,
}
