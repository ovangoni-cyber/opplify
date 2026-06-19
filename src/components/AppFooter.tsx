'use client'

export function AppFooter() {
  return (
    <footer className="section-divider py-12 px-6">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <span className="font-heading font-bold text-sm tracking-tight">
          Opplify<span className="text-primary">.</span>ai
        </span>
        <p className="text-xs text-muted-foreground">
          Google Places · Claude AI · {new Date().getFullYear()}
        </p>
      </div>
    </footer>
  )
}
