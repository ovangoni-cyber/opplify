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
