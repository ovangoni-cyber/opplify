'use client'

import { useRouter } from 'next/navigation'
import { SearchForm } from '@/components/search/SearchForm'
import type { SearchParams } from '@/types/analysis'

export default function HomePage() {
  const router = useRouter()

  const handleSubmit = (params: SearchParams) => {
    const qs = new URLSearchParams({ city: params.city })
    if (params.business_type) qs.set('business_type', params.business_type)
    router.push(`/results?${qs.toString()}`)
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-10 p-8">
      <div className="text-center space-y-3 max-w-lg">
        <h1 className="text-4xl font-bold tracking-tight">Local Opportunity Finder</h1>
        <p className="text-muted-foreground text-lg">
          Detecta oportunidades de negocio locales analizando datos reales de Google Places con IA
        </p>
      </div>
      <SearchForm onSubmit={handleSubmit} />
      <p className="text-xs text-muted-foreground">
        Powered by Google Places + Claude AI
      </p>
    </div>
  )
}
