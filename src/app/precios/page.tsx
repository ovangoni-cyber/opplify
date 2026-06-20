'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppHeader } from '@/components/AppHeader'
import { AppFooter } from '@/components/AppFooter'
import { useAuth } from '@/hooks/useAuth'
import { CREDIT_PACKS } from '@/lib/credit-packs'

export default function PreciosPage() {
  const router = useRouter()
  const { user, session } = useAuth()
  const [buyingPack, setBuyingPack] = useState<string | null>(null)
  const [buyError, setBuyError] = useState<string | null>(null)

  const handleBuy = async (packId: string) => {
    setBuyError(null)
    if (!user || !session?.access_token) {
      router.push(`/auth/login?redirect=${encodeURIComponent('/precios')}`)
      return
    }
    setBuyingPack(packId)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ packId }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setBuyError(data.error ?? 'Error al iniciar el pago')
      }
    } catch {
      setBuyError('Error de conexión')
    } finally {
      setBuyingPack(null)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <div className="flex-1 px-6 py-16">
        <div className="max-w-3xl mx-auto">
          <div className="mb-12 text-center">
            <h1 className="font-heading text-3xl font-bold tracking-tight mb-3" style={{ letterSpacing: '-0.02em' }}>
              Paga solo lo que usas
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Sin suscripciones. Compras créditos y los usas cuando quieras.
            </p>
            <p className="text-xs text-muted-foreground mt-3">1 análisis de prueba al registrarte.</p>
          </div>
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              {CREDIT_PACKS.map((pack) => (
                <div
                  key={pack.id}
                  className={`rounded-xl border p-6 flex flex-col gap-6 ${
                    pack.featured
                      ? 'border-primary/30 bg-primary/[0.04]'
                      : 'border-border bg-card'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground uppercase tracking-[0.15em]">{pack.name}</span>
                      {pack.featured && (
                        <span className="text-[9px] uppercase tracking-[0.15em] text-primary border border-primary/25 px-1.5 py-0.5 rounded">
                          Popular
                        </span>
                      )}
                    </div>
                    <p className="font-heading font-bold text-4xl tabular-nums">€{pack.priceEur}</p>
                    <p className="text-xs text-muted-foreground">{pack.credits} análisis · {pack.description}</p>
                  </div>
                  <button
                    onClick={() => handleBuy(pack.id)}
                    disabled={buyingPack === pack.id}
                    className={`btn-press w-full py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60 ${
                      pack.featured
                        ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                        : 'border border-border text-foreground hover:border-foreground/30'
                    }`}
                  >
                    {buyingPack === pack.id ? '...' : 'Comprar'}
                  </button>
                </div>
              ))}
            </div>
            {buyError && (
              <p className="text-xs text-rose-400 text-center">{buyError}</p>
            )}
            <p className="text-xs text-muted-foreground text-center">Pago único · Sin renovación automática</p>
          </div>
        </div>
      </div>
      <AppFooter />
    </div>
  )
}
