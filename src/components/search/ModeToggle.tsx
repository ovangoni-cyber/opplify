'use client'

import type { AppMode } from '@/types/analysis'

type Props = {
  mode: AppMode
  onChange: (mode: AppMode) => void
}

export function ModeToggle({ mode, onChange }: Props) {
  return (
    <div className="flex rounded-lg border bg-muted p-1 gap-1 w-full max-w-sm">
      <button
        type="button"
        onClick={() => onChange('market_research')}
        className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
          mode === 'market_research'
            ? 'bg-background shadow text-foreground'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        Investigar mercado
      </button>
      <button
        type="button"
        onClick={() => onChange('agency_leads')}
        className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
          mode === 'agency_leads'
            ? 'bg-background shadow text-foreground'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        Buscar leads
      </button>
    </div>
  )
}
