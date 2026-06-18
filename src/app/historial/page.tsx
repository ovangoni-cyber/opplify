'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { authClient } from '@/lib/auth-client'
import { ThemeSwitcher } from '@/components/ThemeSwitcher'
import { CreditsBadge } from '@/components/CreditsBadge'
import { NavMenu } from '@/components/NavMenu'
import { useAuth } from '@/hooks/useAuth'

type HistoryEntry = {
  id: string
  city: string
  business_type: string | null
  mode: string
  created_at: string
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.max(0, Math.floor(diff / 60000))
  if (mins < 60) return `hace ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `hace ${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'ayer'
  if (days < 7) return `hace ${days} días`
  return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short' })
}

function ModeBadge({ mode }: { mode: string }) {
  if (mode === 'agency_leads') {
    return (
      <span className="text-[9px] uppercase tracking-[0.12em] font-medium px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
        Leads
      </span>
    )
  }
  return (
    <span className="text-[9px] uppercase tracking-[0.12em] font-medium px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
      Investigación
    </span>
  )
}

export default function HistorialPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace('/auth/login?redirect=/historial')
      return
    }

    authClient.getSession().then(({ data: sessionData }) => {
      const token = sessionData.session?.access_token
      return fetch('/api/history', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
    }).then(async (res) => {
      if (!res.ok) throw new Error('fetch failed')
      const data: HistoryEntry[] = await res.json()
      console.log('[historial] loaded', data.length, 'entries for user', user?.id)
      setEntries(data)
      setLoading(false)
    }).catch((err) => {
      console.error('[historial] catch:', err)
      setLoadError(true)
      setLoading(false)
    })
  }, [user, authLoading, router])

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="font-heading font-bold text-sm tracking-tight hover:text-primary transition-colors">
            Opplify<span className="text-primary">.</span>ai
          </Link>
          <div className="flex items-center gap-3">
            <ThemeSwitcher />
            <Link href="/buscar" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Nueva búsqueda
            </Link>
            <CreditsBadge />
            {user?.email && (
              <div className="flex items-center gap-2 border border-border rounded-full pl-1 pr-3 py-0.5">
                <span className="h-5 w-5 rounded-full bg-primary/15 text-primary text-[10px] font-semibold flex items-center justify-center shrink-0">
                  {user.email[0].toUpperCase()}
                </span>
                <span className="text-xs text-muted-foreground hidden sm:block truncate max-w-[140px]">
                  {user.email}
                </span>
              </div>
            )}
            <NavMenu />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center gap-3 mb-8">
          <h1 className="font-heading font-bold text-2xl tracking-tight" style={{ letterSpacing: '-0.02em' }}>
            Mis análisis
          </h1>
          {!loading && entries.length > 0 && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
              {entries.length}
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : loadError ? (
          <div className="text-center py-20">
            <p className="text-sm text-muted-foreground">No se pudo cargar el historial. Intentá de nuevo.</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-20 space-y-4">
            <p className="text-sm text-muted-foreground">Todavía no hiciste ningún análisis.</p>
            <Link
              href="/buscar"
              className="inline-block px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              Hacer mi primer análisis →
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
            {entries.map((entry) => {
              const qs = new URLSearchParams({ city: entry.city, mode: entry.mode })
              if (entry.business_type) qs.set('business_type', entry.business_type)
              return (
                <div key={entry.id} className="flex items-center justify-between gap-4 px-5 py-4 bg-card hover:bg-muted/30 transition-colors">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-foreground capitalize">{entry.city}</span>
                      {entry.business_type && (
                        <span className="text-xs text-muted-foreground capitalize">· {entry.business_type}</span>
                      )}
                      <ModeBadge mode={entry.mode} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{relativeTime(entry.created_at)}</p>
                  </div>
                  <Link
                    href={`/results?${qs.toString()}`}
                    className="text-xs font-medium text-primary hover:text-primary/80 transition-colors whitespace-nowrap shrink-0"
                  >
                    Ver análisis →
                  </Link>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
