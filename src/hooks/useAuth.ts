'use client'

import { useEffect, useState } from 'react'
import { authClient, type AuthUser, type AuthSession } from '@/lib/auth-client'

export type AuthState = {
  user: AuthUser | null
  session: AuthSession | null
  loading: boolean
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ user: null, session: null, loading: true })

  useEffect(() => {
    authClient.getSession().then(({ data }) => {
      setState({
        user: data.session?.user ?? null,
        session: data.session,
        loading: false,
      })
    })

    const { data: { subscription } } = authClient.onAuthStateChange((_, session) => {
      setState({ user: session?.user ?? null, session, loading: false })
    })

    return () => subscription.unsubscribe()
  }, [])

  return state
}
