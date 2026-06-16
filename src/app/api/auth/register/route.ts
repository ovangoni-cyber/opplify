import type { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { pool } from '@/lib/db'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  let email: string, password: string, metadata: Record<string, unknown>
  try {
    const body = await req.json()
    email = body.email
    password = body.password
    metadata = body.metadata ?? {}
    if (!email || !password) throw new Error('missing fields')
  } catch {
    return Response.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }

  const passwordHash = await bcrypt.hash(password, 10)

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query(
      'INSERT INTO users (email, password_hash, metadata) VALUES ($1, $2, $3) RETURNING id',
      [email.toLowerCase().trim(), passwordHash, JSON.stringify(metadata)]
    )
    await client.query(
      'INSERT INTO user_credits (user_id, credits) VALUES ($1, 1)',
      [rows[0].id]
    )
    await client.query('COMMIT')
    return Response.json({ ok: true })
  } catch (err: unknown) {
    await client.query('ROLLBACK')
    const pgErr = err as { code?: string }
    if (pgErr.code === '23505') {
      return Response.json({ error: 'Email ya registrado' }, { status: 409 })
    }
    return Response.json({ error: 'Error al crear cuenta' }, { status: 500 })
  } finally {
    client.release()
  }
}
