# Contactos en leads (teléfono y web) — Design

## Context

En modo `agency_leads`, cada `AgencyLead` muestra hoy nombre, dirección, rating, score, pain points, servicios recomendados y un pitch generado por Claude — pero ningún dato de contacto. El usuario quiere poder contactar directamente a cada lead: teléfono asociado a la ficha de Google del negocio, y correo electrónico.

**Limitación técnica:** la API de Google Places (la única fuente de datos de negocios de este proyecto) no expone direcciones de correo electrónico bajo ningún campo — no es un dato que Google ofrezca para fichas de negocio. Sí expone el teléfono (`internationalPhoneNumber`) y, cuando el negocio lo tiene configurado, su web (`websiteUri`). Decisión del usuario: en lugar de email, se añaden teléfono y web — la web permite al usuario de la agencia llegar al contacto real (formulario, email visible en la propia página) por su cuenta.

## Scope

- Solo modo `agency_leads`. `market_research` no se toca.
- Dos campos nuevos: `phone` y `website`, ambos `string | null`.
- Los datos vienen siempre de Google Places, nunca generados o copiados por Claude — evita el riesgo de que un LLM altere un dígito de un teléfono real.
- Se muestran en los 3 lugares donde ya se renderiza un `AgencyLead`: la tarjeta en pantalla, el CSV exportable y el PDF exportable.
- Fuera de alcance: scraping de páginas web para extraer email, verificación de que el teléfono/web siguen activos, cualquier integración de contacto (envío de SMS, click-to-call más allá de un `tel:` estándar).

## Diseño

### 1. Captura de datos: `src/lib/google-places.ts`

El field mask de `searchPlacesPage` (línea 65) gana dos campos:

Find:
```ts
      'X-Goog-FieldMask':
        'places.displayName,places.rating,places.userRatingCount,places.formattedAddress,places.types,places.priceLevel,places.id,nextPageToken',
```
Replace with:
```ts
      'X-Goog-FieldMask':
        'places.displayName,places.rating,places.userRatingCount,places.formattedAddress,places.types,places.priceLevel,places.id,places.internationalPhoneNumber,places.websiteUri,nextPageToken',
```

El tipo `PlaceItem` gana los dos campos crudos de Google:
```ts
type PlaceItem = {
  displayName?: { text: string }
  rating?: number
  userRatingCount?: number
  formattedAddress?: string
  types?: string[]
  priceLevel?: string
  id?: string
  internationalPhoneNumber?: string
  websiteUri?: string
}
```

`fetchAndNormalizePlaces` copia ambos al construir cada `NormalizedBusiness`:
```ts
    normalized.push({
      name: p.displayName?.text ?? 'Sin nombre',
      rating,
      review_count: p.userRatingCount ?? 0,
      address: p.formattedAddress ?? '',
      types: p.types ?? [],
      price_level: priceLevelFromString(p.priceLevel),
      recent_reviews: reviews,
      phone: p.internationalPhoneNumber ?? null,
      website: p.websiteUri ?? null,
    })
```

**Nota de coste:** `internationalPhoneNumber` y `websiteUri` pertenecen al nivel "Contact Data" de la API de Places (New). Esta app ya solicita campos de "Atmosphere Data" (`rating`, `priceLevel`, `userRatingCount`), que es el nivel de precio más alto de Text Search; "Contact Data" no añade un nivel superior a ese, así que no se espera un aumento de coste por petición. Queda documentado por si Google cambia su modelo de precios.

### 2. Tipos: `src/types/analysis.ts`

`NormalizedBusiness` (interno) gana los dos campos:
```ts
export type NormalizedBusiness = {
  name: string
  rating: number
  review_count: number
  address: string
  types: string[]
  price_level: number | null
  recent_reviews: string[]
  phone: string | null
  website: string | null
}
```

`AgencyLead` (expuesto al frontend) gana los mismos dos campos:
```ts
export type AgencyLead = {
  business_name: string
  address: string
  rating: number
  review_count: number
  lead_score: number
  pain_points: string[]
  recommended_services: AgencyService[]
  summary: string
  pitch: string
  phone: string | null
  website: string | null
}
```

### 3. Fusión por nombre: `src/lib/claude.ts`

Tras parsear la respuesta de Claude (`parseAgencyLeadsJson`), un paso nuevo recorre `result.leads` y copia `phone`/`website` desde `context.businesses`, buscando por nombre normalizado (minúsculas), igual que el filtro `exclude` ya hace en `route.ts:95`. Si no hay match exacto, ambos quedan `null` — no es un error, es el comportamiento esperado cuando Claude reformula ligeramente un nombre o cuando el negocio simplemente no tiene esos datos en Google.

Nueva función, definida antes de `streamAnalysis`:
```ts
function attachContactInfo(
  result: AgencyLeadsResult,
  context: PlacesContext
): AgencyLeadsResult {
  const byName = new Map(
    context.businesses.map((b) => [b.name.toLowerCase(), b])
  )
  return {
    ...result,
    leads: result.leads.map((lead) => {
      const match = byName.get(lead.business_name.toLowerCase())
      return {
        ...lead,
        phone: match?.phone ?? null,
        website: match?.website ?? null,
      }
    }),
  }
}
```

En `streamAnalysis`, el branch `agency_leads` pasa el resultado por esta función antes de devolverlo:

Find:
```ts
  if (mode === 'agency_leads') {
    try {
      return parseAgencyLeadsJson(jsonStr)
    } catch {
      const match = jsonStr.match(/\{[\s\S]*\}/)
      if (!match) throw new Error('No JSON object found in Claude agency leads response')
      return parseAgencyLeadsJson(match[0])
    }
  }
```
Replace with:
```ts
  if (mode === 'agency_leads') {
    try {
      return attachContactInfo(parseAgencyLeadsJson(jsonStr), context)
    } catch {
      const match = jsonStr.match(/\{[\s\S]*\}/)
      if (!match) throw new Error('No JSON object found in Claude agency leads response')
      return attachContactInfo(parseAgencyLeadsJson(match[0]), context)
    }
  }
```

`parseAgencyLeadsJson` (la función pura ya testeada) no cambia — sigue parseando solo lo que Claude genera. `attachContactInfo` es una función nueva, pura y testeable de la misma forma (recibe `AgencyLeadsResult` + `PlacesContext`, devuelve `AgencyLeadsResult`), consistente con el criterio de testing de este repo.

El prompt (`buildAgencyLeadsPrompt`) no cambia — Claude no necesita ver teléfono/web para puntuar leads, y no se le pide que los reproduzca.

### 4. UI: `src/components/results/AgencyLeadCard.tsx`

Debajo de la línea de dirección/rating existente, una línea nueva con teléfono y web (solo si al menos uno existe):

```tsx
{(lead.phone || lead.website) && (
  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-3">
    {lead.phone && (
      <a href={`tel:${lead.phone.replace(/\s+/g, '')}`} className="hover:text-primary transition-colors">
        {lead.phone}
      </a>
    )}
    {lead.website && (
      <a
        href={lead.website}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-primary transition-colors truncate"
      >
        Web ↗
      </a>
    )}
  </p>
)}
```

Si falta uno de los dos, simplemente no se renderiza ese `<a>` — no se muestra un placeholder negativo (a diferencia de `rating`, donde "Sin rating" es informativo porque 0 podría confundirse con un rating real de 0; aquí `null` ya es inequívoco).

### 5. CSV: `src/lib/export-csv.ts`

Dos columnas nuevas al final, después de "Pitch":

```ts
export function buildCsvContent(leads: AgencyLead[]): string {
  const header = 'Nombre,Dirección,Rating,Reseñas,Score,Pain Points,Servicios,Pitch,Teléfono,Web'
  const rows = leads.map((lead) => [
    escapeField(lead.business_name),
    escapeField(lead.address),
    String(lead.rating),
    String(lead.review_count),
    String(lead.lead_score),
    escapeField(lead.pain_points.join(' | ')),
    escapeField(lead.recommended_services.join(' | ')),
    escapeField(lead.pitch),
    escapeField(lead.phone ?? ''),
    escapeField(lead.website ?? ''),
  ].join(','))
  return [header, ...rows].join('\n')
}
```

### 6. PDF: `src/lib/pdf/agency-leads-template.tsx`

La línea de metadatos existente (dirección · rating) gana teléfono y web cuando existen:

Find:
```tsx
            <Text style={styles.leadMeta}>
              {lead.address} · {lead.rating > 0 ? `${lead.rating}★ (${lead.review_count})` : 'Sin rating'}
            </Text>
```
Replace with:
```tsx
            <Text style={styles.leadMeta}>
              {lead.address} · {lead.rating > 0 ? `${lead.rating}★ (${lead.review_count})` : 'Sin rating'}
              {lead.phone ? ` · ${lead.phone}` : ''}
              {lead.website ? ` · ${lead.website}` : ''}
            </Text>
```

`@react-pdf/renderer` no soporta enlaces clicables de forma fiable en todos los lectores de PDF para este patrón de texto inline, así que aquí teléfono/web son texto plano, no enlaces — consistente con que el resto de esa línea (dirección, rating) tampoco es interactivo.

## Manejo de errores

- Google Places no devuelve `internationalPhoneNumber`/`websiteUri` para un negocio → quedan `null`, sin error, mismo patrón que `rating: 0` o `address: ''` ya manejan hoy datos ausentes.
- Claude reformula el nombre de un negocio de forma que no coincide con ningún `context.businesses[].name` → `attachContactInfo` no encuentra match, `phone`/`website` quedan `null` para ese lead. No es un fallo del pipeline, es degradación silenciosa consistente con cómo ya se trata cualquier dato ausente en esta app.
- No hay nuevos casos de error de red ni nuevas llamadas a APIs externas — los datos viajan en la misma petición `searchText` que ya se hace.

## Testing

`attachContactInfo` es una función pura (recibe `AgencyLeadsResult` + `PlacesContext`, sin red ni estado) — entra dentro del criterio de testing de este repo (`CLAUDE.md`: "solo funciones puras se testean"), a diferencia del resto de los cambios de esta spec (UI, CSV, PDF), que son presentacionales sin lógica.

Casos a cubrir en `src/lib/__tests__/claude.test.ts` (o un archivo nuevo si ese no es el lugar adecuado — a decidir en el plan de implementación):
- Match exacto por nombre (mismas mayúsculas/minúsculas) → copia `phone`/`website`.
- Match case-insensitive (Claude devuelve el nombre con distinta capitalización) → copia igual.
- Sin match (nombre no aparece en `context.businesses`) → `phone`/`website` quedan `null`, el resto del lead no se altera.
- Negocio con `phone`/`website` ambos `null` en origen → el lead resultante también los tiene `null`, sin lanzar error.

## Tests existentes a actualizar

`src/lib/__tests__/export-csv.test.ts` define un fixture `baseLead: AgencyLead` (línea 5) que dejará de compilar en cuanto `AgencyLead` gane los dos campos nuevos — necesita `phone`/`website` añadidos al fixture, y sus aserciones sobre el string de cabecera (`'Nombre,Dirección,...'`) necesitan el sufijo `,Teléfono,Web`. `src/lib/__tests__/claude.test.ts` solo referencia `business_name` dentro de fixtures para `parseAgencyLeadsJson` (que no cambia en esta spec), pero si ese mismo archivo es donde se añaden los tests de `attachContactInfo`, necesitará fixtures propios de `PlacesContext`/`NormalizedBusiness` con `phone`/`website`.
