import type { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { pool } from '@/lib/db'
import { signToken } from '@/lib/auth-server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  let email: string, password: string
  try {
    const body = await req.json()
    email = body.email
    password = body.password
    if (!email || !password) throw new Error('missing fields')
  } catch {
    return Response.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }

  const { rows } = await pool.query(
    'SELECT id, email, password_hash FROM users WHERE email = $1',
    [email.toLowerCase().trim()]
  )
  const user = rows[0]

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return Response.json({ error: 'Email o contraseña incorrectos' }, { status: 401 })
  }

  const token = signToken({ sub: user.id, email: user.email })
  return Response.json({ token })
}
