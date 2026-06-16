import type { NextRequest } from 'next/server'
import { pool } from '@/lib/db'
import { verifyToken } from '@/lib/auth-server'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') ?? ''
  const payload = verifyToken(token)
  if (!payload) return Response.json({ credits: null }, { status: 401 })

  const { rows } = await pool.query(
    'SELECT credits FROM user_credits WHERE user_id = $1',
    [payload.sub]
  )
  return Response.json({ credits: rows[0]?.credits ?? 0 })
}
