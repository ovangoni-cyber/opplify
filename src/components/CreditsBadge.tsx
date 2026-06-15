'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'

export function CreditsBadge() {
  const { session } = useAuth()
  const [credits, setCredits] = useState<number | null>(null)

  useEffect(() => {
    if (!session?.access_token) return
    fetch('/api/credits', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(r => r.json())
      .then(d => setCredits(typeof d.credits === 'number' ? d.credits : null))
      .catch(() => {})
  }, [session])

  if (credits === null) return null

  return (
    <span className="text-xs tabular-nums text-muted-foreground border border-border px-2 py-0.5 rounded">
      {credits} {credits === 1 ? 'crédito' : 'créditos'}
    </span>
  )
}
