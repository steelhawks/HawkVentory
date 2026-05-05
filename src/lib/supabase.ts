import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const hasSupabaseConfig = Boolean(url && anonKey)

// Untyped client — app-level code uses Row/Item/Location types from database.types.ts directly.
// Switch to a generated Database generic via `supabase gen types typescript` once the schema is stable.
export const supabase = createClient(url ?? 'http://localhost', anonKey ?? 'placeholder', {
  auth: { persistSession: true, autoRefreshToken: true },
})
