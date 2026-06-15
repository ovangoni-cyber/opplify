// Safe to import from client components — no Stripe SDK dependency
export const CREDIT_PACKS = [
  {
    id: 'starter' as const,
    name: 'Starter',
    credits: 5,
    priceEur: 9,
    description: '€1.80 por análisis',
  },
  {
    id: 'pro' as const,
    name: 'Pro',
    credits: 20,
    priceEur: 29,
    description: '€1.45 por análisis',
    featured: true,
  },
]

export type PackId = 'starter' | 'pro'
