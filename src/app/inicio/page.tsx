'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { authClient } from '@/lib/auth-client'
import { AppHeader } from '@/components/AppHeader'
import { AppFooter } from '@/components/AppFooter'
import { useAuth } from '@/hooks/useAuth'
import { HistoryEntryRow, type HistoryEntry } from '@/components/history/HistoryEntryRow'

export default function InicioPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [credits, setCredits] = useState<number | null>(null)
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace('/auth/login?redirect=/inicio')
      return
    }

    authClient.getSession().then(({ data: sessionData }) => {
      const token = sessionData.session?.access_token
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}

      fetch('/api/credits', { headers })
        .then((r) => r.json())
        .then((d) => setCredits(typeof d.credits === 'number' ? d.credits : null))
        .catch(() => {})

      fetch('/api/history', { headers })
        .then(async (res) => {
          if (!res.ok) throw new Error('fetch failed')
          const data: HistoryEntry[] = await res.json()
          setEntries(data)
          setHistoryLoading(false)
        })
        .catch(() => {
          setHistoryError(true)
          setHistoryLoading(false)
        })
    })
  }, [user, authLoading, router])

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  const recentEntries = entries.slice(0, 5)

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader>
        <Link href="/precios" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          Más créditos
        </Link>
      </AppHeader>

      <div className="flex-1 max-w-4xl mx-auto px-6 py-10 w-full">
        <h1 className="font-heading font-bold text-2xl tracking-tight mb-1" style={{ letterSpacing: '-0.02em' }}>
          Hola de nuevo
        </h1>
        <p className="text-sm text-muted-foreground mb-8">{user.email}</p>

        <div className="grid sm:grid-cols-2 gap-4 mb-10">
          <div className="rounded-xl border border-border bg-card p-6">
            <p className="text-[10px] text-muted-foreground uppercase tracking-[0.15em] mb-1">Créditos disponibles</p>
            <p className="font-heading font-bold text-4xl tabular-nums">{credits ?? '—'}</p>
            {credits === 0 && (
              <Link href="/precios" className="text-xs text-primary hover:text-primary/80 transition-colors mt-2 inline-block">
                Comprar más créditos →
              </Link>
            )}
          </div>
          <Link
            href="/buscar"
            className="btn-press rounded-xl border border-primary/30 bg-primary/[0.04] p-6 flex flex-col justify-center items-start gap-1 hover:bg-primary/[0.08] transition-colors"
          >
            <span className="font-heading font-bold text-lg">Nueva búsqueda →</span>
            <span className="text-xs text-muted-foreground">Analiza un mercado o busca leads</span>
          </Link>
        </div>

        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading font-bold text-lg tracking-tight">Análisis recientes</h2>
          {entries.length > 5 && (
            <Link href="/historial" className="text-xs text-primary hover:text-primary/80 transition-colors">
              Ver todos →
            </Link>
          )}
        </div>

        {historyLoading ? (
          <div className="flex items-center justify-center py-16">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : historyError ? (
          <p className="text-sm text-muted-foreground text-center py-16">No se pudo cargar el historial. Intentá de nuevo.</p>
        ) : recentEntries.length === 0 ? (
          <div className="text-center py-16 space-y-4">
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
            {recentEntries.map((entry) => (
              <HistoryEntryRow key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </div>

      <AppFooter />
    </div>
  )
}
