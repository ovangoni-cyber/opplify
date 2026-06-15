'use client'

import { useEffect, useState } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabaseBrowser } from '@/lib/supabase-browser'

export type AuthState = {
  user: User | null
  session: Session | null
  loading: boolean
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ user: null, session: null, loading: true })

  useEffect(() => {
    supabaseBrowser.auth.getSession().then(({ data }) => {
      setState({ user: data.session?.user ?? null, session: data.session, loading: false })
    })

    const { data: { subscription } } = supabaseBrowser.auth.onAuthStateChange((_, session) => {
      setState({ user: session?.user ?? null, session, loading: false })
    })

    return () => subscription.unsubscribe()
  }, [])

  return state
}
