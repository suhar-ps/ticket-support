import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[FixHub] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY belum diatur. ' +
    'Salin .env.example menjadi .env dan isi dengan kredensial project Supabase Anda.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
