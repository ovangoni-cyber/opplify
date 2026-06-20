'use client'

import Link from 'next/link'

export type HistoryEntry = {
  id: string
  city: string
  business_type: string | null
  mode: string
  created_at: string
}

export function relativeTime(iso: string): string {
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

export function ModeBadge({ mode }: { mode: string }) {
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

export function HistoryEntryRow({ entry }: { entry: HistoryEntry }) {
  const qs = new URLSearchParams({ city: entry.city, mode: entry.mode })
  if (entry.business_type) qs.set('business_type', entry.business_type)
  qs.set('from_history', '1')

  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4 bg-card hover:bg-muted/30 transition-colors">
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
}
