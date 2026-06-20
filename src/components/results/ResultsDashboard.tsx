'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAnalysisStream } from '@/hooks/useAnalysisStream'
import { useAuth } from '@/hooks/useAuth'
import { AnalysisStream } from './AnalysisStream'
import { AgencyLeadsStream } from './AgencyLeadsStream'
import { AppHeader } from '@/components/AppHeader'
import { AppFooter } from '@/components/AppFooter'
import type { AppMode } from '@/types/analysis'

type Props = {
  city: string
  businessType: string
  mode: AppMode
  fromHistory?: boolean
}

export function ResultsDashboard({ city, businessType, mode, fromHistory }: Props) {
  const router = useRouter()
  const { state, analyze } = useAnalysisStream()
  const { user, loading: authLoading } = useAuth()

  // Redirect if not authenticated once auth resolves
  useEffect(() => {
    if (authLoading) return
    if (!user) {
      const redirect = encodeURIComponent(window.location.pathname + window.location.search)
      router.push(`/auth/login?redirect=${redirect}`)
      return
    }
    if (city) {
      analyze({ city, business_type: businessType, mode, from_history: fromHistory })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, businessType, mode, fromHistory, user, authLoading])

  // Special error: no credits
  if (state.phase === 'error' && state.error === 'ERR_NO_CREDITS') {
    return (
      <div className="min-h-screen">
        <AppHeader>
          <ResultsHeaderInfo city={city} businessType={businessType} />
        </AppHeader>
        <div className="max-w-4xl mx-auto px-6 py-20 text-center space-y-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Sin créditos</p>
          <h2 className="font-heading text-2xl font-bold">No tienes créditos disponibles</h2>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Compra un pack para continuar analizando mercados y encontrando leads.
          </p>
          <Link
            href="/precios"
            className="btn-press inline-block mt-4 px-6 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            Ver precios →
          </Link>
        </div>
        <AppFooter />
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <AppHeader>
        <ResultsHeaderInfo city={city} businessType={businessType} />
      </AppHeader>
      <div className="max-w-4xl mx-auto px-6 py-10">
        {mode === 'agency_leads' ? (
          <AgencyLeadsStream state={state} city={city} businessType={businessType} />
        ) : (
          <AnalysisStream state={state} city={city} businessType={businessType} />
        )}
      </div>
      <AppFooter />
    </div>
  )
}

function ResultsHeaderInfo({
  city,
  businessType,
}: {
  city: string
  businessType: string
}) {
  return (
    <>
      {businessType && (
        <span className="text-xs text-muted-foreground capitalize hidden sm:block">{businessType}</span>
      )}
      <span className="font-heading font-semibold text-sm">{city}</span>
      <Link
        href="/"
        className="text-xs px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
      >
        ← Nueva búsqueda
      </Link>
    </>
  )
}
