import { useState, useCallback } from 'react'
import type { 
  SourceFile, 
  RawSourceContact, 
  NormalizedFields,
  PhoneNumber,
  UrlEntry,
  Address
} from '@/types/database'
import { parseFile } from '@/lib/import/parseFile'
import { autoDetectMappings, normalizeContact, type FieldMapping } from '@/lib/import/fieldMapping'
import { calculateMatchScore } from '@/lib/matching/matchingService'
import * as XLSX from 'xlsx'

export type ListRole = 'primary' | 'secondary' | 'tertiary'

export type EnrichableField = 
  | 'email' 
  | 'phone' 
  | 'organization' 
  | 'organizationType'
  | 'title' 
  | 'linkedin' 
  | 'website' 
  | 'address' 
  | 'tags' 
  | 'notes'

export const ALL_ENRICHABLE_FIELDS: EnrichableField[] = [
  'email', 'phone', 'organization', 'organizationType', 'title', 'linkedin', 'website', 'address', 'tags', 'notes'
]

export interface EnrichedContact {
  id: string
  original: RawSourceContact
  enrichedFields: NormalizedFields
  matchedSources: {
    listRole: ListRole
    sourceFile: SourceFile
    rawContact: RawSourceContact
    matchScore: number
    matchReasons: string[]
  }[]
}

interface UseEnrichmentEngineState {
  primaryList: {
    sourceFile: SourceFile | null
    contacts: RawSourceContact[]
  }
  secondaryList: {
    sourceFile: SourceFile | null
    contacts: RawSourceContact[]
  }
  tertiaryList: {
    sourceFile: SourceFile | null
    contacts: RawSourceContact[]
  }
  enrichedContacts: EnrichedContact[]
  fieldMappings: Map<string, FieldMapping[]>
  selectedEnrichmentFields: Set<EnrichableField>
  globalNotes: string
  isProcessing: boolean
  error: string | null
}

const createEmptyListState = () => ({
  sourceFile: null,
  contacts: []
})

export function useEnrichmentEngine() {
  const [state, setState] = useState<UseEnrichmentEngineState>({
    primaryList: createEmptyListState(),
    secondaryList: createEmptyListState(),
    tertiaryList: createEmptyListState(),
    enrichedContacts: [],
    fieldMappings: new Map(),
    selectedEnrichmentFields: new Set(ALL_ENRICHABLE_FIELDS),
    globalNotes: '',
    isProcessing: false,
    error: null
  })

  /**
   * Set global notes that will be added to all contacts
   */
  const setGlobalNotes = useCallback((notes: string) => {
    setState(prev => ({ ...prev, globalNotes: notes }))
  }, [])

  /**
   * Toggle a field for enrichment
   */
  const toggleEnrichmentField = useCallback((field: EnrichableField) => {
    setState(prev => {
      const newFields = new Set(prev.selectedEnrichmentFields)
      if (newFields.has(field)) {
        newFields.delete(field)
      } else {
        newFields.add(field)
      }
      return { ...prev, selectedEnrichmentFields: newFields }
    })
  }, [])

  /**
   * Select all enrichment fields
   */
  const selectAllEnrichmentFields = useCallback(() => {
    setState(prev => ({ ...prev, selectedEnrichmentFields: new Set(ALL_ENRICHABLE_FIELDS) }))
  }, [])

  /**
   * Deselect all enrichment fields
   */
  const deselectAllEnrichmentFields = useCallback(() => {
    setState(prev => ({ ...prev, selectedEnrichmentFields: new Set() }))
  }, [])

  /**
   * Import a file for a specific list role
   */
  const importList = useCallback(async (file: File, role: ListRole) => {
    setState(prev => ({ ...prev, isProcessing: true, error: null }))
    
    try {
      const parsed = await parseFile(file)
      
      const sourceFile: SourceFile = {
        id: crypto.randomUUID(),
        filename: parsed.filename,
        file_type: parsed.fileType,
        imported_at: new Date().toISOString(),
        original_headers: parsed.headers,
        row_count: parsed.rowCount
      }
      
      const mappings = autoDetectMappings(parsed.headers)
      
      const contacts: RawSourceContact[] = parsed.rows.map((row, index) => {
        const { normalized, confidenceScores } = normalizeContact(row, mappings)
        
        return {
          id: crypto.randomUUID(),
          source_file_id: sourceFile.id,
          row_index: index,
          raw_data: row,
          normalized_fields: normalized,
          confidence_scores: confidenceScores
        }
      })
      
      const listKey = role === 'primary' ? 'primaryList' : 
                      role === 'secondary' ? 'secondaryList' : 'tertiaryList'
      
      setState(prev => {
        const newMappings = new Map(prev.fieldMappings)
        newMappings.set(sourceFile.id, mappings)
        
        return {
          ...prev,
          [listKey]: { sourceFile, contacts },
          fieldMappings: newMappings,
          isProcessing: false,
          // Clear enriched contacts when primary list changes
          enrichedContacts: role === 'primary' ? [] : prev.enrichedContacts
        }
      })
      
    } catch (error) {
      setState(prev => ({
        ...prev,
        isProcessing: false,
        error: error instanceof Error ? error.message : 'Tiedoston tuonti epäonnistui'
      }))
    }
  }, [])

  /**
   * Remove a list
   */
  const removeList = useCallback((role: ListRole) => {
    const listKey = role === 'primary' ? 'primaryList' : 
                    role === 'secondary' ? 'secondaryList' : 'tertiaryList'
    
    setState(prev => ({
      ...prev,
      [listKey]: createEmptyListState(),
      enrichedContacts: role === 'primary' ? [] : prev.enrichedContacts
    }))
  }, [])

  /**
   * Run enrichment process - match primary contacts with secondary/tertiary lists
   */
  const runEnrichment = useCallback(() => {
    if (!state.primaryList.sourceFile || state.primaryList.contacts.length === 0) {
      return
    }

    const enrichedContacts: EnrichedContact[] = state.primaryList.contacts.map(primaryContact => {
      const enriched: EnrichedContact = {
        id: primaryContact.id,
        original: primaryContact,
        enrichedFields: { ...primaryContact.normalized_fields },
        matchedSources: []
      }

      // Build URLs array including LinkedIn if available
      const primaryUrls = primaryContact.normalized_fields.urls || []
      if (primaryContact.normalized_fields.linkedinUrl && !primaryUrls.some(u => u.label === 'linkedin')) {
        primaryUrls.push({ label: 'linkedin', url: primaryContact.normalized_fields.linkedinUrl })
      }
      
      // Find matches in secondary list
      if (state.secondaryList.contacts.length > 0) {
        for (const secondaryContact of state.secondaryList.contacts) {
          const { score, reasons } = calculateMatchScore(
            {
              full_name: primaryContact.normalized_fields.fullName || 
                [primaryContact.normalized_fields.firstName, primaryContact.normalized_fields.lastName].filter(Boolean).join(' '),
              primary_email: primaryContact.normalized_fields.email,
              phones: primaryContact.normalized_fields.phones || 
                (primaryContact.normalized_fields.phone ? [{ label: 'work' as const, number: primaryContact.normalized_fields.phone }] : []),
              organization: primaryContact.normalized_fields.organization || primaryContact.normalized_fields.company,
              urls: primaryUrls
            },
            secondaryContact.normalized_fields
          )

          if (score >= 0.5) {
            enriched.matchedSources.push({
              listRole: 'secondary',
              sourceFile: state.secondaryList.sourceFile!,
              rawContact: secondaryContact,
              matchScore: score,
              matchReasons: reasons
            })
          }
        }
      }

      // Find matches in tertiary list
      if (state.tertiaryList.contacts.length > 0) {
        for (const tertiaryContact of state.tertiaryList.contacts) {
          const { score, reasons } = calculateMatchScore(
            {
              full_name: primaryContact.normalized_fields.fullName || 
                [primaryContact.normalized_fields.firstName, primaryContact.normalized_fields.lastName].filter(Boolean).join(' '),
              primary_email: primaryContact.normalized_fields.email,
              phones: primaryContact.normalized_fields.phones || 
                (primaryContact.normalized_fields.phone ? [{ label: 'work' as const, number: primaryContact.normalized_fields.phone }] : []),
              organization: primaryContact.normalized_fields.organization || primaryContact.normalized_fields.company,
              urls: primaryUrls
            },
            tertiaryContact.normalized_fields
          )

          if (score >= 0.5) {
            enriched.matchedSources.push({
              listRole: 'tertiary',
              sourceFile: state.tertiaryList.sourceFile!,
              rawContact: tertiaryContact,
              matchScore: score,
              matchReasons: reasons
            })
          }
        }
      }

      // Sort matched sources by score
      enriched.matchedSources.sort((a, b) => b.matchScore - a.matchScore)

      // Enrich fields from matched sources (fill in missing fields) - only selected fields
      const selectedFields = state.selectedEnrichmentFields
      
      for (const match of enriched.matchedSources) {
        const sourceFields = match.rawContact.normalized_fields
        
        // Fill in missing email (if selected)
        if (selectedFields.has('email')) {
          if (!enriched.enrichedFields.email && sourceFields.email) {
            enriched.enrichedFields.email = sourceFields.email
          }
          // Also merge secondary emails
          if (sourceFields.secondaryEmails && sourceFields.secondaryEmails.length > 0) {
            const existing = enriched.enrichedFields.secondaryEmails || []
            const newEmails = sourceFields.secondaryEmails.filter(e => !existing.includes(e))
            enriched.enrichedFields.secondaryEmails = [...existing, ...newEmails]
          }
        }
        
        // Fill in missing phone (if selected)
        if (selectedFields.has('phone')) {
          if (!enriched.enrichedFields.phone && sourceFields.phone) {
            enriched.enrichedFields.phone = sourceFields.phone
          }
          if ((!enriched.enrichedFields.phones || enriched.enrichedFields.phones.length === 0) && sourceFields.phones) {
            enriched.enrichedFields.phones = sourceFields.phones
          }
        }
        
        // Fill in missing organization (if selected)
        if (selectedFields.has('organization')) {
          if (!enriched.enrichedFields.organization && sourceFields.organization) {
            enriched.enrichedFields.organization = sourceFields.organization
          }
          if (!enriched.enrichedFields.company && sourceFields.company) {
            enriched.enrichedFields.company = sourceFields.company
          }
        }
        
        // Fill in missing organization type (if selected)
        if (selectedFields.has('organizationType')) {
          if (!enriched.enrichedFields.organizationType && sourceFields.organizationType) {
            enriched.enrichedFields.organizationType = sourceFields.organizationType
          }
        }
        
        // Fill in missing title/role (if selected)
        if (selectedFields.has('title')) {
          if (!enriched.enrichedFields.title && sourceFields.title) {
            enriched.enrichedFields.title = sourceFields.title
          }
          if (!enriched.enrichedFields.role && sourceFields.role) {
            enriched.enrichedFields.role = sourceFields.role
          }
        }
        
        // Fill in missing LinkedIn URL (if selected)
        if (selectedFields.has('linkedin')) {
          if (!enriched.enrichedFields.linkedinUrl && sourceFields.linkedinUrl) {
            enriched.enrichedFields.linkedinUrl = sourceFields.linkedinUrl
          }
        }
        
        // Fill in missing website URL (if selected)
        if (selectedFields.has('website')) {
          if (!enriched.enrichedFields.websiteUrl && sourceFields.websiteUrl) {
            enriched.enrichedFields.websiteUrl = sourceFields.websiteUrl
          }
        }
        
        // Fill in missing address (if selected)
        if (selectedFields.has('address')) {
          if (!enriched.enrichedFields.address && sourceFields.address) {
            enriched.enrichedFields.address = sourceFields.address
          }
        }
        
        // Fill in missing notes (if selected)
        if (selectedFields.has('notes')) {
          if (!enriched.enrichedFields.notes && sourceFields.notes) {
            enriched.enrichedFields.notes = sourceFields.notes
          }
        }
        
        // Merge tags (if selected)
        if (selectedFields.has('tags')) {
          if (sourceFields.tags && sourceFields.tags.length > 0) {
            const existing = enriched.enrichedFields.tags || []
            const newTags = sourceFields.tags.filter(t => !existing.includes(t))
            enriched.enrichedFields.tags = [...existing, ...newTags]
          }
        }
      }

      return enriched
    })

    setState(prev => ({ ...prev, enrichedContacts }))
  }, [state.primaryList, state.secondaryList, state.tertiaryList, state.selectedEnrichmentFields])

  /**
   * Clear all data
   */
  const clearAll = useCallback(() => {
    setState({
      primaryList: createEmptyListState(),
      secondaryList: createEmptyListState(),
      tertiaryList: createEmptyListState(),
      enrichedContacts: [],
      fieldMappings: new Map(),
      selectedEnrichmentFields: new Set(ALL_ENRICHABLE_FIELDS),
      globalNotes: '',
      isProcessing: false,
      error: null
    })
  }, [])

  /**
   * Prepare export data from enriched contacts
   */
  const prepareExportData = useCallback(() => {
    return state.enrichedContacts.map(ec => {
      // Extract organization URL from urls array if websiteUrl is not set
      const orgUrl = ec.enrichedFields.websiteUrl || 
        ec.enrichedFields.urls?.find(u => u.label === 'website')?.url || ''
      
      // Extract country from address object
      const country = typeof ec.enrichedFields.address === 'object' && ec.enrichedFields.address 
        ? ec.enrichedFields.address.country || ''
        : ''
      
      return {
        'Name': ec.enrichedFields.fullName || 
          [ec.enrichedFields.firstName, ec.enrichedFields.lastName].filter(Boolean).join(' '),
        'Email': ec.enrichedFields.email || '',
        'Organization': ec.enrichedFields.organization || ec.enrichedFields.company || '',
        'Organization URL': orgUrl,
        'Organization Type': ec.enrichedFields.organizationType || '',
        'Country': country,
        'Phone': ec.enrichedFields.phone || '',
        'Title': ec.enrichedFields.title || ec.enrichedFields.role || '',
        'LinkedIn': ec.enrichedFields.linkedinUrl || '',
        'Tags': ec.enrichedFields.tags?.join(', ') || '',
        'Notes': ec.enrichedFields.notes || '',
        'Internal Notes': state.globalNotes || '',
        'Enrichment Sources': ec.matchedSources.length,
        'Enrichment Source Names': ec.matchedSources.map(m => m.sourceFile.filename).join(', ')
      }
    })
  }, [state.enrichedContacts, state.globalNotes])

  /**
   * Export to CSV
   */
  const exportToCSV = useCallback(() => {
    const data = prepareExportData()
    if (data.length === 0) return

    const headers = Object.keys(data[0])
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(h => {
          const value = String(row[h as keyof typeof row] || '')
          if (value.includes(',') || value.includes('\n') || value.includes('"')) {
            return `"${value.replace(/"/g, '""')}"`
          }
          return value
        }).join(',')
      )
    ].join('\n')

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `rikastetut_kontaktit_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }, [prepareExportData])

  /**
   * Export to Excel
   */
  const exportToExcel = useCallback(() => {
    const data = prepareExportData()
    if (data.length === 0) return

    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Rikastetut kontaktit')
    
    const colWidths = Object.keys(data[0]).map(key => ({
      wch: Math.max(key.length, ...data.map(row => String(row[key as keyof typeof row] || '').length))
    }))
    ws['!cols'] = colWidths.map(w => ({ wch: Math.min(w.wch, 50) }))

    XLSX.writeFile(wb, `rikastetut_kontaktit_${new Date().toISOString().split('T')[0]}.xlsx`)
  }, [prepareExportData])

  return {
    ...state,
    importList,
    removeList,
    runEnrichment,
    setGlobalNotes,
    toggleEnrichmentField,
    selectAllEnrichmentFields,
    deselectAllEnrichmentFields,
    clearAll,
    exportToCSV,
    exportToExcel
  }
}
