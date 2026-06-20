'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { authClient } from '@/lib/auth-client'
import { AppHeader } from '@/components/AppHeader'
import { AppFooter } from '@/components/AppFooter'
import { useAuth } from '@/hooks/useAuth'
import { HistoryEntryRow, type HistoryEntry } from '@/components/history/HistoryEntryRow'

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
      <AppHeader>
        <Link href="/buscar" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          Nueva búsqueda
        </Link>
      </AppHeader>

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
            {entries.map((entry) => (
              <HistoryEntryRow key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </div>
      <AppFooter />
    </div>
  )
}
