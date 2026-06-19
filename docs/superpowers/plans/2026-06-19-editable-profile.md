# Editable Profile (Mis datos) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let any user edit their full profile (registration fields, agency branding, password) from a single "Mis datos" card on `/ajustes`.

**Architecture:** A new `src/app/api/profile/route.ts` (GET/POST, same auth pattern as `/api/branding`) reads/writes the `metadata` jsonb column on `users` and, on `POST`, optionally changes `password_hash` inside a transaction after verifying the current password. `src/app/ajustes/page.tsx` is rewritten to one card with three sections (Perfil / Marca / Contraseña) sharing one submit handler that calls `/api/profile` then `/api/branding` (unchanged). `COUNTRIES` is extracted to a shared file since both the registration form and this page need the same 32-entry list.

**Tech Stack:** Next.js 16.2.6 App Router, `pg`, `bcryptjs`, TypeScript, Tailwind CSS custom properties theme system.

---

### Task 1: Extract `COUNTRIES` to a shared file

**Files:**
- Create: `src/lib/countries.ts`
- Modify: `src/app/auth/login/page.tsx`

- [ ] **Step 1: Create the shared constant**

```ts
export const COUNTRIES = [
  { value: 'AR', label: 'Argentina' },
  { value: 'BO', label: 'Bolivia' },
  { value: 'BR', label: 'Brasil' },
  { value: 'CA', label: 'Canadá' },
  { value: 'CL', label: 'Chile' },
  { value: 'CO', label: 'Colombia' },
  { value: 'CR', label: 'Costa Rica' },
  { value: 'CU', label: 'Cuba' },
  { value: 'DO', label: 'República Dominicana' },
  { value: 'EC', label: 'Ecuador' },
  { value: 'SV', label: 'El Salvador' },
  { value: 'ES', label: 'España' },
  { value: 'US', label: 'Estados Unidos' },
  { value: 'GT', label: 'Guatemala' },
  { value: 'HN', label: 'Honduras' },
  { value: 'MX', label: 'México' },
  { value: 'NI', label: 'Nicaragua' },
  { value: 'PA', label: 'Panamá' },
  { value: 'PY', label: 'Paraguay' },
  { value: 'PE', label: 'Perú' },
  { value: 'PT', label: 'Portugal' },
  { value: 'PR', label: 'Puerto Rico' },
  { value: 'UY', label: 'Uruguay' },
  { value: 'VE', label: 'Venezuela' },
  { value: 'DE', label: 'Alemania' },
  { value: 'FR', label: 'Francia' },
  { value: 'GB', label: 'Reino Unido' },
  { value: 'IT', label: 'Italia' },
  { value: 'NL', label: 'Países Bajos' },
  { value: 'CH', label: 'Suiza' },
  { value: 'AU', label: 'Australia' },
  { value: 'JP', label: 'Japón' },
  { value: 'OTHER', label: 'Otro' },
]
```

- [ ] **Step 2: Remove the inline copy from the login page and import the shared one**

Find:
```tsx
import { authClient } from '@/lib/auth-client'

const COUNTRIES = [
  { value: 'AR', label: 'Argentina' },
  { value: 'BO', label: 'Bolivia' },
  { value: 'BR', label: 'Brasil' },
  { value: 'CA', label: 'Canadá' },
  { value: 'CL', label: 'Chile' },
  { value: 'CO', label: 'Colombia' },
  { value: 'CR', label: 'Costa Rica' },
  { value: 'CU', label: 'Cuba' },
  { value: 'DO', label: 'República Dominicana' },
  { value: 'EC', label: 'Ecuador' },
  { value: 'SV', label: 'El Salvador' },
  { value: 'ES', label: 'España' },
  { value: 'US', label: 'Estados Unidos' },
  { value: 'GT', label: 'Guatemala' },
  { value: 'HN', label: 'Honduras' },
  { value: 'MX', label: 'México' },
  { value: 'NI', label: 'Nicaragua' },
  { value: 'PA', label: 'Panamá' },
  { value: 'PY', label: 'Paraguay' },
  { value: 'PE', label: 'Perú' },
  { value: 'PT', label: 'Portugal' },
  { value: 'PR', label: 'Puerto Rico' },
  { value: 'UY', label: 'Uruguay' },
  { value: 'VE', label: 'Venezuela' },
  { value: 'DE', label: 'Alemania' },
  { value: 'FR', label: 'Francia' },
  { value: 'GB', label: 'Reino Unido' },
  { value: 'IT', label: 'Italia' },
  { value: 'NL', label: 'Países Bajos' },
  { value: 'CH', label: 'Suiza' },
  { value: 'AU', label: 'Australia' },
  { value: 'JP', label: 'Japón' },
  { value: 'OTHER', label: 'Otro' },
]

const INPUT_CLASS =
```
Replace with:
```tsx
import { authClient } from '@/lib/auth-client'
import { COUNTRIES } from '@/lib/countries'

const INPUT_CLASS =
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/countries.ts src/app/auth/login/page.tsx
git commit -m "refactor: extract COUNTRIES list to shared module"
```

---

### Task 2: Create the `/api/profile` endpoint

**Files:**
- Create: `src/app/api/profile/route.ts`

- [ ] **Step 1: Create the file**

```ts
import type { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { pool } from '@/lib/db'
import { verifyToken } from '@/lib/auth-server'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') ?? ''
  const payload = verifyToken(token)
  if (!payload) return Response.json({ error: 'No autorizado' }, { status: 401 })

  const { rows } = await pool.query('SELECT metadata FROM users WHERE id = $1', [payload.sub])
  const metadata = rows[0]?.metadata ?? {}

  return Response.json({
    first_name: metadata.first_name ?? '',
    last_name: metadata.last_name ?? '',
    dob: metadata.dob ?? '',
    phone: metadata.phone ?? '',
    country: metadata.country ?? '',
  })
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') ?? ''
  const payload = verifyToken(token)
  if (!payload) return Response.json({ error: 'No autorizado' }, { status: 401 })

  let firstName: string, lastName: string, dob: string, phone: string, country: string
  let currentPassword: string, newPassword: string
  try {
    const body = await req.json()
    firstName = body.first_name ?? ''
    lastName = body.last_name ?? ''
    dob = body.dob ?? ''
    phone = body.phone ?? ''
    country = body.country ?? ''
    currentPassword = body.current_password ?? ''
    newPassword = body.new_password ?? ''
  } catch {
    return Response.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }

  const wantsPasswordChange = newPassword.length > 0

  if (wantsPasswordChange) {
    if (!currentPassword) {
      return Response.json({ error: 'Falta la contraseña actual' }, { status: 400 })
    }
    if (newPassword.length < 6) {
      return Response.json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' }, { status: 400 })
    }
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    if (wantsPasswordChange) {
      const { rows } = await client.query('SELECT password_hash FROM users WHERE id = $1', [payload.sub])
      const valid = rows[0] && (await bcrypt.compare(currentPassword, rows[0].password_hash))
      if (!valid) {
        await client.query('ROLLBACK')
        return Response.json({ error: 'Contraseña actual incorrecta' }, { status: 400 })
      }
      const newHash = await bcrypt.hash(newPassword, 10)
      await client.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, payload.sub])
    }

    const metadata = { first_name: firstName, last_name: lastName, dob, phone, country }
    await client.query('UPDATE users SET metadata = $1 WHERE id = $2', [JSON.stringify(metadata), payload.sub])

    await client.query('COMMIT')
    return Response.json({ ok: true })
  } catch {
    await client.query('ROLLBACK')
    return Response.json({ error: 'Error al guardar' }, { status: 500 })
  } finally {
    client.release()
  }
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/profile/route.ts
git commit -m "feat: add /api/profile endpoint for editable profile + password change"
```

---

### Task 3: Rewrite `src/app/ajustes/page.tsx` into a single "Mis datos" card

**Files:**
- Modify: `src/app/ajustes/page.tsx`

This is a full-file rewrite — the current file (one card, agency branding only) becomes one card with three sections (Perfil / Marca / Contraseña) sharing one submit handler.

- [ ] **Step 1: Replace the entire file content**

Replace the full contents of `src/app/ajustes/page.tsx` with:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'
import { useAuth } from '@/hooks/useAuth'
import { AppHeader } from '@/components/AppHeader'
import { AppFooter } from '@/components/AppFooter'
import { COUNTRIES } from '@/lib/countries'

const INPUT_CLASS =
  'w-full px-3 py-2.5 rounded-lg border border-border bg-input text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 transition-colors'

function splitDataUrl(dataUrl: string): { mime: string; base64: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) return null
  return { mime: match[1], base64: match[2] }
}

export default function AjustesPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [dob, setDob] = useState('')
  const [phone, setPhone] = useState('')
  const [country, setCountry] = useState('')

  const [agencyName, setAgencyName] = useState('')
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace('/auth/login?redirect=/ajustes')
      return
    }

    authClient
      .getSession()
      .then(({ data: sessionData }) => {
        const token = sessionData.session?.access_token
        const headers = token ? { Authorization: `Bearer ${token}` } : {}

        return Promise.all([
          fetch('/api/profile', { headers }).then((res) => res.json()),
          fetch('/api/branding', { headers }).then((res) => res.json()),
        ])
      })
      .then(([profile, branding]) => {
        setFirstName(profile.first_name ?? '')
        setLastName(profile.last_name ?? '')
        setDob(profile.dob ?? '')
        setPhone(profile.phone ?? '')
        setCountry(profile.country ?? '')
        setAgencyName(branding.agency_name ?? '')
        setLogoDataUrl(branding.logo ?? null)
        setLoading(false)
      })
      .catch(() => {
        setLoading(false)
      })
  }, [user, authLoading, router])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setLogoDataUrl(reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    if (newPassword && newPassword !== confirmPassword) {
      setErrorMsg('Las contraseñas no coinciden')
      setSaveStatus('error')
      return
    }
    if (newPassword && !currentPassword) {
      setErrorMsg('Falta la contraseña actual')
      setSaveStatus('error')
      return
    }

    setSaveStatus('saving')

    const { data: sessionData } = await authClient.getSession()
    const token = sessionData.session?.access_token
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }

    const profileRes = await fetch('/api/profile', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        first_name: firstName,
        last_name: lastName,
        dob,
        phone,
        country,
        current_password: currentPassword || undefined,
        new_password: newPassword || undefined,
      }),
    })
    const profileData = await profileRes.json()
    if (!profileRes.ok) {
      setErrorMsg(profileData.error ?? 'Error al guardar')
      setSaveStatus('error')
      return
    }

    const split = logoDataUrl ? splitDataUrl(logoDataUrl) : null
    const brandingRes = await fetch('/api/branding', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        agency_name: agencyName,
        logo_base64: split?.base64 ?? null,
        logo_mime: split?.mime ?? null,
      }),
    })
    const brandingData = await brandingRes.json()
    if (!brandingRes.ok) {
      setErrorMsg(brandingData.error ?? 'Perfil guardado, pero la marca no se pudo guardar')
      setSaveStatus('error')
      return
    }

    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setSaveStatus('saved')
  }

  if (loading) {
    return <div className="min-h-screen bg-background" />
  }

  return (
    <div className="min-h-screen">
      <AppHeader />

      <div className="max-w-sm mx-auto px-6 py-10">
        <h1 className="font-heading font-bold text-2xl tracking-tight mb-1" style={{ letterSpacing: '-0.02em' }}>
          Mis datos
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          Edita tu perfil, tu marca y tu contraseña.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              Perfil
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Nombre"
                required
                className={INPUT_CLASS}
              />
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Apellido"
                required
                className={INPUT_CLASS}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                Fecha de nacimiento
              </label>
              <input
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                required
                className={INPUT_CLASS}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                Teléfono
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+34 600 000 000"
                required
                className={INPUT_CLASS}
              />
            </div>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              required
              className={INPUT_CLASS}
            >
              <option value="" disabled>País</option>
              {COUNTRIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-4">
            <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              Marca
            </h2>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                Nombre de agencia
              </label>
              <input
                type="text"
                value={agencyName}
                onChange={(e) => setAgencyName(e.target.value)}
                placeholder="Mi Agencia Digital"
                className={INPUT_CLASS}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                Logo (PNG o JPG, máx. 1MB)
              </label>
              {logoDataUrl && (
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={logoDataUrl} alt="Logo actual" className="h-12 w-12 object-contain rounded border border-border" />
                  <button
                    type="button"
                    onClick={() => setLogoDataUrl(null)}
                    className="text-xs text-rose-400 hover:text-rose-300 transition-colors"
                  >
                    Quitar logo
                  </button>
                </div>
              )}
              <input type="file" accept="image/png,image/jpeg" onChange={handleFileChange} className={INPUT_CLASS} />
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              Cambiar contraseña
            </h2>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Contraseña actual"
              autoComplete="current-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className={INPUT_CLASS}
            />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Nueva contraseña (déjalo en blanco para no cambiarla)"
              minLength={6}
              autoComplete="new-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className={INPUT_CLASS}
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirmar nueva contraseña"
              autoComplete="new-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className={INPUT_CLASS}
            />
          </div>

          {errorMsg && <p className="text-xs text-rose-400">{errorMsg}</p>}
          {saveStatus === 'saved' && <p className="text-xs text-primary">Guardado correctamente.</p>}

          <button
            type="submit"
            disabled={saveStatus === 'saving'}
            className="btn-press w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {saveStatus === 'saving' ? 'Guardando...' : 'Guardar'}
          </button>
        </form>
      </div>
      <AppFooter />
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/ajustes/page.tsx
git commit -m "feat: merge profile, branding, and password into one Mis datos card"
```

---

### Task 4: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full automated suite**

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
```
Expected: all four pass clean. For `lint`, confirm specifically that the new/modified files produce zero new warnings/errors:
```bash
npm run lint 2>&1 | grep -E "countries\.ts|api\\\\profile|app\\\\auth\\\\login\\\\page\.tsx|app\\\\ajustes\\\\page\.tsx"
```
Expected: no output.

- [ ] **Step 2: Manual verification checklist**

1. Log in, visit `/ajustes` — confirm the five profile fields (Nombre, Apellido, Fecha de nacimiento, Teléfono, País) are prefilled with the real account data from registration, and the existing agency name/logo (if any) still load correctly in the "Marca" section.
2. Edit a profile field (e.g. Teléfono) and click "Guardar" without touching the password fields — confirm "Guardado correctamente.", then reload the page and confirm the new value persisted.
3. Fill "Nueva contraseña" and "Confirmar nueva contraseña" with two different values — confirm the inline error "Las contraseñas no coinciden" appears and no request is sent (check the Network tab shows no `/api/profile` call).
4. Fill "Nueva contraseña" + matching "Confirmar nueva contraseña" but leave "Contraseña actual" empty — confirm the inline error "Falta la contraseña actual" appears, no request is sent.
5. Fill all three password fields with the wrong current password — confirm the server-returned error "Contraseña actual incorrecta" appears, and reloading the page shows the profile fields unchanged (nothing was saved, including the profile edits in the same submit).
6. Repeat with the correct current password and a new password (6+ characters) — confirm "Guardado correctamente.", then sign out and sign back in using the new password to confirm it actually changed.
7. Confirm the three password fields are empty again after a successful save (don't get reloaded with stale values).

- [ ] **Step 3: Report results**

No commit for this task — it's verification only. Report PASS/FAIL with specifics for any failed check.

---

### Task 5: Document the new endpoint and shared module in `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add a row for `/api/profile` next to `/api/branding` in the "Key files and their responsibilities" table**

Find:
```
| `src/app/api/branding/route.ts` | Node runtime. `GET` returns `{ agency_name, logo }` (logo as a data URL) for the authenticated user; `POST` upserts both, fully replacing the row each time — never a partial update. |
```
Replace with:
```
| `src/app/api/branding/route.ts` | Node runtime. `GET` returns `{ agency_name, logo }` (logo as a data URL) for the authenticated user; `POST` upserts both, fully replacing the row each time — never a partial update. Edited from the same "Mis datos" card on `/ajustes` as `/api/profile`. |
| `src/app/api/profile/route.ts` | Node runtime. `GET` returns the registration profile fields (`first_name`/`last_name`/`dob`/`phone`/`country`) read from `users.metadata`, defaulting missing keys to `''`. `POST` updates those fields and, if `new_password` is present, verifies `current_password` via `bcrypt.compare` and updates `password_hash` — both writes happen in one transaction, so a wrong current password rolls back the profile-field update too. |
```

- [ ] **Step 2: Add a row for `src/lib/countries.ts`**

Find:
```
| `src/lib/credit-packs.ts` | Client-safe pack definitions (name, price, credits). No Stripe import. Use in client components instead of `stripe.ts`. |
```
Replace with:
```
| `src/lib/credit-packs.ts` | Client-safe pack definitions (name, price, credits). No Stripe import. Use in client components instead of `stripe.ts`. |
| `src/lib/countries.ts` | `COUNTRIES` — shared 32-entry country list used by both the registration form (`auth/login/page.tsx`) and the profile editor (`ajustes/page.tsx`). |
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document /api/profile and countries.ts in CLAUDE.md"
```
