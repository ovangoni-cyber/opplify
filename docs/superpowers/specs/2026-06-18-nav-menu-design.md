# Menú de navegación unificado (hamburguesa) — Design

## Context

Hoy las navbars de la app (`src/app/page.tsx`, `src/app/historial/page.tsx`, `src/components/results/ResultsDashboard.tsx`) repiten tres elementos sueltos cuando hay sesión iniciada: un link a "Ajustes", un link a "Historial" y un botón "Salir" (cierre de sesión). La página `/ajustes` (`src/app/ajustes/page.tsx`) tiene "Historial" pero no "Salir". Esto ocupa espacio horizontal y está duplicado en cuatro archivos con ligeras diferencias.

El objetivo es consolidar esos tres elementos en un único botón con icono de hamburguesa (☰) que despliega un menú, reduciendo el ruido visual de la navbar y unificando el comportamiento en las cuatro páginas.

## Scope

- Un componente nuevo y autocontenido, `NavMenu`, que renderiza el botón de hamburguesa y su dropdown.
- Integrarlo en las cuatro navbars (`page.tsx`, `historial/page.tsx`, `ResultsDashboard.tsx`, `ajustes/page.tsx`), sustituyendo los links/botón existentes de Ajustes/Historial/Salir.
- El menú siempre se posiciona como el último elemento de la navbar (a la derecha de `ThemeSwitcher`, `CreditsBadge` y la píldora de email, que no cambian).

Fuera de alcance: mover el `ThemeSwitcher` o la píldora de email dentro del menú (decisión explícita del usuario), cambios visuales a esos componentes, soporte de teclado tipo combobox ARIA completo (se aplica accesibilidad básica — `aria-expanded`, cierre con Escape — pero no un patrón ARIA menu completo), persistencia de "menú abierto" entre navegaciones.

## Componente: `src/components/NavMenu.tsx`

Cliente (`'use client'`), sin props — sigue el patrón autocontenido de `CreditsBadge`:

- **Trigger:** botón con icono SVG inline de 3 líneas (hamburguesa), mismo tamaño/padding que los botones de icono existentes en el design system. `aria-label="Menú"`, `aria-expanded={open}`.
- **Estado:** `const [open, setOpen] = useState(false)`.
- **Cierre al hacer click fuera:** un `useEffect` con un listener de `mousedown` en `document` que cierra el menú si el click no está dentro de un `ref` contenedor. Se limpia en el cleanup del efecto.
- **Cierre con Escape:** listener de `keydown` análogo, mismo `useEffect`.
- **Contenido del dropdown** (estilo "A" validado visualmente — lista simple, sin cabecera de identidad), anclado a la derecha del trigger, con `border border-border bg-background` y sombra, consistente con el resto del design system (`rounded-lg`, `text-xs`/`text-sm` según corresponda):
  1. Link a `/ajustes` — "Ajustes"
  2. Link a `/historial` — "Historial"
  3. Separador (`<div className="h-px bg-border my-1" />`)
  4. Botón "Cerrar sesión" — color `text-rose-400` (mismo semantic color que otros estados negativos en la app)
- **Cerrar sesión:** `authClient.signOut().then(() => router.push('/'))`. Unifica el comportamiento — hoy `page.tsx` hace `router.refresh()` tras cerrar sesión y las otras dos páginas hacen `router.push('/')`; se estandariza a `router.push('/')` en las cuatro integraciones, ya que es el comportamiento mayoritario y tiene más sentido ir a la portada tras cerrar sesión.
- **Click en cualquier opción del menú** (Ajustes, Historial, Cerrar sesión) cierra el dropdown (`setOpen(false)`) antes/durante la navegación.

No necesita ninguna prop porque obtiene todo lo que necesita de `useRouter()` y `authClient` directamente, igual que `CreditsBadge` se autoabastece con `fetch('/api/credits')`.

## Integración en las 4 navbars

En cada archivo, se elimina el bloque de links "Ajustes" + "Historial" (y, donde exista, el botón "Salir") y se reemplaza por `<NavMenu />` al final del contenedor flex de la navbar:

- **`src/app/page.tsx`**: elimina los links a `/ajustes`/`/historial` (líneas ~96-109) y el botón "Salir" (~122-127); inserta `<NavMenu />` tras la píldora de email.
- **`src/app/historial/page.tsx`**: elimina el link a `/ajustes` (línea ~93) y el botón "Salir" (~110-115); inserta `<NavMenu />` al final.
- **`src/components/results/ResultsDashboard.tsx`** (dentro del subcomponente `Header`): elimina los links a `/ajustes`/`/historial` (~100-111) y el botón "Salir" (~133-138); inserta `<NavMenu />` al final. La prop `onSignOut: () => void` de `Header` y la función `handleSignOut` en `ResultsDashboard` (línea ~40) quedan sin ningún otro uso tras este cambio — se eliminan ambas (YAGNI), junto con sus dos pasos como prop en las dos llamadas a `<Header ... onSignOut={handleSignOut} />` (~49 y ~69).
- **`src/app/ajustes/page.tsx`**: elimina el link a `/historial` (~108); inserta `<NavMenu />` al final. Gana por primera vez la opción de "Cerrar sesión" en esta página.

En todas las páginas, el menú muestra siempre las mismas 3 opciones (incluyendo "Ajustes" cuando ya estás en `/ajustes` — mismo patrón que el resto de la navegación, no se oculta la opción de la página actual).

## Manejo de errores

No hay llamadas de red nuevas — `NavMenu` solo navega (`Link`/`router.push`) y llama a `authClient.signOut()`, que ya tiene su propio manejo de errores en `auth-client.ts`. No se requiere nuevo manejo de errores en este componente.

## Testing

Es un componente de UI cliente sin lógica pura extraíble — siguiendo el criterio ya establecido en `CLAUDE.md` ("What is and is not tested"), no lleva test unitario. Se verifica manualmente: abrir/cerrar con click en el botón, cerrar con click fuera, cerrar con Escape, navegación correcta de cada opción, y cierre de sesión funcionando en las 4 páginas.
