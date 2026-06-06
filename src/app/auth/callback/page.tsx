'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase-browser'

export default function AuthCallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const redirect = searchParams.get('redirect') || '/buscar'

    // Check immediately — Supabase may already have parsed the hash fragment
    supabaseBrowser.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.replace(redirect)
        return
      }

      // Otherwise wait for SIGNED_IN from URL hash processing
      const { data: { subscription } } = supabaseBrowser.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_IN') {
          subscription.unsubscribe()
          router.replace(redirect)
        }
      })
    })
  }, [router, searchParams])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex items-center gap-3 text-muted-foreground">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="text-sm">Iniciando sesión...</span>
      </div>
    </div>
  )
}
