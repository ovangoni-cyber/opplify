# Dashboard propio para usuarios logueados, landing solo para visitantes — Design

## Context

Hoy `/` (`src/app/page.tsx`) es una landing de marketing visible para todo el mundo. La única diferencia para un usuario logueado es el header del nav (créditos, email, menú en vez de "Acceder") — el resto del contenido (hero, features, cómo funciona, precios, formulario de búsqueda) es idéntico se esté logueado o no. Un usuario que ya tiene cuenta, al volver a `/`, vuelve a ver todo el discurso comercial pensado para convertir visitantes nuevos.

La sesión es 100% cliente: el JWT vive en `localStorage` (`src/lib/auth-client.ts`), no hay cookie ni `middleware.ts`, así que cualquier decisión de "¿hay sesión?" se resuelve en el navegador vía `useAuth()`, nunca en el servidor antes del primer render.

La página de precios (`#precios` dentro de `page.tsx`) es hoy la única forma de comprar créditos — `ResultsDashboard.tsx` enlaza ahí (`/#precios`) cuando a un usuario se le acaban los créditos.

## Scope

- La landing (`/`) pasa a ser exclusiva de visitantes sin sesión. Si hay sesión, redirige a un dashboard nuevo.
- Dashboard nuevo en `/inicio`: saludo, créditos disponibles, CTA de nueva búsqueda, últimos análisis.
- Página nueva `/precios`: contiene la compra de créditos que hoy vive en la landing, accesible con o sin sesión.
- Ajustar los enlaces existentes que apuntaban a `/#precios` o que asumían `/buscar` como destino por defecto tras login.

Fuera de alcance: añadir cookies o middleware para resolver la sesión en servidor (cambiaría la arquitectura de auth de todo el proyecto, no solo esto). Mostrar nombre de pila en el saludo (el JWT decodificado en cliente no trae `metadata`; pedirlo requeriría una llamada extra a `/api/profile` que no aporta lo suficiente para este alcance — el saludo usa el email). Tests nuevos para código no cubierto hoy por la convención del repo (páginas/rutas no se testean, solo funciones puras).

## Diseño

### Flujo de redirección en `/`

`src/app/page.tsx` gana un `useEffect` que depende de `useAuth()`:

```tsx
const { user, loading: authLoading } = useAuth()
const router = useRouter()

useEffect(() => {
  if (authLoading) return
  if (user) router.replace('/inicio')
}, [user, authLoading, router])

if (authLoading || user) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  )
}
```

Mismo patrón que ya usa `src/app/auth/callback/page.tsx` (spinner de pantalla completa mientras se resuelve y se redirige). Como el spinner cubre tanto el estado "todavía no sé si hay sesión" (`authLoading`) como "hay sesión, esperando a que el router navegue" (`user` truthy), el landing completo nunca llega a pintarse para un usuario logueado — ni un instante.

Cuando `authLoading` es `false` y `user` es `null`, se pinta el landing exactamente como hoy, con dos cambios:

1. La rama logueada del ternario del nav (`CreditsBadge`, píldora de email, `NavMenu`) se elimina — ya no es alcanzable, porque si hubiera sesión la función habría retornado el spinner antes de llegar ahí. El nav queda solo con `<ThemeSwitcher />` + el botón "Acceder".
2. Se quita la sección `<section id="precios">` completa (líneas ~262-318 de la versión actual) junto con el estado y la lógica que solo ella usaba: `buyingPack`, `buyError`, `handleBuy`, el import de `CREDIT_PACKS`. El link `href="#precios"` del nav y el "Ver precios" de la hero pasan a `href="/precios"`.

### `/inicio` — dashboard para usuarios logueados

Archivo nuevo: `src/app/inicio/page.tsx`, cliente, mismo patrón de protección de ruta que `src/app/historial/page.tsx`:

```tsx
useEffect(() => {
  if (authLoading) return
  if (!user) {
    router.replace('/auth/login?redirect=/inicio')
    return
  }
  // fetch créditos + historial reciente
}, [user, authLoading, router])
```

Estructura visual:

1. `<AppHeader>` con children `<Link href="/precios">Más créditos</Link>` — mismo patrón que el children "Nueva búsqueda" de `/historial`.
2. Saludo: "Hola de nuevo" + email del usuario (`user.email`).
3. Tarjeta de créditos disponibles: fetch propio a `/api/credits` (mismo patrón self-contained que ya usa `CreditsBadge.tsx`, pero con presentación más grande — número destacado + "créditos disponibles"). Si el valor es `0`, incluye un link a `/precios`.
4. CTA principal: botón grande `Nueva búsqueda →` a `/buscar`, mismo estilo visual que el botón "Analizar ahora →" de la landing.
5. "Análisis recientes": fetch a `/api/history` (mismo endpoint que usa `/historial`, sin cambios en el backend — ya devuelve ordenado por `created_at DESC`), recortado a `.slice(0, 5)` en cliente.
   - Loading: spinner centrado (mismo markup que ya usa `/historial`).
   - Vacío: "Todavía no hiciste ningún análisis" + CTA a `/buscar` (mismo texto que ya usa `/historial`).
   - Con datos: lista de filas reutilizando `HistoryEntryRow` (ver más abajo). Si el total de entradas devueltas por el fetch es mayor a 5, se añade un link "Ver todos →" a `/historial`.
6. `<AppFooter />`.

### Extracción de `HistoryEntryRow`

`src/app/historial/page.tsx` y el nuevo `/inicio` necesitan el mismo row-markup, `ModeBadge` y `relativeTime()`. Se extraen a `src/components/history/HistoryEntryRow.tsx`:

```tsx
export type HistoryEntry = {
  id: string
  city: string
  business_type: string | null
  mode: string
  created_at: string
}

export function relativeTime(iso: string): string { /* lógica idéntica a la actual de historial/page.tsx */ }

export function ModeBadge({ mode }: { mode: string }) { /* idéntico al actual */ }

export function HistoryEntryRow({ entry }: { entry: HistoryEntry }) {
  // mismo JSX de la fila (ciudad, tipo de negocio, badge, tiempo relativo,
  // link "Ver análisis →" con from_history=1) que hoy vive inline en historial/page.tsx
}
```

`historial/page.tsx` pasa a importar estos tres símbolos en vez de tener su copia local; su comportamiento visual no cambia.

### `/precios` — compra de créditos

Archivo nuevo: `src/app/precios/page.tsx`, cliente, accesible con o sin sesión (mismo criterio que `/buscar` hoy). Usa `<AppHeader />` / `<AppFooter />` sin children — `AppHeader` ya decide solo "Acceder" vs créditos/email/menú según `useAuth()`.

Contenido: la sección de precios que hoy vive en `page.tsx` (título, grid de `CREDIT_PACKS`, botón "Comprar") se traslada tal cual, junto con su lógica de compra:

```tsx
const handleBuy = async (packId: string) => {
  if (!user || !session?.access_token) {
    router.push('/auth/login?redirect=/precios')
    return
  }
  // ...mismo fetch a /api/checkout y redirect a la URL de Stripe que existe hoy...
}
```

## Cambios en archivos existentes

| Archivo | Cambio |
|---|---|
| `src/app/page.tsx` | Añade el `useEffect` + spinner de redirección. Quita la sección de precios y todo lo que solo ella usaba (`buyingPack`, `buyError`, `handleBuy`, import de `CREDIT_PACKS`). Simplifica el ternario del nav a solo la rama "Acceder". Cambia `href="#precios"` → `href="/precios"` en dos sitios (nav y hero). |
| `src/app/historial/page.tsx` | Importa `HistoryEntry`, `relativeTime`, `ModeBadge`, `HistoryEntryRow` desde `@/components/history/HistoryEntryRow` en vez de definirlos localmente. Sin cambio de comportamiento. |
| `src/components/results/ResultsDashboard.tsx` | El link "Ver precios →" de la pantalla "Sin créditos" cambia de `/#precios` a `/precios`. |
| `src/app/auth/login/page.tsx` | Línea 15: el redirect por defecto cambia de `'/buscar'` a `'/inicio'`. |

## Manejo de errores

- Fetch de `/api/credits` o `/api/history` falla en `/inicio`: mismo criterio que `CreditsBadge` (créditos) y `/historial` (historial) ya usan hoy — no se introduce manejo nuevo, se replica el existente (la tarjeta de créditos no se muestra si el fetch falla; la lista de historial cae al estado `loadError` ya usado en `/historial`).
- Usuario sin créditos visitando `/inicio`: no es un error, es el estado normal — la tarjeta muestra `0` y el link a `/precios`.
- `search_history` con entradas pero sin la fila de `analyses` correspondiente (caso ya descrito en el spec de `history-no-recharge`): no afecta a `/inicio`, que solo lista metadatos de `search_history`; el comportamiento de cobro al hacer clic ya está cubierto por ese spec anterior, sin relación con este cambio.

## Testing

Sin tests nuevos — ninguno de los archivos tocados o creados (`page.tsx`, `inicio/page.tsx`, `precios/page.tsx`, `ResultsDashboard.tsx`, `auth/login/page.tsx`) entra en el criterio de "What is and is not tested" de `CLAUDE.md` (solo funciones puras sin red). `relativeTime()` extraída a `HistoryEntryRow.tsx` es una función pura candidata a test, pero tampoco está testeada hoy en su ubicación actual — se mantiene el mismo nivel de cobertura, sin ampliarlo fuera de alcance.

Verificación manual: visitar `/` logueado y confirmar redirect instantáneo a `/inicio` sin ver el landing; visitar `/` sin sesión y confirmar que se ve el landing igual que antes (sin sección de precios, con "Ver precios" → `/precios`); en `/inicio`, confirmar créditos correctos, CTA a `/buscar`, y que las últimas 5 entradas de historial coinciden con `/historial`; en `/precios`, confirmar que comprar sin sesión redirige a login con `redirect=/precios` y que tras loguearse vuelve ahí; confirmar que `ResultsDashboard` en estado "Sin créditos" enlaza a `/precios`.
