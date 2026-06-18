'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { authClient } from '@/lib/auth-client'
import { useAuth } from '@/hooks/useAuth'
import { ThemeSwitcher } from '@/components/ThemeSwitcher'
import { CreditsBadge } from '@/components/CreditsBadge'
import { NavMenu } from '@/components/NavMenu'

const INPUT_CLASS =
  'w-full px-3 py-2.5 rounded-lg border border-border bg-input text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 transition-colors'

function splitDataUrl(dataUrl: string): { mime: string; base64: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) return null
  return { mime: match[1], base64: match[2] }
}

export default function AjustesPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [agencyName, setAgencyName] = useState('')
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace('/auth/login?redirect=/ajustes')
      return
    }

    authClient
      .getSession()
      .then(({ data: sessionData }) => {
        const token = sessionData.session?.access_token
        return fetch('/api/branding', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
      })
      .then(async (res) => {
        const data = await res.json()
        setAgencyName(data.agency_name ?? '')
        setLogoDataUrl(data.logo ?? null)
        setLoading(false)
      })
      .catch(() => {
        setLoading(false)
      })
  }, [user, authLoading, router])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setLogoDataUrl(reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaveStatus('saving')
    setErrorMsg('')

    const split = logoDataUrl ? splitDataUrl(logoDataUrl) : null
    const { data: sessionData } = await authClient.getSession()
    const token = sessionData.session?.access_token

    const res = await fetch('/api/branding', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        agency_name: agencyName,
        logo_base64: split?.base64 ?? null,
        logo_mime: split?.mime ?? null,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      setErrorMsg(data.error ?? 'Error al guardar')
      setSaveStatus('error')
    } else {
      setSaveStatus('saved')
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-background" />
  }

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="font-heading font-bold text-sm tracking-tight hover:text-primary transition-colors">
            Opplify<span className="text-primary">.</span>ai
          </Link>
          <div className="flex items-center gap-3">
            <ThemeSwitcher />
            <CreditsBadge />
            <NavMenu />
          </div>
        </div>
      </div>

      <div className="max-w-sm mx-auto px-6 py-10">
        <h1 className="font-heading font-bold text-2xl tracking-tight mb-1" style={{ letterSpacing: '-0.02em' }}>
          Ajustes de marca
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          Tu logo y nombre de agencia aparecerán en los PDFs que exportes.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              Nombre de agencia
            </label>
            <input
              type="text"
              value={agencyName}
              onChange={(e) => setAgencyName(e.target.value)}
              placeholder="Mi Agencia Digital"
              className={INPUT_CLASS}
            />
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              Logo (PNG o JPG, máx. 1MB)
            </label>
            {logoDataUrl && (
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoDataUrl} alt="Logo actual" className="h-12 w-12 object-contain rounded border border-border" />
                <button
                  type="button"
                  onClick={() => setLogoDataUrl(null)}
                  className="text-xs text-rose-400 hover:text-rose-300 transition-colors"
                >
                  Quitar logo
                </button>
              </div>
            )}
            <input type="file" accept="image/png,image/jpeg" onChange={handleFileChange} className={INPUT_CLASS} />
          </div>

          {errorMsg && <p className="text-xs text-rose-400">{errorMsg}</p>}
          {saveStatus === 'saved' && <p className="text-xs text-primary">Guardado correctamente.</p>}

          <button
            type="submit"
            disabled={saveStatus === 'saving'}
            className="btn-press w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {saveStatus === 'saving' ? 'Guardando...' : 'Guardar'}
          </button>
        </form>
      </div>
    </div>
  )
}
