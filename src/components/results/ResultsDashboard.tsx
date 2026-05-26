'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useAnalysisStream } from '@/hooks/useAnalysisStream'
import { AnalysisStream } from './AnalysisStream'
import { AgencyLeadsStream } from './AgencyLeadsStream'
import { Button } from '@/components/ui/button'
import type { AppMode } from '@/types/analysis'

type Props = {
  city: string
  businessType: string
  mode: AppMode
}

export function ResultsDashboard({ city, businessType, mode }: Props) {
  const { state, analyze } = useAnalysisStream()

  useEffect(() => {
    if (city) {
      analyze({ city, business_type: businessType, mode })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, businessType, mode])

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{city}</h1>
          {businessType && (
            <p className="text-muted-foreground capitalize">{businessType}</p>
          )}
        </div>
        <Button variant="outline" asChild>
          <Link href="/">Nueva búsqueda</Link>
        </Button>
      </div>

      {mode === 'agency_leads' ? (
        <AgencyLeadsStream state={state} />
      ) : (
        <AnalysisStream state={state} />
      )}
    </div>
  )
}
