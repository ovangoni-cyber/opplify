import type { NextRequest } from 'next/server'
import { pool } from '@/lib/db'
import { verifyToken } from '@/lib/auth-server'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') ?? ''
  const payload = verifyToken(token)
  if (!payload) return Response.json({ error: 'No autorizado' }, { status: 401 })

  const { rows } = await pool.query(
    'SELECT id, city, business_type, mode, created_at FROM search_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
    [payload.sub]
  )
  return Response.json(rows)
}
