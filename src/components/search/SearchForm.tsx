'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { SearchParams } from '@/types/analysis'

type Props = {
  onSubmit: (params: SearchParams) => void
  loading?: boolean
}

export function SearchForm({ onSubmit, loading }: Props) {
  const [city, setCity] = useState('')
  const [businessType, setBusinessType] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!city.trim()) return
    onSubmit({ city: city.trim(), business_type: businessType.trim() })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm">
      <div className="space-y-1.5">
        <label htmlFor="city" className="text-sm font-medium">
          Ciudad <span className="text-red-500">*</span>
        </label>
        <Input
          id="city"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="ej. Buenos Aires, Madrid, Ciudad de México"
          required
          disabled={loading}
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="business-type" className="text-sm font-medium">
          Tipo de negocio{' '}
          <span className="text-muted-foreground font-normal">(opcional)</span>
        </label>
        <Input
          id="business-type"
          value={businessType}
          onChange={(e) => setBusinessType(e.target.value)}
          placeholder="ej. restaurante, gym, cafetería, peluquería"
          disabled={loading}
        />
      </div>
      <Button type="submit" disabled={loading || !city.trim()} className="w-full">
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Analizando...
          </span>
        ) : (
          'Analizar mercado'
        )}
      </Button>
    </form>
  )
}
