import Fuse from 'fuse.js'
import type { RawSourceContact, MasterContact, MatchCandidate, NormalizedFields } from '@/types/database'

export interface MatchResult {
  rawContact: RawSourceContact
  score: number
  reasons: string[]
}

export interface DuplicateGroup {
  id: string
  contacts: RawSourceContact[]
  matchReasons: string[]
}

/**
 * Match scoring weights
 * Higher values = stronger match signal
 */
const MATCH_WEIGHTS = {
  exactEmail: 0.95,
  exactPhone: 0.85,
  exactLinkedIn: 0.95,
  fuzzyNameSameOrg: 0.75,
  fuzzyNameOnly: 0.5,
  sameOrgOnly: 0.3
}

/**
 * Find matching candidates for a given master contact from raw contacts
 */
export function findMatchCandidates(
  masterContact: Partial<MasterContact>,
  rawContacts: RawSourceContact[]
): MatchResult[] {
  const results: MatchResult[] = []
  
  for (const raw of rawContacts) {
    const { score, reasons } = calculateMatchScore(masterContact, raw.normalized_fields)
    
    if (score > 0.1) {
      results.push({
        rawContact: raw,
        score,
        reasons
      })
    }
  }
  
  // Sort by score descending
  return results.sort((a, b) => b.score - a.score)
}

/**
 * Calculate match score between a master contact and normalized fields
 */
export function calculateMatchScore(
  master: Partial<MasterContact>,
  normalized: NormalizedFields
): { score: number; reasons: string[] } {
  const reasons: string[] = []
  let maxScore = 0
  
  // 1. Exact email match (strongest signal)
  if (master.primary_email && normalized.email) {
    if (normalizeEmail(master.primary_email) === normalizeEmail(normalized.email)) {
      maxScore = Math.max(maxScore, MATCH_WEIGHTS.exactEmail)
      reasons.push('Exact email match')
    }
  }
  
  // Check secondary emails too
  if (master.secondary_emails && normalized.email) {
    const normalizedEmail = normalizeEmail(normalized.email)
    if (master.secondary_emails.some(e => normalizeEmail(e) === normalizedEmail)) {
      maxScore = Math.max(maxScore, MATCH_WEIGHTS.exactEmail * 0.9)
      reasons.push('Secondary email match')
    }
  }
  
  // 2. Phone number match
  if (master.phones && normalized.phone) {
    const normalizedPhone = normalizePhone(normalized.phone)
    if (master.phones.some(p => normalizePhone(p.number) === normalizedPhone)) {
      maxScore = Math.max(maxScore, MATCH_WEIGHTS.exactPhone)
      reasons.push('Phone number match')
    }
  }
  
  // 3. LinkedIn URL match (very strong - unique identifier)
  if (master.urls && normalized.linkedinUrl) {
    const normalizedLinkedIn = normalizeLinkedInUrl(normalized.linkedinUrl)
    if (master.urls.some(u => u.label === 'linkedin' && normalizeLinkedInUrl(u.url) === normalizedLinkedIn)) {
      maxScore = Math.max(maxScore, MATCH_WEIGHTS.exactLinkedIn)
      reasons.push('LinkedIn profile match')
    }
  }
  
  // 4. Name + organization match
  const masterName = master.full_name?.toLowerCase().trim()
  const rawName = normalized.fullName?.toLowerCase().trim() || 
    [normalized.firstName, normalized.lastName].filter(Boolean).join(' ').toLowerCase().trim()
  
  if (masterName && rawName) {
    const nameScore = fuzzyNameMatch(masterName, rawName)
    
    const masterOrg = master.organization?.toLowerCase().trim()
    const rawOrg = (normalized.organization || normalized.company)?.toLowerCase().trim()
    
    if (nameScore > 0.8) {
      if (masterOrg && rawOrg && fuzzyMatch(masterOrg, rawOrg) > 0.8) {
        maxScore = Math.max(maxScore, MATCH_WEIGHTS.fuzzyNameSameOrg)
        reasons.push('Same name and organization')
      } else if (nameScore > 0.9) {
        maxScore = Math.max(maxScore, MATCH_WEIGHTS.fuzzyNameOnly)
        reasons.push('Similar name')
      }
    }
  }
  
  // 5. Same organization only (weak signal)
  if (maxScore < 0.3) {
    const masterOrg = master.organization?.toLowerCase().trim()
    const rawOrg = (normalized.organization || normalized.company)?.toLowerCase().trim()
    
    if (masterOrg && rawOrg && fuzzyMatch(masterOrg, rawOrg) > 0.9) {
      maxScore = Math.max(maxScore, MATCH_WEIGHTS.sameOrgOnly)
      reasons.push('Same organization')
    }
  }
  
  return { score: maxScore, reasons }
}

/**
 * Detect potential duplicates within a list of contacts
 */
export function detectDuplicates(contacts: RawSourceContact[], threshold: number = 0.5): DuplicateGroup[] {
  const duplicateGroups: DuplicateGroup[] = []
  const processedIds = new Set<string>()
  
  for (let i = 0; i < contacts.length; i++) {
    if (processedIds.has(contacts[i].id)) continue
    
    const contact = contacts[i]
    const group: RawSourceContact[] = [contact]
    const allReasons: Set<string> = new Set()
    
    for (let j = i + 1; j < contacts.length; j++) {
      if (processedIds.has(contacts[j].id)) continue
      
      const otherContact = contacts[j]
      const { score, reasons } = calculateContactSimilarity(
        contact.normalized_fields,
        otherContact.normalized_fields
      )
      
      if (score >= threshold) {
        group.push(otherContact)
        reasons.forEach(r => allReasons.add(r))
        processedIds.add(otherContact.id)
      }
    }
    
    if (group.length > 1) {
      processedIds.add(contact.id)
      duplicateGroups.push({
        id: crypto.randomUUID(),
        contacts: group,
        matchReasons: Array.from(allReasons)
      })
    }
  }
  
  return duplicateGroups
}

/**
 * Calculate similarity score between two normalized contact fields
 */
function calculateContactSimilarity(
  a: NormalizedFields,
  b: NormalizedFields
): { score: number; reasons: string[] } {
  const reasons: string[] = []
  let maxScore = 0
  
  // Exact email match
  if (a.email && b.email) {
    if (normalizeEmail(a.email) === normalizeEmail(b.email)) {
      maxScore = Math.max(maxScore, 0.95)
      reasons.push('Same email')
    }
  }
  
  // LinkedIn match
  if (a.linkedinUrl && b.linkedinUrl) {
    if (normalizeLinkedInUrl(a.linkedinUrl) === normalizeLinkedInUrl(b.linkedinUrl)) {
      maxScore = Math.max(maxScore, 0.95)
      reasons.push('Same LinkedIn')
    }
  }
  
  // Phone match
  if (a.phone && b.phone) {
    if (normalizePhone(a.phone) === normalizePhone(b.phone)) {
      maxScore = Math.max(maxScore, 0.85)
      reasons.push('Same phone')
    }
  }
  
  // Name comparison
  const nameA = a.fullName?.toLowerCase().trim() || 
    [a.firstName, a.lastName].filter(Boolean).join(' ').toLowerCase().trim()
  const nameB = b.fullName?.toLowerCase().trim() || 
    [b.firstName, b.lastName].filter(Boolean).join(' ').toLowerCase().trim()
  
  if (nameA && nameB) {
    const nameScore = fuzzyNameMatch(nameA, nameB)
    
    const orgA = (a.organization || a.company)?.toLowerCase().trim()
    const orgB = (b.organization || b.company)?.toLowerCase().trim()
    
    if (nameScore > 0.85) {
      if (orgA && orgB && fuzzyMatch(orgA, orgB) > 0.8) {
        maxScore = Math.max(maxScore, 0.8)
        reasons.push('Same name & organization')
      } else if (nameScore > 0.95) {
        maxScore = Math.max(maxScore, 0.6)
        reasons.push('Same name')
      }
    }
  }
  
  return { score: maxScore, reasons }
}

/**
 * Group raw contacts by potential matches
 */
export function groupRawContactsByMatch(rawContacts: RawSourceContact[]): Map<string, RawSourceContact[]> {
  const groups = new Map<string, RawSourceContact[]>()
  
  for (const contact of rawContacts) {
    const key = generateMatchKey(contact.normalized_fields)
    const existing = groups.get(key) || []
    existing.push(contact)
    groups.set(key, existing)
  }
  
  return groups
}

/**
 * Generate a match key for grouping similar contacts
 */
function generateMatchKey(normalized: NormalizedFields): string {
  // Priority: email > phone > linkedin > name+org
  if (normalized.email) {
    return `email:${normalizeEmail(normalized.email)}`
  }
  
  if (normalized.linkedinUrl) {
    return `linkedin:${normalizeLinkedInUrl(normalized.linkedinUrl)}`
  }
  
  if (normalized.phone) {
    return `phone:${normalizePhone(normalized.phone)}`
  }
  
  const name = normalized.fullName || 
    [normalized.firstName, normalized.lastName].filter(Boolean).join(' ')
  const org = normalized.organization || normalized.company
  
  if (name && org) {
    return `nameorg:${name.toLowerCase().trim()}:${org.toLowerCase().trim()}`
  }
  
  if (name) {
    return `name:${name.toLowerCase().trim()}`
  }
  
  return `unknown:${Math.random()}`
}

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim()
}

function normalizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, '')
}

function normalizeLinkedInUrl(url: string): string {
  // Extract LinkedIn username/profile ID
  const match = url.match(/linkedin\.com\/in\/([^/?]+)/i)
  return match ? match[1].toLowerCase() : url.toLowerCase()
}

/**
 * Fuzzy string matching using Levenshtein distance
 */
function fuzzyMatch(a: string, b: string): number {
  if (a === b) return 1
  if (!a || !b) return 0
  
  const longer = a.length > b.length ? a : b
  const shorter = a.length > b.length ? b : a
  
  const longerLength = longer.length
  if (longerLength === 0) return 1
  
  return (longerLength - levenshteinDistance(longer, shorter)) / longerLength
}

/**
 * Fuzzy name matching with handling for name order variations
 */
function fuzzyNameMatch(name1: string, name2: string): number {
  // Direct match
  const directScore = fuzzyMatch(name1, name2)
  if (directScore > 0.9) return directScore
  
  // Try reversed order (FirstName LastName vs LastName FirstName)
  const parts1 = name1.split(/\s+/)
  const parts2 = name2.split(/\s+/)
  
  if (parts1.length >= 2 && parts2.length >= 2) {
    const reversed1 = [...parts1].reverse().join(' ')
    const reversedScore = fuzzyMatch(reversed1, name2)
    if (reversedScore > directScore) return reversedScore
  }
  
  return directScore
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = []
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }
  
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }
  
  return matrix[b.length][a.length]
}
