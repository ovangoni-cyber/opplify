# Branded PDF Export — Design

## Context

Opplify.ai users (freelancers, agencias, consultores) usan la herramienta para investigar mercados o encontrar leads, pero hoy no tienen una forma profesional de mostrar el resultado a SU cliente — solo la pantalla de resultados en vivo y, para el modo de leads, un export a CSV. Esta es la primera de tres iniciativas para "profesionalizar" el SaaS (las otras dos — completitud de producto y pulido visual/UX — quedan para specs futuros). El objetivo de esta es: que el usuario pueda generar un PDF con su propia marca (logo + nombre de agencia) para adjuntar a propuestas o enviar por email.

## Scope

- Página `/ajustes` donde el usuario configura su marca (nombre de agencia + logo).
- Endpoint para guardar/leer esa marca.
- Endpoint que genera un PDF del resultado de análisis (ambos modos: `market_research` y `agency_leads`) con esa marca en el header.
- Botón "Exportar PDF" en la pantalla de resultados.

Fuera de alcance: links públicos compartibles, white-label completo (quitar marca de Opplify.ai), múltiples agencias/equipos por cuenta, plantillas de PDF personalizables por el usuario.

## Data model

Tabla nueva en `database/schema.sql`:

```sql
CREATE TABLE user_branding (
  user_id     uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  agency_name text,
  logo_data   bytea,
  logo_mime   text,
  updated_at  timestamptz DEFAULT now()
);
```

Una fila por usuario. No existe fila hasta que el usuario guarda su branding por primera vez — esa ausencia es el estado "sin marca configurada", no un error.

`logo_data` guarda el binario de la imagen directo en Postgres (vía `bytea`). Sin servicio de storage externo: funciona igual en local y en producción porque ambos usan Postgres.

## API routes

### `GET /api/branding` (Node runtime)
- Auth: `Authorization: Bearer <token>` → `verifyToken`. 401 si falta/inválido.
- Devuelve `{ agency_name: string | null, logo: string | null }` donde `logo` es un data URL (`data:image/png;base64,...`) o `null` si no hay fila o no hay logo.

### `POST /api/branding` (Node runtime)
- Auth igual que arriba.
- Body: `{ agency_name: string, logo_base64: string | null, logo_mime: string | null }`. `logo_base64` is the raw base64 payload only (no `data:...;base64,` prefix) — the prefix is added/stripped at the API boundary, not stored.
- Validación (función pura en `src/lib/branding.ts`, testeable):
  - `logo_mime` debe ser `image/png` o `image/jpeg` si se manda un logo.
  - Tamaño decodificado del logo ≤ 1MB. 400 con mensaje claro si falla cualquiera de las dos.
- Upsert en `user_branding` (`ON CONFLICT (user_id) DO UPDATE`).

### `POST /api/export/pdf` (Node runtime)
- Auth igual que arriba.
- Body: `{ mode: AppMode, city: string, business_type: string | null, result: AnalysisResult | AgencyLeadsResult }`. El cliente manda el `result` que ya tiene en memoria — no se recalcula ni se busca en caché.
- 400 si `result` falta o no tiene la forma esperada para el `mode` indicado.
- Busca `user_branding` por `payload.sub`. Si no hay fila, usa header genérico de Opplify.ai sin logo — nunca bloquea la generación.
- Renderiza con `@react-pdf/renderer` usando la plantilla correspondiente al `mode`.
- Responde el PDF binario: `Content-Type: application/pdf`, `Content-Disposition: attachment; filename="opplify-{city}-{mode}.pdf"` — `{city}` sanitizado igual que en `AgencyLeadsList.tsx` (`toLowerCase()`, espacios → `-`).
- 500 si la generación falla (se loguea server-side); el cliente muestra "No se pudo generar el PDF, intenta de nuevo".

## PDF templates

Nuevo directorio `src/lib/pdf/`:
- `market-research-template.tsx` — header (logo/agencia) → resumen ejecutivo → score de oportunidad → saturación de mercado → lista de oportunidades → pain points. Reutiliza `AnalysisResult` de `src/types/analysis.ts`.
- `agency-leads-template.tsx` — header (logo/agencia) → tabla de leads (nombre, rating, score, servicios recomendados, pain points). Reutiliza `AgencyLeadsResult`.

Ninguna plantilla inventa estructura de datos nueva — consumen los mismos tipos que ya renderiza la pantalla de resultados.

## UI changes

### `/ajustes` (página nueva)
Formulario: input de texto (nombre de agencia), input de archivo (logo, acepta `.png`/`.jpg`), preview del logo actual (si existe), botón guardar. Sigue el patrón visual del resto del proyecto (mismo `INPUT_CLASS`, mismos colores semánticos para errores).

Link "Ajustes" en el navbar, mismo lugar/estilo que el link "Historial" existente (`src/app/page.tsx`, `src/app/historial/page.tsx`, `src/components/results/ResultsDashboard.tsx`).

### Botón "Exportar PDF" en `ResultsDashboard.tsx`
Mismo patrón visual que el botón "Exportar CSV →" de `AgencyLeadsList.tsx`. Visible solo cuando `state.phase === 'complete'`. Al hacer click: `POST /api/export/pdf` con el token + `state.result` actual → descarga el archivo vía blob URL.

## Error handling

| Caso | Resultado |
|---|---|
| Sin token / token inválido en cualquier ruta nueva | 401 |
| `result` faltante o con forma incorrecta en `/api/export/pdf` | 400 |
| Logo >1MB o mime type no soportado en `/api/branding` | 400, mensaje claro en el form |
| Sin fila en `user_branding` al exportar | No es error — PDF genérico sin logo |
| Falla de generación de PDF | 500, logueado server-side, mensaje genérico al usuario |

## Testing

Siguiendo el patrón actual del proyecto (solo funciones puras, sin red):
- `src/lib/branding.ts`: función de validación de logo (mime type + tamaño) — testeada en `src/lib/__tests__/branding.test.ts`.
- Cualquier función pura de mapeo de datos hacia las plantillas PDF, si surge alguna durante la implementación.

Las rutas API, la página `/ajustes`, y el render del PDF en sí no llevan test unitario — mismo criterio que el resto de rutas/UI del proyecto hoy (ver tabla "What is and is not tested" en `CLAUDE.md`).
