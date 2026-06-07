'use client'

import { useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabaseBrowser } from '@/lib/supabase-browser'

const COUNTRIES = [
  { value: 'AR', label: 'Argentina' },
  { value: 'BO', label: 'Bolivia' },
  { value: 'BR', label: 'Brasil' },
  { value: 'CA', label: 'Canadá' },
  { value: 'CL', label: 'Chile' },
  { value: 'CO', label: 'Colombia' },
  { value: 'CR', label: 'Costa Rica' },
  { value: 'CU', label: 'Cuba' },
  { value: 'DO', label: 'República Dominicana' },
  { value: 'EC', label: 'Ecuador' },
  { value: 'SV', label: 'El Salvador' },
  { value: 'ES', label: 'España' },
  { value: 'US', label: 'Estados Unidos' },
  { value: 'GT', label: 'Guatemala' },
  { value: 'HN', label: 'Honduras' },
  { value: 'MX', label: 'México' },
  { value: 'NI', label: 'Nicaragua' },
  { value: 'PA', label: 'Panamá' },
  { value: 'PY', label: 'Paraguay' },
  { value: 'PE', label: 'Perú' },
  { value: 'PT', label: 'Portugal' },
  { value: 'PR', label: 'Puerto Rico' },
  { value: 'UY', label: 'Uruguay' },
  { value: 'VE', label: 'Venezuela' },
  { value: 'DE', label: 'Alemania' },
  { value: 'FR', label: 'Francia' },
  { value: 'GB', label: 'Reino Unido' },
  { value: 'IT', label: 'Italia' },
  { value: 'NL', label: 'Países Bajos' },
  { value: 'CH', label: 'Suiza' },
  { value: 'AU', label: 'Australia' },
  { value: 'JP', label: 'Japón' },
  { value: 'OTHER', label: 'Otro' },
]

const INPUT_CLASS =
  'w-full px-3 py-2.5 rounded-lg border border-border bg-input text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 transition-colors'

export default function LoginPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const redirect = searchParams.get('redirect') || '/buscar'

  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  // Shared
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // Register-only
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [dob, setDob] = useState('')
  const [phone, setPhone] = useState('')
  const [country, setCountry] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading')
    setErrorMsg('')

    if (tab === 'login') {
      const { error } = await supabaseBrowser.auth.signInWithPassword({ email, password })
      if (error) {
        setErrorMsg('Email o contraseña incorrectos')
        setStatus('error')
      } else {
        router.replace(redirect)
      }
    } else {
      const { error } = await supabaseBrowser.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            dob,
            phone,
            country,
          },
        },
      })
      if (error) {
        setErrorMsg(error.message)
        setStatus('error')
      } else {
        const { error: signInError } = await supabaseBrowser.auth.signInWithPassword({ email, password })
        if (signInError) {
          setErrorMsg('Cuenta creada. Iniciá sesión manualmente.')
          setStatus('error')
        } else {
          router.replace(redirect)
        }
      }
    }
  }

  const switchTab = (t: 'login' | 'register') => {
    setTab(t)
    setErrorMsg('')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-sm">
        <Link href="/" className="block font-heading font-bold text-base tracking-tight mb-12">
          oportunity<span className="text-primary">.</span>ai
        </Link>

        {/* Tab toggle */}
        <div className="flex rounded-lg border border-border overflow-hidden mb-6">
          {(['login', 'register'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => switchTab(t)}
              className={`flex-1 py-2 text-xs font-medium transition-colors ${
                tab === t
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Register-only fields */}
          {tab === 'register' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  placeholder="Nombre"
                  required
                  className={INPUT_CLASS}
                />
                <input
                  type="text"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  placeholder="Apellido"
                  required
                  className={INPUT_CLASS}
                />
              </div>
            </>
          )}

          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Email"
            required
            autoFocus={tab === 'login'}
            className={INPUT_CLASS}
          />
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Contraseña"
            required
            minLength={6}
            className={INPUT_CLASS}
          />

          {tab === 'register' && (
            <>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                  Fecha de nacimiento
                </label>
                <input
                  type="date"
                  value={dob}
                  onChange={e => setDob(e.target.value)}
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
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+34 600 000 000"
                  required
                  className={INPUT_CLASS}
                />
              </div>
              <select
                value={country}
                onChange={e => setCountry(e.target.value)}
                required
                className={INPUT_CLASS}
              >
                <option value="" disabled>País</option>
                {COUNTRIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={e => setTermsAccepted(e.target.checked)}
                  className="mt-0.5 h-3.5 w-3.5 rounded border-border accent-primary"
                />
                <span className="text-xs text-muted-foreground leading-relaxed">
                  Acepto los{' '}
                  <a href="/terms" target="_blank" className="text-primary underline underline-offset-2">
                    Términos de uso
                  </a>{' '}
                  y la{' '}
                  <a href="/privacy" target="_blank" className="text-primary underline underline-offset-2">
                    Política de privacidad
                  </a>
                </span>
              </label>
            </>
          )}

          {errorMsg && (
            <p className="text-xs text-rose-400">{errorMsg}</p>
          )}

          <button
            type="submit"
            disabled={status === 'loading' || (tab === 'register' && !termsAccepted)}
            className="btn-press w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {status === 'loading'
              ? 'Cargando...'
              : tab === 'login' ? 'Entrar' : 'Crear cuenta'}
          </button>
        </form>
      </div>
    </div>
  )
}
