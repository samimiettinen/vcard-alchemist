/**
 * Database types for Mix & Match Contact Engine
 * 
 * These types define the structure of mixmatch_* tables that coexist
 * with Consiglieri's existing schema in the same Supabase project.
 */

export interface StructuredName {
  familyName: string      // Sukunimi
  givenName: string       // Etunimi
  additionalNames?: string // Lisänimet
  prefix?: string         // Dr., Mr., Ms. etc.
  suffix?: string         // Jr., Sr., PhD etc.
}

export interface PhoneNumber {
  label: 'work' | 'home' | 'cell' | 'fax' | 'other'
  number: string
}

export interface Address {
  label: 'work' | 'home' | 'other'
  street?: string
  city?: string
  region?: string        // Lääni/maakunta
  postalCode?: string
  country?: string
}

export interface UrlEntry {
  label: 'website' | 'linkedin' | 'twitter' | 'github' | 'other'
  url: string
}

export interface SourceLink {
  sourceFileName: string
  sourceType: 'csv' | 'xlsx'
  sourceRowRef: number
  comment?: string
  fieldsFromSource: string[]  // Which fields came from this source
}

export interface NormalizedFields {
  firstName?: string
  lastName?: string
  fullName?: string
  email?: string
  secondaryEmails?: string[]
  phone?: string
  phones?: PhoneNumber[]
  company?: string
  organization?: string
  role?: string
  title?: string
  projectName?: string
  tags?: string[]
  urls?: UrlEntry[]
  address?: Address
  linkedinUrl?: string
  twitterUrl?: string
  websiteUrl?: string
  notes?: string
}

export interface ConfidenceScores {
  [fieldName: string]: number  // 0-1 confidence score per field
}

export type ContactKind = 'individual' | 'org'

// Database table types
export interface SourceFile {
  id: string
  filename: string
  file_type: 'csv' | 'xlsx'
  imported_at: string
  original_headers: string[]
  row_count: number
  created_at?: string
}

export interface RawSourceContact {
  id: string
  source_file_id: string
  row_index: number
  raw_data: Record<string, string>
  normalized_fields: NormalizedFields
  confidence_scores: ConfidenceScores
  created_at?: string
}

export interface MasterContact {
  id: string
  full_name: string
  structured_name: StructuredName
  kind: ContactKind
  primary_email?: string
  secondary_emails: string[]
  phones: PhoneNumber[]
  organization?: string
  title?: string
  urls: UrlEntry[]
  addresses: Address[]
  notes?: string
  tags: string[]
  source_links: SourceLink[]
  consiglieri_contact_id?: string  // Optional FK to Consiglieri contacts table
  created_at?: string
  updated_at?: string
}

export interface MatchCandidate {
  id: string
  master_contact_id: string
  raw_source_contact_id: string
  match_score: number  // 0-1
  match_reason: string
  created_at?: string
}

// Supabase Database type for typed client
export interface Database {
  public: {
    Tables: {
      mixmatch_source_files: {
        Row: SourceFile
        Insert: SourceFile
        Update: Partial<SourceFile>
      }
      mixmatch_raw_contacts: {
        Row: RawSourceContact
        Insert: RawSourceContact
        Update: Partial<RawSourceContact>
      }
      mixmatch_master_contacts: {
        Row: MasterContact
        Insert: MasterContact
        Update: Partial<MasterContact>
      }
      mixmatch_match_candidates: {
        Row: MatchCandidate
        Insert: MatchCandidate
        Update: Partial<MatchCandidate>
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
