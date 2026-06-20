const MESSAGES = [
  'Buscando negocios cercanos...',
  'Leyendo reseñas y valoraciones...',
  'Detectando oportunidades de mercado...',
  'Generando tu informe...',
]

export function SearchLoadingState() {
  return (
    <div className="rounded-xl border border-border bg-card px-6 py-8">
      <div className="search-loading-map">
        <span className="search-loading-pin" style={{ top: '24%', left: '14%', animationDelay: '0s' }} />
        <span className="search-loading-pin" style={{ top: '58%', left: '36%', animationDelay: '0.5s' }} />
        <span className="search-loading-pin" style={{ top: '16%', left: '62%', animationDelay: '1s' }} />
        <span className="search-loading-pin" style={{ top: '62%', left: '82%', animationDelay: '1.5s' }} />
      </div>
      <div className="flex items-center justify-center gap-2.5 mt-5">
        <span className="search-loading-dots">
          <span /><span /><span />
        </span>
        <span className="search-loading-cycle-text">
          {MESSAGES.map((msg, i) => (
            <span key={msg} style={{ animationDelay: `${-((MESSAGES.length - i) % MESSAGES.length) * 2}s` }}>
              {msg}
            </span>
          ))}
        </span>
      </div>
    </div>
  )
}
