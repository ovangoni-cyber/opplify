# Edición de datos de perfil en Ajustes — Design

## Context

El registro recoge un perfil completo (nombre, apellido, fecha de nacimiento, teléfono, país) que se guarda en la columna `metadata` jsonb de `users`, pero hoy no hay forma de editarlo después de crear la cuenta. Tampoco hay forma de cambiar la contraseña salvo borrando y rehaciendo la cuenta. `/ajustes` solo tiene la tarjeta "Ajustes de marca" (nombre de agencia + logo, tabla `user_branding`, rutas `/api/branding`), que ya funciona y no se toca a nivel de backend.

El objetivo es que cualquier usuario pueda editar su perfil completo (datos de registro + marca + contraseña) desde una única tarjeta en `/ajustes`.

## Scope

- Nuevo endpoint `src/app/api/profile/route.ts` (`GET`/`POST`) para leer y escribir `nombre`, `apellido`, `fecha de nacimiento`, `teléfono`, `país`, y opcionalmente cambiar la contraseña.
- `src/app/ajustes/page.tsx` pasa de tener una sola tarjeta ("Ajustes de marca") a una sola tarjeta más grande, "Mis datos", con tres bloques: perfil, marca (movido aquí, sin cambios de backend), contraseña.
- Extraer la lista `COUNTRIES` (hoy duplicaría 32 entradas si se copia) de `src/app/auth/login/page.tsx` a un archivo compartido, usado por ambas páginas.

Fuera de alcance: editar el email (requiere verificación, no pedido), `/api/branding` no se modifica (se sigue llamando igual, solo cambia desde qué tarjeta visual se invoca).

## Endpoint: `src/app/api/profile/route.ts`

Mismo patrón de autenticación que `/api/branding` (`Authorization: Bearer <token>` → `verifyToken`).

**`GET`** — devuelve el perfil actual:
```json
{ "first_name": "", "last_name": "", "dob": "", "phone": "", "country": "" }
```
Lee `metadata` de `users` por `payload.sub` y devuelve cada campo con fallback a cadena vacía si la clave no existe (cubre cuentas creadas antes de que el registro pidiera estos campos, o con metadata parcial).

**`POST`** — body:
```json
{
  "first_name": "...", "last_name": "...", "dob": "...", "phone": "...", "country": "...",
  "current_password": "...", "new_password": "..."
}
```
`current_password`/`new_password` son opcionales — solo se incluyen si el usuario quiere cambiar la contraseña.

Lógica (en una transacción, igual que el patrón ya usado en `/api/auth/register`):
1. Si `new_password` viene con contenido: exigir `current_password` no vacío (si falta, `400` "Falta la contraseña actual"); validar `new_password.length >= 6` (mismo mínimo que el registro, `400` "La nueva contraseña debe tener al menos 6 caracteres" si no cumple); leer `password_hash` actual del usuario y comparar con `bcrypt.compare(current_password, password_hash)` — si no coincide, `400` "Contraseña actual incorrecta" y no se actualiza nada (ni el perfil); si coincide, `bcrypt.hash(new_password, 10)` y `UPDATE users SET password_hash = $1 WHERE id = $2` dentro de la misma transacción.
2. Siempre (haya o no cambio de contraseña): `UPDATE users SET metadata = $1 WHERE id = $2` con el jsonb `{ first_name, last_name, dob, phone, country }` — reemplazo completo del objeto, igual que hace `register` al crearlo (no hay otras claves en `metadata` hoy que preservar).
3. `COMMIT` y devolver `{ ok: true }`. Si `current_password` es incorrecta, `ROLLBACK` y devolver el error sin tocar nada.

## Frontend: `src/app/ajustes/page.tsx`

La tarjeta pasa a llamarse "Mis datos" y tiene tres bloques dentro del mismo `<form>`, un solo botón "Guardar":

1. **Perfil** — Nombre, Apellido (inputs de texto), Fecha de nacimiento (`type="date"`), Teléfono (`type="tel"`), País (`<select>` con la lista `COUNTRIES` compartida). Mismos componentes/estilos que el formulario de registro en `src/app/auth/login/page.tsx`, incluido `required` en los 5 — igual que en el registro. Cuentas antiguas con `metadata` incompleto (antes de que el registro pidiera estos campos) verán esos campos vacíos al cargar y deberán completarlos para poder guardar cualquier cambio en esta tarjeta — comportamiento aceptado, no es un caso a evitar.
2. **Marca** (contenido ya existente, sin cambios funcionales) — Nombre de agencia, Logo — ambos opcionales.
3. **Cambiar contraseña** (opcional, colapsable o simplemente con placeholder "Dejar en blanco para no cambiarla") — Contraseña actual, Nueva contraseña, Confirmar nueva contraseña.

Al cargar la página: `GET /api/profile` y `GET /api/branding` (ya existente) en paralelo, para precargar los 7 campos relevantes (5 de perfil + 2 de marca).

Al enviar el formulario:
1. Validación cliente: si `Nueva contraseña` tiene contenido, exigir que `Confirmar nueva contraseña` coincida exactamente (si no, error inline "Las contraseñas no coinciden", sin llamar a la API) y que `Contraseña actual` no esté vacía.
2. `POST /api/profile` con los 5 campos de perfil + (si se rellenaron) `current_password`/`new_password`. Si falla, mostrar el error devuelto y detener el flujo (no se llama a `/api/branding`).
3. Si lo anterior tuvo éxito: `POST /api/branding` (sin cambios respecto a hoy). Si falla, mostrar un error distinto indicando que el perfil sí se guardó pero la marca no.
4. Si ambos tienen éxito: mensaje "Guardado correctamente" (igual al texto ya usado hoy) y limpiar los tres campos de contraseña (nunca se vuelven a precargar, por seguridad — al recargar la página siempre aparecen vacíos).

## Extracción de `COUNTRIES`

Crear `src/lib/countries.ts` exportando la constante `COUNTRIES` (mismo array de 32 entradas hoy definido en `src/app/auth/login/page.tsx`). Ambos archivos (`login/page.tsx` y `ajustes/page.tsx`) importan desde ahí; se elimina la definición inline en `login/page.tsx`.

## Manejo de errores

- `GET /api/profile` sin token válido → `401`.
- `POST /api/profile` sin token válido → `401`; cuerpo inválido (JSON malformado) → `400`; contraseña actual incorrecta → `400` con mensaje específico; nueva contraseña demasiado corta → `400`.
- Errores de red (fetch falla) en el cliente → mismo patrón ya usado en la tarjeta de marca actual (mensaje genérico de error, sin reintento automático).

## Testing

`POST /api/profile`'s password-change branch tiene lógica no trivial (comparación de contraseña, validación de longitud, atomicidad) pero depende de `pg` y `bcryptjs` — siguiendo el criterio ya establecido en `CLAUDE.md` ("What is and is not tested": solo funciones puras sin red), no lleva test unitario nuevo; se verifica manualmente: cargar `/ajustes`, confirmar que los 5 campos de perfil aparecen precargados con los datos reales de la cuenta, editar y guardar sin tocar contraseña, recargar y confirmar que persistió; luego repetir intentando cambiar la contraseña con la contraseña actual incorrecta (debe fallar sin guardar nada) y luego con la correcta (debe guardar todo y permitir iniciar sesión con la nueva contraseña).
