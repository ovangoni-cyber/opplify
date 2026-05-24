import { ResultsDashboard } from '@/components/results/ResultsDashboard'

type Props = {
  searchParams: Promise<{ city?: string; business_type?: string }>
}

export default async function ResultsPage({ searchParams }: Props) {
  const params = await searchParams
  return (
    <ResultsDashboard
      city={params.city ?? ''}
      businessType={params.business_type ?? ''}
    />
  )
}
