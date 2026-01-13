import type { MasterContact, StructuredName, PhoneNumber, UrlEntry, Address, SourceLink } from '@/types/database'

/**
 * vCard 4.0 Generator
 * 
 * Generates RFC 6350 compliant vCard 4.0 format with:
 * - Full UTF-8 support
 * - Proper line folding (75 chars max)
 * - All standard fields (FN, N, EMAIL, TEL, ORG, TITLE, URL, ADR, NOTE, KIND)
 * - Source documentation in NOTE field
 */

export function generateVCard(contact: MasterContact): string {
  const lines: string[] = []
  
  // Required vCard 4.0 header
  lines.push('BEGIN:VCARD')
  lines.push('VERSION:4.0')
  
  // KIND - individual or org
  lines.push(`KIND:${contact.kind}`)
  
  // FN - Formatted Name (required)
  lines.push(`FN:${escapeVCardValue(contact.full_name)}`)
  
  // N - Structured Name
  if (contact.structured_name) {
    lines.push(formatStructuredName(contact.structured_name))
  }
  
  // ORG - Organization
  if (contact.organization) {
    lines.push(`ORG:${escapeVCardValue(contact.organization)}`)
  }
  
  // TITLE - Job title/role
  if (contact.title) {
    lines.push(`TITLE:${escapeVCardValue(contact.title)}`)
  }
  
  // EMAIL entries
  if (contact.primary_email) {
    lines.push(`EMAIL;TYPE=work;PREF=1:${contact.primary_email}`)
  }
  
  if (contact.secondary_emails?.length) {
    contact.secondary_emails.forEach((email, index) => {
      lines.push(`EMAIL;TYPE=work;PREF=${index + 2}:${email}`)
    })
  }
  
  // TEL entries
  if (contact.phones?.length) {
    contact.phones.forEach(phone => {
      lines.push(formatPhone(phone))
    })
  }
  
  // URL entries
  if (contact.urls?.length) {
    contact.urls.forEach(url => {
      lines.push(formatUrl(url))
    })
  }
  
  // ADR entries
  if (contact.addresses?.length) {
    contact.addresses.forEach(addr => {
      lines.push(formatAddress(addr))
    })
  }
  
  // NOTE - includes source documentation
  const note = buildNoteField(contact)
  if (note) {
    lines.push(`NOTE:${escapeVCardValue(note)}`)
  }
  
  // Required vCard footer
  lines.push('END:VCARD')
  
  // Apply line folding for long lines
  return lines.map(foldLine).join('\r\n')
}

/**
 * Format structured name as N: property
 * N:LastName;FirstName;MiddleName;Prefix;Suffix
 */
function formatStructuredName(name: StructuredName): string {
  const parts = [
    name.familyName || '',
    name.givenName || '',
    name.additionalNames || '',
    name.prefix || '',
    name.suffix || ''
  ]
  return `N:${parts.map(escapeVCardValue).join(';')}`
}

/**
 * Format phone number with type
 */
function formatPhone(phone: PhoneNumber): string {
  const typeMap: Record<string, string> = {
    work: 'work,voice',
    home: 'home,voice',
    cell: 'cell',
    fax: 'fax',
    other: 'voice'
  }
  const type = typeMap[phone.label] || 'voice'
  return `TEL;TYPE=${type}:${phone.number}`
}

/**
 * Format URL with appropriate type parameter
 */
function formatUrl(url: UrlEntry): string {
  // vCard 4.0 uses TYPE parameter for URL categorization
  switch (url.label) {
    case 'linkedin':
      return `URL;TYPE=linkedin:${url.url}`
    case 'twitter':
      return `URL;TYPE=twitter:${url.url}`
    case 'github':
      return `URL;TYPE=github:${url.url}`
    case 'website':
      return `URL;TYPE=home:${url.url}`
    default:
      return `URL:${url.url}`
  }
}

/**
 * Format address
 * ADR:;;Street;City;Region;PostalCode;Country
 */
function formatAddress(addr: Address): string {
  const parts = [
    '', // PO Box
    '', // Extended address
    addr.street || '',
    addr.city || '',
    addr.region || '',
    addr.postalCode || '',
    addr.country || ''
  ]
  return `ADR;TYPE=${addr.label}:${parts.map(escapeVCardValue).join(';')}`
}

/**
 * Build NOTE field with contact notes and source documentation
 */
function buildNoteField(contact: MasterContact): string {
  const parts: string[] = []
  
  // User notes first
  if (contact.notes) {
    parts.push(contact.notes)
  }
  
  // Tags
  if (contact.tags?.length) {
    parts.push(`Tags: ${contact.tags.join(', ')}`)
  }
  
  // Source documentation
  if (contact.source_links?.length) {
    parts.push('')
    parts.push('Sources:')
    contact.source_links.forEach(source => {
      const fields = source.fieldsFromSource?.length 
        ? ` (${source.fieldsFromSource.join(', ')})` 
        : ''
      parts.push(`- ${source.sourceFileName}${fields}`)
    })
  }
  
  return parts.join('\\n')
}

/**
 * Escape special characters for vCard values
 */
function escapeVCardValue(value: string): string {
  if (!value) return ''
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

/**
 * Fold long lines according to RFC 6350
 * Lines longer than 75 octets should be folded
 */
function foldLine(line: string): string {
  const maxLength = 75
  if (line.length <= maxLength) return line
  
  const result: string[] = []
  let remaining = line
  
  // First line can be full length
  result.push(remaining.substring(0, maxLength))
  remaining = remaining.substring(maxLength)
  
  // Continuation lines start with space and can be maxLength-1
  while (remaining.length > 0) {
    result.push(' ' + remaining.substring(0, maxLength - 1))
    remaining = remaining.substring(maxLength - 1)
  }
  
  return result.join('\r\n')
}

/**
 * Download vCard as .vcf file
 */
export function downloadVCard(contact: MasterContact): void {
  const vcardContent = generateVCard(contact)
  const blob = new Blob([vcardContent], { type: 'text/vcard;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  
  const link = document.createElement('a')
  link.href = url
  link.download = `${sanitizeFilename(contact.full_name)}.vcf`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  
  URL.revokeObjectURL(url)
}

/**
 * Sanitize filename for download
 */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .substring(0, 100)
}
