'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAnalysisStream } from '@/hooks/useAnalysisStream'
import { useAuth } from '@/hooks/useAuth'
import { authClient } from '@/lib/auth-client'
import { AnalysisStream } from './AnalysisStream'
import { AgencyLeadsStream } from './AgencyLeadsStream'
import { ThemeSwitcher } from '@/components/ThemeSwitcher'
import { CreditsBadge } from '@/components/CreditsBadge'
import type { AppMode } from '@/types/analysis'

type Props = {
  city: string
  businessType: string
  mode: AppMode
}

export function ResultsDashboard({ city, businessType, mode }: Props) {
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
      analyze({ city, business_type: businessType, mode })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, businessType, mode, user, authLoading])

  const handleSignOut = async () => {
    await authClient.signOut()
    router.push('/')
  }

  // Special error: no credits
  if (state.phase === 'error' && state.error === 'ERR_NO_CREDITS') {
    return (
      <div className="min-h-screen">
        <Header city={city} businessType={businessType} email={user?.email} onSignOut={handleSignOut} />
        <div className="max-w-4xl mx-auto px-6 py-20 text-center space-y-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Sin créditos</p>
          <h2 className="font-heading text-2xl font-bold">No tienes créditos disponibles</h2>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Compra un pack para continuar analizando mercados y encontrando leads.
          </p>
          <Link
            href="/#precios"
            className="btn-press inline-block mt-4 px-6 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            Ver precios →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <Header city={city} businessType={businessType} email={user?.email} onSignOut={handleSignOut} />
      <div className="max-w-4xl mx-auto px-6 py-10">
        {mode === 'agency_leads' ? (
          <AgencyLeadsStream state={state} city={city} businessType={businessType} />
        ) : (
          <AnalysisStream state={state} />
        )}
      </div>
    </div>
  )
}

function Header({
  city,
  businessType,
  email,
  onSignOut,
}: {
  city: string
  businessType: string
  email: string | undefined
  onSignOut: () => void
}) {
  return (
    <div className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur-md">
      <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/" className="font-heading font-bold text-sm tracking-tight hover:text-primary transition-colors">
          Opplify<span className="text-primary">.</span>ai
        </Link>
        <div className="flex items-center gap-3">
          <ThemeSwitcher />
          <Link
            href="/ajustes"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors hidden sm:block"
          >
            Ajustes
          </Link>
          <Link
            href="/historial"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors hidden sm:block"
          >
            Historial
          </Link>
          {businessType && (
            <span className="text-xs text-muted-foreground capitalize hidden sm:block">{businessType}</span>
          )}
          <span className="font-heading font-semibold text-sm">{city}</span>
          <CreditsBadge />
          <Link
            href="/"
            className="text-xs px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
          >
            ← Nueva búsqueda
          </Link>
          {email && (
            <div className="flex items-center gap-2 border border-border rounded-full pl-1 pr-3 py-0.5">
              <span className="h-5 w-5 rounded-full bg-primary/15 text-primary text-[10px] font-semibold flex items-center justify-center shrink-0">
                {email[0].toUpperCase()}
              </span>
              <span className="text-xs text-muted-foreground hidden sm:block truncate max-w-[140px]">
                {email}
              </span>
            </div>
          )}
          <button
            onClick={onSignOut}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Salir
          </button>
        </div>
      </div>
    </div>
  )
}
