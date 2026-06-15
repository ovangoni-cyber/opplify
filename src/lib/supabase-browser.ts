import { createClient } from '@supabase/supabase-js'

// Implicit flow: magic link tokens delivered via URL hash, no @supabase/ssr needed
export const supabaseBrowser = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { flowType: 'implicit', persistSession: true } }
)
