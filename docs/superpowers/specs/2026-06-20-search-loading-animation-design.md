# Animación de carga durante la búsqueda — Design

## Context

Hoy, mientras se espera el resultado de un análisis, cada modo muestra su propio bloque de espera inline:

- `src/components/results/AnalysisStream.tsx`: fase `loading` → spinner pequeño + "Obteniendo datos del mercado..." (líneas 45-52). Fase `streaming_json` → bloques esqueleto con `animate-pulse` (líneas 75-94). La fase `streaming_summary` ya muestra texto real (el resumen llegando palabra por palabra) y no necesita cambios.
- `src/components/results/AgencyLeadsStream.tsx`: fases `loading`, `streaming_summary` y `streaming_json` muestran el mismo spinner + "Analizando prospectos..." (líneas 67-74) — este modo no renderiza ningún texto en streaming, así que ese spinner cubre toda la espera.

Ambos se sienten estáticos para una espera que dura 30-60 segundos. El objetivo es sustituirlos por una animación más viva, validada visualmente con el usuario: un mapa con pines apareciendo en bucle, combinado con puntos pulsantes y un texto que rota entre varias frases de progreso.

## Scope

- Un componente nuevo, autocontenido y sin props, reutilizado por ambos modos.
- Sustituye los bloques de espera "vacíos" (sin contenido real todavía) descritos arriba.
- Fuera de alcance: la fase `streaming_summary` de `market_research` (ya muestra contenido real, no se toca) y cualquier indicador de progreso real/porcentual (la animación es puramente decorativa, no refleja avance real del pipeline).
- Sin tests nuevos — es UI pura sin lógica, fuera del criterio de `CLAUDE.md` ("solo funciones puras se testean").

## Diseño

### Componente: `src/components/results/SearchLoadingState.tsx`

Cliente (`'use client'` no es necesario — no usa hooks ni estado, es JSX + CSS puro, pero vive junto a los demás componentes de `results/` que sí lo son). Sin props:

```tsx
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
```

Nota sobre los `animationDelay` del texto rotativo: cada `<span>` comparte la misma animación `cycle-text` de 8s (4 mensajes × 2s) pero con un retraso negativo distinto, de forma que cada uno queda visible durante su tramo de 2s y los demás en opacidad 0 — la misma técnica CSS ya validada en la maqueta aprobada (sin JavaScript, sin `setInterval`).

### CSS nuevo en `src/app/globals.css`

Se añade después del bloque `/* ── Stagger list ── */` (línea 178) una nueva sección:

```css
/* ── Search loading state ── */
.search-loading-map {
  position: relative;
  height: 130px;
  border-radius: 10px;
  background:
    linear-gradient(var(--border) 1px, transparent 1px) 0 0 / 20px 20px,
    linear-gradient(90deg, var(--border) 1px, transparent 1px) 0 0 / 20px 20px,
    var(--muted);
  overflow: hidden;
}
.search-loading-pin {
  position: absolute;
  width: 14px;
  height: 14px;
  border-radius: 50% 50% 50% 0;
  background: var(--primary);
  transform: rotate(-45deg) scale(0);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--primary) 15%, transparent);
  animation: pin-pop 4s ease-in-out infinite;
}
.search-loading-pin::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--primary-foreground);
}
@keyframes pin-pop {
  0%, 100% { transform: rotate(-45deg) scale(0); opacity: 0; }
  10%, 80% { transform: rotate(-45deg) scale(1); opacity: 1; }
  90%      { transform: rotate(-45deg) scale(1); opacity: 1; }
}

.search-loading-dots {
  display: flex;
  gap: 5px;
}
.search-loading-dots span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--primary);
  animation: dot-pulse 1.2s ease-in-out infinite;
}
.search-loading-dots span:nth-child(2) { animation-delay: 0.2s; }
.search-loading-dots span:nth-child(3) { animation-delay: 0.4s; }
@keyframes dot-pulse {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
  40%           { transform: scale(1);   opacity: 1; }
}

.search-loading-cycle-text {
  position: relative;
  display: inline-block;
  height: 18px;
  font-size: 0.8125rem;
  color: var(--muted-foreground);
  min-width: 230px;
}
.search-loading-cycle-text span {
  position: absolute;
  left: 0;
  top: 0;
  white-space: nowrap;
  opacity: 0;
  animation: cycle-text 8s infinite;
}
@keyframes cycle-text {
  0%, 20%  { opacity: 1; }
  25%, 100% { opacity: 0; }
}
```

Todos los valores de color usan variables del tema (`var(--primary)`, `var(--border)`, `var(--muted)`, `var(--muted-foreground)`, `var(--primary-foreground)`) — ninguno hardcodeado, cumpliendo la convención del sistema de diseño.

### Accesibilidad: reduced motion

El bloque ya existente `@media (prefers-reduced-motion: reduce)` (línea 181) gana las tres animaciones nuevas, mismo criterio que las entradas (`animate-fade-up`, etc.) ya desactivadas ahí:

```css
@media (prefers-reduced-motion: reduce) {
  .animate-fade-up,
  .animate-fade-in,
  .stagger-item {
    animation: none;
    opacity: 1;
    transform: none;
  }
  .btn-press  { transition: none; }
  .card-lift  { transition: none; }
  .card-lift:hover { transform: none; }

  .search-loading-pin {
    animation: none;
    transform: rotate(-45deg) scale(1);
    opacity: 1;
  }
  .search-loading-dots span {
    animation: none;
    transform: scale(1);
    opacity: 1;
  }
  .search-loading-cycle-text span {
    animation: none;
    opacity: 0;
  }
  .search-loading-cycle-text span:first-child {
    opacity: 1;
  }
}
```

Con `prefers-reduced-motion: reduce`: los 4 pines quedan visibles y estáticos, los 3 puntos quedan visibles y estáticos, y se muestra fija la primera frase ("Buscando negocios cercanos...") sin rotar.

## Integración

### `src/components/results/AnalysisStream.tsx`

Find:
```tsx
  if (phase === 'loading') {
    return (
      <div className="flex items-center gap-3 text-muted-foreground py-12">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="text-sm">Obteniendo datos del mercado...</span>
      </div>
    )
  }
```
Replace with:
```tsx
  if (phase === 'loading') {
    return <SearchLoadingState />
  }
```

Find:
```tsx
      {phase === 'streaming_json' && (
        <div className="space-y-6 animate-pulse">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl border bg-card p-5 h-28" />
            <div className="rounded-xl border bg-card p-5 h-28" />
          </div>
          <div className="space-y-3">
            <div className="h-5 bg-muted rounded w-44" />
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-xl border bg-card p-5 h-20" />
            ))}
          </div>
          <div className="space-y-3">
            <div className="h-5 bg-muted rounded w-36" />
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-lg border bg-card p-4 h-10" />
            ))}
          </div>
        </div>
      )}
```
Replace with:
```tsx
      {phase === 'streaming_json' && <SearchLoadingState />}
```

Añadir el import:
```tsx
import { SearchLoadingState } from './SearchLoadingState'
```

### `src/components/results/AgencyLeadsStream.tsx`

Find:
```tsx
  if (phase === 'loading' || phase === 'streaming_summary' || phase === 'streaming_json') {
    return (
      <div className="flex items-center gap-3 text-muted-foreground py-12">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="text-sm">Analizando prospectos...</span>
      </div>
    )
  }
```
Replace with:
```tsx
  if (phase === 'loading' || phase === 'streaming_summary' || phase === 'streaming_json') {
    return <SearchLoadingState />
  }
```

Añadir el import:
```tsx
import { SearchLoadingState } from './SearchLoadingState'
```

## Manejo de errores

Ninguno nuevo — `SearchLoadingState` no depende de datos externos, no puede fallar. La fase `error` en ambos componentes ya tiene su propio manejo (no tocado por este cambio).

## Testing

Sin tests automatizados nuevos (UI pura sin lógica, fuera del criterio de testing de este repo). Verificación manual: ejecutar una búsqueda real en ambos modos (`market_research` y `agency_leads`) y observar la animación durante los ~30-60s de espera; confirmar visualmente que los pines, los puntos y el texto rotan correctamente y que el resumen de `market_research` sigue apareciendo con normalidad tras la fase de carga. Confirmar con las herramientas de desarrollo del navegador (emular `prefers-reduced-motion: reduce`) que la animación queda estática como se describe arriba.
