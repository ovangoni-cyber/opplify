'use client'

import { useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabaseBrowser } from '@/lib/supabase-browser'

export default function LoginPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const redirect = searchParams.get('redirect') || '/buscar'

  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

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
      const { error } = await supabaseBrowser.auth.signUp({ email, password })
      if (error) {
        setErrorMsg(error.message)
        setStatus('error')
      } else {
        // Auto sign in after register
        await supabaseBrowser.auth.signInWithPassword({ email, password })
        router.replace(redirect)
      }
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="block font-heading font-bold text-base tracking-tight mb-12">
          oportunity<span className="text-primary">.</span>ai
        </Link>

        {/* Tab toggle */}
        <div className="flex rounded-lg border border-border overflow-hidden mb-6">
          {(['login', 'register'] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setErrorMsg('') }}
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
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Email"
            required
            autoFocus
            className="w-full px-3 py-2.5 rounded-lg border border-border bg-input text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 transition-colors"
          />
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Contraseña"
            required
            minLength={6}
            className="w-full px-3 py-2.5 rounded-lg border border-border bg-input text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 transition-colors"
          />

          {errorMsg && (
            <p className="text-xs text-rose-400">{errorMsg}</p>
          )}

          <button
            type="submit"
            disabled={status === 'loading'}
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
