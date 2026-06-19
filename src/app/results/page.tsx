import { ResultsDashboard } from '@/components/results/ResultsDashboard'
import type { AppMode } from '@/types/analysis'

type Props = {
  searchParams: Promise<{ city?: string; business_type?: string; mode?: string; from_history?: string }>
}

export default async function ResultsPage({ searchParams }: Props) {
  const params = await searchParams
  const mode: AppMode = params.mode === 'agency_leads' ? 'agency_leads' : 'market_research'
  return (
    <ResultsDashboard
      city={params.city ?? ''}
      businessType={params.business_type ?? ''}
      mode={mode}
      fromHistory={params.from_history === '1'}
    />
  )
}
