'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { SearchForm } from '@/components/search/SearchForm'
import { ModeToggle } from '@/components/search/ModeToggle'
import type { SearchParams, AppMode } from '@/types/analysis'

export default function BuscarPage() {
  const router = useRouter()
  const [mode, setMode] = useState<AppMode>('market_research')

  const handleSubmit = (params: SearchParams) => {
    const qs = new URLSearchParams({ city: params.city, mode: params.mode })
    if (params.business_type) qs.set('business_type', params.business_type)
    router.push(`/results?${qs.toString()}`)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm space-y-6">
        <Link href="/" className="block font-heading font-bold text-base tracking-tight">
          oportunity<span className="text-primary">.</span>ai
        </Link>
        <div>
          <h1 className="font-heading font-bold text-2xl tracking-tight mb-1" style={{ letterSpacing: '-0.02em' }}>
            Nueva búsqueda
          </h1>
          <p className="text-sm text-muted-foreground">
            Elige un modo y analiza tu mercado en segundos.
          </p>
        </div>
        <div className="space-y-3">
          <ModeToggle mode={mode} onChange={setMode} />
          <SearchForm mode={mode} onSubmit={handleSubmit} />
        </div>
      </div>
    </div>
  )
}
