'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'
import { useAuth } from '@/hooks/useAuth'
import { AppHeader } from '@/components/AppHeader'
import { AppFooter } from '@/components/AppFooter'
import { COUNTRIES } from '@/lib/countries'

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

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [dob, setDob] = useState('')
  const [phone, setPhone] = useState('')
  const [country, setCountry] = useState('')

  const [agencyName, setAgencyName] = useState('')
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

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
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}

        return Promise.all([
          fetch('/api/profile', { headers }).then((res) => res.json()),
          fetch('/api/branding', { headers }).then((res) => res.json()),
        ])
      })
      .then(([profile, branding]) => {
        setFirstName(profile.first_name ?? '')
        setLastName(profile.last_name ?? '')
        setDob(profile.dob ?? '')
        setPhone(profile.phone ?? '')
        setCountry(profile.country ?? '')
        setAgencyName(branding.agency_name ?? '')
        setLogoDataUrl(branding.logo ?? null)
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
    setErrorMsg('')

    if (newPassword && newPassword !== confirmPassword) {
      setErrorMsg('Las contraseñas no coinciden')
      setSaveStatus('error')
      return
    }
    if (newPassword && !currentPassword) {
      setErrorMsg('Falta la contraseña actual')
      setSaveStatus('error')
      return
    }

    setSaveStatus('saving')

    const { data: sessionData } = await authClient.getSession()
    const token = sessionData.session?.access_token
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }

    const profileRes = await fetch('/api/profile', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        first_name: firstName,
        last_name: lastName,
        dob,
        phone,
        country,
        current_password: currentPassword || undefined,
        new_password: newPassword || undefined,
      }),
    })
    const profileData = await profileRes.json()
    if (!profileRes.ok) {
      setErrorMsg(profileData.error ?? 'Error al guardar')
      setSaveStatus('error')
      return
    }

    const split = logoDataUrl ? splitDataUrl(logoDataUrl) : null
    const brandingRes = await fetch('/api/branding', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        agency_name: agencyName,
        logo_base64: split?.base64 ?? null,
        logo_mime: split?.mime ?? null,
      }),
    })
    const brandingData = await brandingRes.json()
    if (!brandingRes.ok) {
      setErrorMsg(brandingData.error ?? 'Perfil guardado, pero la marca no se pudo guardar')
      setSaveStatus('error')
      return
    }

    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setSaveStatus('saved')
  }

  if (loading) {
    return <div className="min-h-screen bg-background" />
  }

  return (
    <div className="min-h-screen">
      <AppHeader />

      <div className="max-w-sm mx-auto px-6 py-10">
        <h1 className="font-heading font-bold text-2xl tracking-tight mb-1" style={{ letterSpacing: '-0.02em' }}>
          Mis datos
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          Edita tu perfil, tu marca y tu contraseña.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              Perfil
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Nombre"
                required
                className={INPUT_CLASS}
              />
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Apellido"
                required
                className={INPUT_CLASS}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                Fecha de nacimiento
              </label>
              <input
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                required
                className={INPUT_CLASS}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                Teléfono
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+34 600 000 000"
                required
                className={INPUT_CLASS}
              />
            </div>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              required
              className={INPUT_CLASS}
            >
              <option value="" disabled>País</option>
              {COUNTRIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-4">
            <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              Marca
            </h2>
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
          </div>

          <div className="space-y-4">
            <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              Cambiar contraseña
            </h2>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Contraseña actual"
              autoComplete="current-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className={INPUT_CLASS}
            />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Nueva contraseña (déjalo en blanco para no cambiarla)"
              minLength={6}
              autoComplete="new-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className={INPUT_CLASS}
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirmar nueva contraseña"
              autoComplete="new-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className={INPUT_CLASS}
            />
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
      <AppFooter />
    </div>
  )
}
