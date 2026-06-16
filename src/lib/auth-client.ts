const TOKEN_KEY = 'auth_token'

export type AuthUser = {
  id: string
  email: string
  user_metadata: Record<string, unknown>
}

export type AuthSession = {
  access_token: string
  user: AuthUser
}

function decodeJwt(token: string): AuthUser | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return { id: payload.sub, email: payload.email, user_metadata: {} }
  } catch {
    return null
  }
}

export const authClient = {
  async getSession(): Promise<{ data: { session: AuthSession | null } }> {
    if (typeof window === 'undefined') return { data: { session: null } }
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) return { data: { session: null } }
    const user = decodeJwt(token)
    if (!user) return { data: { session: null } }
    return { data: { session: { access_token: token, user } } }
  },

  onAuthStateChange(
    callback: (event: string, session: AuthSession | null) => void
  ): { data: { subscription: { unsubscribe: () => void } } } {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ event: string; session: AuthSession | null }>).detail
      callback(detail.event, detail.session)
    }
    window.addEventListener('auth_change', handler)
    return {
      data: {
        subscription: { unsubscribe: () => window.removeEventListener('auth_change', handler) },
      },
    }
  },

  async signInWithPassword({
    email,
    password,
  }: {
    email: string
    password: string
  }): Promise<{ error: { message: string } | null }> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()
    if (!res.ok) return { error: { message: data.error ?? 'Error al iniciar sesión' } }
    localStorage.setItem(TOKEN_KEY, data.token)
    const user = decodeJwt(data.token)
    const session: AuthSession = { access_token: data.token, user: user! }
    window.dispatchEvent(
      new CustomEvent('auth_change', { detail: { event: 'SIGNED_IN', session } })
    )
    return { error: null }
  },

  async signUp({
    email,
    password,
    options,
  }: {
    email: string
    password: string
    options?: { data?: Record<string, unknown> }
  }): Promise<{ error: { message: string } | null }> {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, metadata: options?.data ?? {} }),
    })
    const data = await res.json()
    if (!res.ok) return { error: { message: data.error ?? 'Error al registrarse' } }
    return { error: null }
  },

  async signOut(): Promise<void> {
    localStorage.removeItem(TOKEN_KEY)
    window.dispatchEvent(
      new CustomEvent('auth_change', { detail: { event: 'SIGNED_OUT', session: null } })
    )
  },
}
