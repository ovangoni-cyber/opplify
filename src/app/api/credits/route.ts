import type { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') ?? ''
  if (!token) return Response.json({ credits: null }, { status: 401 })

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user) return Response.json({ credits: null }, { status: 401 })

  const { data } = await supabaseAdmin
    .from('user_credits')
    .select('credits')
    .eq('user_id', user.id)
    .single()

  return Response.json({ credits: data?.credits ?? 0 })
}
