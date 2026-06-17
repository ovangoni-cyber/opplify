import type { AppMode, AnalysisResult, AgencyLeadsResult } from '@/types/analysis'

type DownloadPdfPayload = {
  mode: AppMode
  city: string
  business_type: string | null
  result: AnalysisResult | AgencyLeadsResult
}

export async function downloadPdf(
  payload: DownloadPdfPayload,
  token: string | undefined
): Promise<{ error?: string }> {
  const res = await fetch('/api/export/pdf', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: data.error ?? 'No se pudo generar el PDF, intenta de nuevo.' }
  }

  const blob = await res.blob()
  const disposition = res.headers.get('content-disposition') ?? ''
  const match = disposition.match(/filename="([^"]+)"/)
  const filename = match?.[1] ?? 'opplify-export.pdf'

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 100)

  return {}
}
