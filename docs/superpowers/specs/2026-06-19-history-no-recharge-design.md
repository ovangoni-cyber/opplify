# No recobrar crédito al ver una búsqueda desde el historial — Design

## Context

`/api/analyze` chequea un caché global (tabla `analyses`, INSERT-only, nunca se sobreescribe, ventana de `CACHE_TTL_HOURS = 24` en `src/lib/analysis-cache.ts`) antes de cobrar un crédito. Si hay un hit dentro de esa ventana, retorna inmediatamente sin tocar `user_credits`. Si no hay hit (porque pasaron más de 24h desde el último análisis para esa combinación city+business_type+mode), cobra un crédito y vuelve a correr el pipeline completo.

`search_history` (la tabla que alimenta `/historial`) no tiene relación con `analyses` — solo guarda `city`/`business_type`/`mode`/`created_at` por usuario. El link "Ver análisis →" navega a `/results?city=...&mode=...&business_type=...`, que dispara el mismo flujo de búsqueda nueva desde cero, sujeto al mismo chequeo de caché de 24h.

Resultado: ver una entrada del historial de más de 24h cobra un crédito completo por algo que el usuario ya pagó, aunque el resultado original sigue físicamente en la tabla `analyses` (la fila nunca se borra, solo queda fuera de la ventana de `created_at` del chequeo).

## Scope

Hacer que ver cualquier entrada de `/historial`, sin importar su antigüedad, nunca cobre un crédito — reutilizando el resultado ya guardado en `analyses` para esa combinación city+business_type+mode, sin límite de 24h, cuando la petición viene explícitamente desde el historial.

Fuera de alcance: vincular `search_history` a una fila específica de `analyses` (migración de esquema) — no es necesaria porque el cache_key (city+business_type+mode) ya identifica unívocamente el resultado correcto en el caso normal. Cambiar el TTL de 24h para búsquedas nuevas (no es lo que se pide; una búsqueda nueva sigue usando la ventana de 24h igual que hoy).

## Diseño

**`src/lib/analysis-cache.ts`** — `getCachedAnalysis` gana un cuarto parámetro opcional `ignoreTtl: boolean = false`. Cuando es `true`, la query SQL omite la condición `created_at > $3` (y por tanto el parámetro `cutoff`), buscando la fila más reciente para ese `cache_key`+`mode` sin importar su edad:

```ts
export async function getCachedAnalysis(
  city: string,
  businessType: string | null,
  mode: AppMode,
  ignoreTtl = false
): Promise<CachedAnalysis | null> {
  const cacheKey = buildCacheKey(city, businessType)

  if (ignoreTtl) {
    const { rows } = await pool.query(
      'SELECT result, created_at FROM analyses WHERE cache_key = $1 AND mode = $2 ORDER BY created_at DESC LIMIT 1',
      [cacheKey, mode]
    )
    return rows[0] ?? null
  }

  const cutoff = new Date(Date.now() - CACHE_TTL_HOURS * 60 * 60 * 1000).toISOString()
  const { rows } = await pool.query(
    'SELECT result, created_at FROM analyses WHERE cache_key = $1 AND mode = $2 AND created_at > $3 ORDER BY created_at DESC LIMIT 1',
    [cacheKey, mode, cutoff]
  )
  return rows[0] ?? null
}
```

**`src/types/analysis.ts`** — `SearchParams` gana un campo opcional `from_history?: boolean`.

**`src/app/api/analyze/route.ts`** — lee `body.from_history === true` y lo pasa como cuarto argumento a `getCachedAnalysis`:

```ts
const fromHistory = body.from_history === true
// ...
if (!hasExclusions) {
  const cached = await getCachedAnalysis(city, businessType, mode, fromHistory)
  if (cached) { /* ...mismo código de retorno ya existente... */ }
}
```

No hace falta ningún cambio en la lógica de cobro de créditos: como el chequeo de caché ya retorna antes de llegar al `decrementCredit`, ampliar la ventana de búsqueda hace que "no cobrar" sea una consecuencia automática del hit, no una rama nueva de código. Si por alguna inconsistencia de datos no existiera ninguna fila en `analyses` para esa combinación (caso raro — significaría que `search_history` tiene una entrada sin su correspondiente guardado de caché, p. ej. por un fallo silencioso de `saveAnalysis`), el flujo cae automáticamente al comportamiento normal (cobra y corre el pipeline) sin necesidad de código adicional, ya que `cached` simplemente sería `null` y el control pasa al chequeo de créditos existente.

## Plomería cliente

**`src/app/historial/page.tsx`** — el link "Ver análisis →" añade `from_history=1` a la query string:

```tsx
const qs = new URLSearchParams({ city: entry.city, mode: entry.mode })
if (entry.business_type) qs.set('business_type', entry.business_type)
qs.set('from_history', '1')
```

**`src/app/results/page.tsx`** — lee `params.from_history === '1'` de `searchParams` y lo pasa como prop booleana a `ResultsDashboard`.

**`src/components/results/ResultsDashboard.tsx`** — `Props` gana `fromHistory?: boolean`; el `useEffect` que llama a `analyze` pasa `from_history: fromHistory` junto al resto de los parámetros existentes.

`useAnalysisStream.ts` no necesita cambios — ya hace `JSON.stringify(params)` del objeto `SearchParams` completo tal cual se le pasa, así que el nuevo campo viaja automáticamente en el body del POST.

## Manejo de errores

No hay nuevos casos de error. El caso "no existe fila en caché aunque venga de historial" ya descrito cae al comportamiento existente sin cambios.

## Testing

`getCachedAnalysis` ya no tiene test unitario hoy (depende de `pg`, fuera del criterio de "What is and is not tested" en `CLAUDE.md`) — no se añade uno nuevo, siguiendo el mismo criterio. Verificación manual: hacer una búsqueda, esperar (o simular) que pasen más de 24h —o forzar la prueba editando temporalmente `CACHE_TTL_HOURS` a un valor bajo durante la verificación local, o insertando directamente en Postgres local una fila de `analyses` con `created_at` de hace más de 24h para esa combinación— y confirmar que entrar desde `/historial` muestra el resultado sin descontar crédito, mientras que iniciar la misma búsqueda desde cero (sin `from_history`) sí cobra como antes si el caché normal ya expiró.
