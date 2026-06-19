'use client'

import { type ReactNode } from 'react'
import Link from 'next/link'
import { ThemeSwitcher } from '@/components/ThemeSwitcher'
import { CreditsBadge } from '@/components/CreditsBadge'
import { NavMenu } from '@/components/NavMenu'
import { useAuth } from '@/hooks/useAuth'

export function AppHeader({ children }: { children?: ReactNode }) {
  const { user } = useAuth()

  return (
    <div className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur-md">
      <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/" className="font-heading font-bold text-sm tracking-tight hover:text-primary transition-colors">
          Opplify<span className="text-primary">.</span>ai
        </Link>
        <div className="flex items-center gap-3">
          <ThemeSwitcher />
          {children}
          {user ? (
            <>
              <CreditsBadge />
              {user.email && (
                <div className="flex items-center gap-2 border border-border rounded-full pl-1 pr-3 py-0.5">
                  <span className="h-5 w-5 rounded-full bg-primary/15 text-primary text-[10px] font-semibold flex items-center justify-center shrink-0">
                    {user.email[0].toUpperCase()}
                  </span>
                  <span className="text-xs text-muted-foreground hidden sm:block truncate max-w-[140px]">
                    {user.email}
                  </span>
                </div>
              )}
              <NavMenu />
            </>
          ) : (
            <a
              href="/auth/login"
              className="btn-press text-xs font-medium px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Acceder
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
