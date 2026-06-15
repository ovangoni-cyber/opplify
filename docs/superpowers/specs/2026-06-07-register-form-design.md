# Enhanced Registration Form Design

**Date:** 2026-06-07  
**Status:** Approved

## Context

The current registration form only collects email and password. The goal is to collect a full user profile at registration time and send a (non-blocking) confirmation email. Profile data is stored in Supabase Auth's `user_metadata` — no new DB table required.

## Decision

Expand the register tab in `src/app/auth/login/page.tsx` with additional fields. Keep the existing login tab unchanged. Store extra fields via `supabase.auth.signUp({ options: { data: {...} } })`.

## Form Fields (register tab only)

| Field | Type | Required |
|-------|------|----------|
| Nombre | text | yes |
| Apellido | text | yes |
| Email | email | yes |
| Contraseña | password, minLength 6 | yes |
| Fecha de nacimiento | date | yes |
| Teléfono | tel | yes |
| País | select (full country list) | yes |
| Términos y condiciones | checkbox | yes |

Layout: Nombre + Apellido in a 2-column grid. All other fields full-width.

## Email Confirmation

Supabase "Confirm email" remains **disabled**. The user is immediately active after signUp. Supabase sends its default signup notification email (informational only — does not block access). No custom email infrastructure needed.

## Data Flow

```
User fills form → signUp({ email, password, options: { data: { first_name, last_name, dob, phone, country } } })
  → on success: signInWithPassword({ email, password })
  → router.replace(redirect)
```

On error: display `error.message` below the form (existing pattern).

## State

The register form needs its own state fields:
- `firstName`, `lastName` (string)
- `dob` (string, ISO date from input)
- `phone` (string)
- `country` (string, ISO 3166-1 alpha-2 or full name)
- `termsAccepted` (boolean)

The submit button is disabled if `termsAccepted` is false or `status === 'loading'`.

## Country List

Use a static array of `{ value: string; label: string }` — no external library. ~50 most common countries is sufficient. Full ISO list optional but unnecessary for this audience.

## What Does NOT Change

- Login tab: email + password only, unchanged
- `/buscar` page, results, API routes: no changes
- Supabase DB schema: no migrations
- `useAuth` hook: unchanged — `user.user_metadata` is already accessible

## Files Changed

| File | Change |
|------|--------|
| `src/app/auth/login/page.tsx` | Add fields, state, country list, terms checkbox to register tab |

## Verification

1. Register with all fields filled → redirects to `/buscar`
2. Check Supabase Dashboard → Auth → Users → user has `raw_user_meta_data` with `first_name`, `last_name`, `dob`, `phone`, `country`
3. Submit with `termsAccepted = false` → button disabled, can't submit
4. Login tab still works as before
5. `npx tsc --noEmit` → no errors
