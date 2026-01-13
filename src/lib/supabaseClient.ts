import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/**
 * Supabase client for Mix & Match Contact Engine
 * Connects to the same Supabase project as Consiglieri CRM.
 */
const SUPABASE_URL = "https://kzprjhogawcsuclftdkt.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6cHJqaG9nYXdjc3VjbGZ0ZGt0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0NjE5OTcsImV4cCI6MjA4MTAzNzk5N30.A9ochLfTKA_5XRdTh9nPdGEoLDk-F6a3CdfcpqpD8qU"

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY)
