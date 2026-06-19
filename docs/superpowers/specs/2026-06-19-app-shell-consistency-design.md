# Header y footer consistentes en páginas internas — Design

## Context

Hoy, fuera de la home (`/`), las páginas autenticadas de la app repiten cada una su propio header sticky con ligeras diferencias (`src/app/historial/page.tsx`, `src/app/ajustes/page.tsx`, `src/components/results/ResultsDashboard.tsx`), y ninguna de las cuatro páginas internas (`/buscar`, `/historial`, `/ajustes`, `/results`) tiene footer. Además, `/buscar` —la única de las cuatro accesible sin sesión, como flujo de "probar antes de registrarte"— ni siquiera tiene el header completo: solo el logo, sin `ThemeSwitcher`, `CreditsBadge` ni `NavMenu`.

El objetivo es mejorar la experiencia de usuario unificando: mismo header (con su `NavMenu`) y mismo footer en las cuatro páginas internas, replicando exactamente el patrón ya validado en la home.

## Scope

- Dos componentes nuevos y autocontenidos: `AppHeader` y `AppFooter`.
- Integrarlos en `/buscar`, `/historial`, `/ajustes` y `/results` (`ResultsDashboard`), sustituyendo el header que cada una repite hoy y añadiendo el footer (ausente en las cuatro).
- `/buscar` gana el header completo (hoy solo tiene el logo).

Fuera de alcance: la home (`/`) ya tiene su propio header (`fixed`) y footer, funcionalmente idénticos a los nuevos componentes — no se toca, para no arriesgar su posicionamiento ya ajustado (`pt-32` en el hero compensa el nav `fixed`). Tampoco se añade contenido nuevo al footer (sin links legales, redes, etc. — decisión explícita del usuario: solo consistencia, no contenido nuevo).

## Componente: `src/components/AppHeader.tsx`

Cliente (`'use client'`), sigue el patrón autocontenido de `NavMenu`/`CreditsBadge` (se autoabastece de `useAuth()`), con un único prop opcional para contenido específico de cada página:

```tsx
function AppHeader({ children }: { children?: React.ReactNode }) { ... }
```

Estructura (igual contenedor `sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur-md`, `max-w-4xl mx-auto px-6 h-14 flex items-center justify-between`, ya usado por `historial`/`ajustes`/`ResultsDashboard`):

1. Logo `Opplify.ai` enlazando a `/` (igual en las 4 páginas hoy).
2. `<ThemeSwitcher />`.
3. `{children}` — contenido específico de la página que lo use (ver tabla de integración).
4. Si hay sesión (`user` de `useAuth()`): `<CreditsBadge />` + píldora de email/avatar (markup ya repetido idéntico en las 3 páginas existentes, ahora vive solo aquí) + `<NavMenu />`.
5. Si no hay sesión: botón "Acceder" (`<a href="/auth/login">`, mismo estilo que en la home) — rama que solo se activa en `/buscar`, ya que las otras tres páginas ya redirigen a login si no hay sesión antes de renderizar el header.

## Componente: `src/components/AppFooter.tsx`

Cliente o servidor indistintamente (no usa hooks ni estado) — sin props, calco exacto del footer ya existente en la home:

```tsx
function AppFooter() {
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
```

Se renderiza siempre con `max-w-5xl` (igual que en la home), independientemente del ancho del contenido de la página que lo use.

## Integración en las 4 páginas

| Página | Hoy | Cambio |
|---|---|---|
| `src/app/buscar/page.tsx` | Solo logo, sin `ThemeSwitcher`/`CreditsBadge`/`NavMenu`, sin footer | `<AppHeader />` sin children (no tiene contenido específico) + `<AppFooter />` al final |
| `src/app/historial/page.tsx` | Header propio con link "Nueva búsqueda" entre `ThemeSwitcher` y `CreditsBadge`, sin footer | `<AppHeader>` con el link "Nueva búsqueda" como `children` + `<AppFooter />` al final |
| `src/app/ajustes/page.tsx` | Header propio sin píldora de email (inconsistencia existente), sin footer | `<AppHeader />` sin children (gana la píldora de email, hoy ausente) + `<AppFooter />` al final |
| `src/components/results/ResultsDashboard.tsx` (`Header`) | Header propio con badge de tipo de negocio + nombre de ciudad + link "← Nueva búsqueda", todo intercalado entre `ThemeSwitcher` y `CreditsBadge`, sin footer | `<AppHeader>` con badge + ciudad + link "← Nueva búsqueda" como `children` (mismo contenido, ahora agrupado en el slot, justo después de `ThemeSwitcher` y antes de `CreditsBadge` — reordenamiento visual mínimo respecto al link, que hoy aparece después de `CreditsBadge`) + `<AppFooter />` al final |

En todos los casos se elimina el markup de header duplicado (incluida la píldora de email, ahora dentro de `AppHeader`) y se elimina cualquier import que quede sin uso (`ThemeSwitcher`, `CreditsBadge`, `NavMenu` deja de importarse directamente en esas 4 páginas/componente, ya que pasan a vivir solo dentro de `AppHeader`).

`ResultsDashboard.tsx` tiene dos puntos de retorno con su propio `<Header>` (uno en la rama de error `ERR_NO_CREDITS`, línea ~42; otro en el retorno principal, línea ~62) — ninguno de los dos tiene footer hoy. Ambos pasan a usar `<AppHeader>` con el mismo `children` (badge de tipo de negocio + ciudad + link "← Nueva búsqueda") y ambos ganan `<AppFooter />` al final.

## Manejo de errores

No hay llamadas de red nuevas. `AppHeader` reutiliza `useAuth()` (ya usado en las páginas que lo consumían) y `AppFooter` no tiene estado. No se requiere manejo de errores nuevo.

## Testing

Son componentes de UI cliente sin lógica pura extraíble — siguiendo el criterio ya establecido en `CLAUDE.md` ("What is and is not tested"), no llevan test unitario. Se verifica manualmente en las 4 páginas: header completo visible (logo, ThemeSwitcher, contenido específico si aplica, CreditsBadge, email, NavMenu funcionando) y footer visible al final de cada página, sin afectar visualmente a la home.
