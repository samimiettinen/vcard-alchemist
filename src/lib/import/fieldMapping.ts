import type { NormalizedFields, ConfidenceScores, PhoneNumber, UrlEntry } from '@/types/database'

/**
 * Standard field types that we map columns to
 */
export type StandardField = 
  | 'firstName'
  | 'lastName'
  | 'fullName'
  | 'email'
  | 'phone'
  | 'company'
  | 'title'
  | 'linkedinUrl'
  | 'twitterUrl'
  | 'websiteUrl'
  | 'address'
  | 'city'
  | 'country'
  | 'postalCode'
  | 'tags'
  | 'notes'
  | 'ignore'

export interface FieldMapping {
  sourceColumn: string
  targetField: StandardField
  confidence: number
}

/**
 * Heuristic patterns for auto-detecting field types
 * Supports both English and Finnish column names
 */
const FIELD_PATTERNS: Record<StandardField, RegExp[]> = {
  firstName: [
    /^(first[_\s]?name|fname|given[_\s]?name|etunimi|forename)$/i
  ],
  lastName: [
    /^(last[_\s]?name|lname|surname|family[_\s]?name|sukunimi)$/i
  ],
  fullName: [
    /^(full[_\s]?name|name|nimi|contact[_\s]?name|henkilö)$/i
  ],
  email: [
    /^(e[\-_]?mail|email[_\s]?address|sähköposti|work[_\s]?email|primary[_\s]?email)$/i
  ],
  phone: [
    /^(phone|telephone|tel|puhelin|mobile|gsm|cell|work[_\s]?phone|puhelinnumero)$/i
  ],
  company: [
    /^(company|organization|organisation|org|yritys|employer|firma|organisaatio)$/i
  ],
  title: [
    /^(title|job[_\s]?title|position|role|rooli|tehtävä|nimike|titteli)$/i
  ],
  linkedinUrl: [
    /^(linkedin|linkedin[_\s]?url|linkedin[_\s]?profile)$/i
  ],
  twitterUrl: [
    /^(twitter|x|twitter[_\s]?url|twitter[_\s]?handle)$/i
  ],
  websiteUrl: [
    /^(website|web|url|homepage|kotisivu|www)$/i
  ],
  address: [
    /^(address|street|osoite|katuosoite|street[_\s]?address)$/i
  ],
  city: [
    /^(city|kaupunki|town|paikkakunta)$/i
  ],
  country: [
    /^(country|maa|nation)$/i
  ],
  postalCode: [
    /^(postal[_\s]?code|zip|zip[_\s]?code|postinumero|post[_\s]?code)$/i
  ],
  tags: [
    /^(tags|labels|categories|tagit|tunnisteet)$/i
  ],
  notes: [
    /^(notes|comments|description|muistiinpanot|huomautukset|kuvaus)$/i
  ],
  ignore: []
}

/**
 * Auto-detect field mappings based on column headers
 */
export function autoDetectMappings(headers: string[]): FieldMapping[] {
  return headers.map(header => {
    const normalizedHeader = header.toLowerCase().trim()
    
    for (const [field, patterns] of Object.entries(FIELD_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(normalizedHeader)) {
          return {
            sourceColumn: header,
            targetField: field as StandardField,
            confidence: 0.9
          }
        }
      }
    }
    
    // Fuzzy matching for partial matches
    for (const [field, patterns] of Object.entries(FIELD_PATTERNS)) {
      for (const pattern of patterns) {
        const patternStr = pattern.source.replace(/[\^$]/g, '')
        if (normalizedHeader.includes(patternStr.split('|')[0].replace(/[()\\]/g, ''))) {
          return {
            sourceColumn: header,
            targetField: field as StandardField,
            confidence: 0.6
          }
        }
      }
    }
    
    // Default to ignore if no match found
    return {
      sourceColumn: header,
      targetField: 'ignore' as StandardField,
      confidence: 0
    }
  })
}

/**
 * Normalize a raw contact row using the provided field mappings
 */
export function normalizeContact(
  rawData: Record<string, string>,
  mappings: FieldMapping[]
): { normalized: NormalizedFields; confidenceScores: ConfidenceScores } {
  const normalized: NormalizedFields = {}
  const confidenceScores: ConfidenceScores = {}
  
  for (const mapping of mappings) {
    if (mapping.targetField === 'ignore') continue
    
    const value = rawData[mapping.sourceColumn]?.trim()
    if (!value) continue
    
    const confidence = calculateFieldConfidence(mapping.targetField, value, mapping.confidence)
    
    switch (mapping.targetField) {
      case 'firstName':
        normalized.firstName = value
        confidenceScores.firstName = confidence
        break
      case 'lastName':
        normalized.lastName = value
        confidenceScores.lastName = confidence
        break
      case 'fullName':
        normalized.fullName = value
        confidenceScores.fullName = confidence
        // Try to extract first/last name from full name
        if (!normalized.firstName && !normalized.lastName) {
          const parts = value.split(/\s+/)
          if (parts.length >= 2) {
            normalized.firstName = parts[0]
            normalized.lastName = parts.slice(1).join(' ')
            confidenceScores.firstName = confidence * 0.8
            confidenceScores.lastName = confidence * 0.8
          }
        }
        break
      case 'email':
        if (isValidEmail(value)) {
          normalized.email = value.toLowerCase()
          confidenceScores.email = confidence
        }
        break
      case 'phone':
        const normalizedPhone = normalizePhoneNumber(value)
        if (normalizedPhone) {
          normalized.phone = normalizedPhone
          normalized.phones = [{ label: 'work', number: normalizedPhone }]
          confidenceScores.phone = confidence
        }
        break
      case 'company':
        normalized.company = value
        normalized.organization = value
        confidenceScores.company = confidence
        break
      case 'title':
        normalized.title = value
        normalized.role = value
        confidenceScores.title = confidence
        break
      case 'linkedinUrl':
        if (isValidUrl(value)) {
          normalized.linkedinUrl = value
          normalized.urls = [...(normalized.urls || []), { label: 'linkedin', url: value }]
          confidenceScores.linkedinUrl = confidence
        }
        break
      case 'twitterUrl':
        normalized.twitterUrl = value
        normalized.urls = [...(normalized.urls || []), { label: 'twitter', url: value }]
        confidenceScores.twitterUrl = confidence
        break
      case 'websiteUrl':
        if (isValidUrl(value)) {
          normalized.websiteUrl = value
          normalized.urls = [...(normalized.urls || []), { label: 'website', url: value }]
          confidenceScores.websiteUrl = confidence
        }
        break
      case 'notes':
        normalized.notes = value
        confidenceScores.notes = confidence
        break
      case 'tags':
        normalized.tags = value.split(/[,;]/).map(t => t.trim()).filter(Boolean)
        confidenceScores.tags = confidence
        break
    }
  }
  
  // Build full name if not present
  if (!normalized.fullName && normalized.firstName) {
    normalized.fullName = [normalized.firstName, normalized.lastName].filter(Boolean).join(' ')
    confidenceScores.fullName = Math.min(
      confidenceScores.firstName || 0,
      confidenceScores.lastName || 1
    )
  }
  
  return { normalized, confidenceScores }
}

/**
 * Calculate confidence score based on field type and value quality
 */
function calculateFieldConfidence(field: StandardField, value: string, baseConfidence: number): number {
  let confidence = baseConfidence
  
  switch (field) {
    case 'email':
      if (isValidEmail(value)) {
        confidence *= 1.0
      } else {
        confidence *= 0.3
      }
      break
    case 'phone':
      if (/^\+?\d[\d\s\-()]{6,}$/.test(value)) {
        confidence *= 1.0
      } else {
        confidence *= 0.5
      }
      break
    case 'linkedinUrl':
    case 'websiteUrl':
      if (isValidUrl(value)) {
        confidence *= 1.0
      } else {
        confidence *= 0.4
      }
      break
  }
  
  return Math.min(confidence, 1.0)
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return /^(https?:\/\/|www\.)/i.test(url)
  }
}

/**
 * Normalize phone number to international format
 */
function normalizePhoneNumber(phone: string): string | null {
  // Remove all non-digit characters except +
  let normalized = phone.replace(/[^\d+]/g, '')
  
  if (normalized.length < 6) return null
  
  // Handle Finnish numbers
  if (normalized.startsWith('0') && !normalized.startsWith('00')) {
    normalized = '+358' + normalized.substring(1)
  }
  
  // Ensure + prefix for international format
  if (normalized.startsWith('00')) {
    normalized = '+' + normalized.substring(2)
  }
  
  return normalized
}
