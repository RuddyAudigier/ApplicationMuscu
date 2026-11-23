import { createClient } from '@supabase/supabase-js'

// Configuration Supabase
// ⚠️ IMPORTANT: Remplacez ces valeurs par vos clés Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key'

// Créer le client Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export default supabase
