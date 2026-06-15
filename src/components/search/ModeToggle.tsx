'use client'

import type { AppMode } from '@/types/analysis'

type Props = {
  mode: AppMode
  onChange: (mode: AppMode) => void
}

export function ModeToggle({ mode, onChange }: Props) {
  return (
    <div className="flex rounded-lg border border-border bg-muted/50 p-1 gap-1 w-full">
      <button
        type="button"
        onClick={() => onChange('market_research')}
        className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all duration-200 ${
          mode === 'market_research'
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        Investigar mercado
      </button>
      <button
        type="button"
        onClick={() => onChange('agency_leads')}
        className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all duration-200 ${
          mode === 'agency_leads'
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        Buscar leads
      </button>
    </div>
  )
}
