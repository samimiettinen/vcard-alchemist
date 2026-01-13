import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/**
 * Supabase client for Mix & Match Contact Engine
 * 
 * This client connects to the SAME Supabase project as Consiglieri CRM.
 * The anon key should be added as VITE_SUPABASE_ANON_KEY environment variable.
 * 
 * New tables are prefixed with 'mixmatch_' to avoid conflicts with Consiglieri schema.
 */
const supabaseUrl = 'https://kzprjhogawcsuclftdkt.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

if (!supabaseAnonKey) {
  console.warn('VITE_SUPABASE_ANON_KEY is not set. Database operations will fail.')
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)
