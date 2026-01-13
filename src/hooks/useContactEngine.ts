import { useState, useCallback } from 'react'
import type { 
  SourceFile, 
  RawSourceContact, 
  MasterContact, 
  NormalizedFields,
  StructuredName,
  PhoneNumber,
  UrlEntry,
  SourceLink,
  ContactKind
} from '@/types/database'
import { parseFile, type ParsedFile } from '@/lib/import/parseFile'
import { autoDetectMappings, normalizeContact, type FieldMapping } from '@/lib/import/fieldMapping'
import { findMatchCandidates, groupRawContactsByMatch } from '@/lib/matching/matchingService'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/hooks/useAuth'

interface UseContactEngineState {
  sourceFiles: SourceFile[]
  rawContacts: RawSourceContact[]
  masterContact: Partial<MasterContact>
  matchedContacts: RawSourceContact[]
  fieldMappings: Map<string, FieldMapping[]>
  isProcessing: boolean
  isSaving: boolean
  error: string | null
}

export function useContactEngine() {
  const { user } = useAuth()
  const [state, setState] = useState<UseContactEngineState>({
    sourceFiles: [],
    rawContacts: [],
    masterContact: createEmptyMasterContact(),
    matchedContacts: [],
    fieldMappings: new Map(),
    isProcessing: false,
    isSaving: false,
    error: null
  })

  /**
   * Import files and extract raw contacts
   */
  const importFiles = useCallback(async (files: File[]) => {
    setState(prev => ({ ...prev, isProcessing: true, error: null }))
    
    try {
      const newSourceFiles: SourceFile[] = []
      const newRawContacts: RawSourceContact[] = []
      const newMappings = new Map<string, FieldMapping[]>()
      
      for (const file of files) {
        const parsed = await parseFile(file)
        
        // Create source file record
        const sourceFile: SourceFile = {
          id: crypto.randomUUID(),
          filename: parsed.filename,
          file_type: parsed.fileType,
          imported_at: new Date().toISOString(),
          original_headers: parsed.headers,
          row_count: parsed.rowCount
        }
        newSourceFiles.push(sourceFile)
        
        // Auto-detect field mappings
        const mappings = autoDetectMappings(parsed.headers)
        newMappings.set(sourceFile.id, mappings)
        
        // Create raw contact records
        parsed.rows.forEach((row, index) => {
          const { normalized, confidenceScores } = normalizeContact(row, mappings)
          
          const rawContact: RawSourceContact = {
            id: crypto.randomUUID(),
            source_file_id: sourceFile.id,
            row_index: index,
            raw_data: row,
            normalized_fields: normalized,
            confidence_scores: confidenceScores
          }
          newRawContacts.push(rawContact)
        })
      }
      
      setState(prev => ({
        ...prev,
        sourceFiles: [...prev.sourceFiles, ...newSourceFiles],
        rawContacts: [...prev.rawContacts, ...newRawContacts],
        fieldMappings: new Map([...prev.fieldMappings, ...newMappings]),
        isProcessing: false
      }))
      
    } catch (error) {
      setState(prev => ({
        ...prev,
        isProcessing: false,
        error: error instanceof Error ? error.message : 'Failed to import files'
      }))
    }
  }, [])

  /**
   * Update field mapping for a source file
   */
  const updateFieldMapping = useCallback((sourceFileId: string, mappings: FieldMapping[]) => {
    setState(prev => {
      const newMappings = new Map(prev.fieldMappings)
      newMappings.set(sourceFileId, mappings)
      
      // Re-normalize contacts from this source
      const updatedRawContacts = prev.rawContacts.map(contact => {
        if (contact.source_file_id !== sourceFileId) return contact
        
        const { normalized, confidenceScores } = normalizeContact(contact.raw_data, mappings)
        return { ...contact, normalized_fields: normalized, confidence_scores: confidenceScores }
      })
      
      return { ...prev, fieldMappings: newMappings, rawContacts: updatedRawContacts }
    })
  }, [])

  /**
   * Select a raw contact to start building master contact
   */
  const selectRawContact = useCallback((rawContactId: string) => {
    setState(prev => {
      const rawContact = prev.rawContacts.find(c => c.id === rawContactId)
      if (!rawContact) return prev
      
      // Find all matching contacts
      const matches = findMatchCandidates(
        buildMasterFromNormalized(rawContact.normalized_fields, rawContact),
        prev.rawContacts.filter(c => c.id !== rawContactId)
      )
      
      const matchedContacts = [rawContact, ...matches.map(m => m.rawContact)]
      
      // Build initial master contact from selected raw contact
      const masterContact = buildMasterFromNormalized(rawContact.normalized_fields, rawContact)
      
      return { ...prev, matchedContacts, masterContact }
    })
  }, [])

  /**
   * Update a field in the master contact
   */
  const updateMasterField = useCallback(<K extends keyof MasterContact>(
    field: K,
    value: MasterContact[K]
  ) => {
    setState(prev => ({
      ...prev,
      masterContact: { ...prev.masterContact, [field]: value }
    }))
  }, [])

  /**
   * Apply a value from a raw contact to the master contact
   */
  const applyFieldFromSource = useCallback((
    field: keyof NormalizedFields,
    rawContactId: string
  ) => {
    setState(prev => {
      const rawContact = prev.rawContacts.find(c => c.id === rawContactId)
      if (!rawContact) return prev
      
      const sourceFile = prev.sourceFiles.find(f => f.id === rawContact.source_file_id)
      const value = rawContact.normalized_fields[field]
      if (value === undefined) return prev
      
      const updatedMaster = { ...prev.masterContact }
      
      // Map normalized field to master contact field
      switch (field) {
        case 'email':
          updatedMaster.primary_email = value as string
          break
        case 'fullName':
          updatedMaster.full_name = value as string
          // Try to parse structured name
          const parts = (value as string).split(/\s+/)
          if (parts.length >= 2) {
            updatedMaster.structured_name = {
              givenName: parts[0],
              familyName: parts.slice(1).join(' ')
            }
          }
          break
        case 'firstName':
          updatedMaster.structured_name = {
            ...updatedMaster.structured_name,
            givenName: value as string,
            familyName: updatedMaster.structured_name?.familyName || ''
          }
          updatedMaster.full_name = [value, updatedMaster.structured_name?.familyName].filter(Boolean).join(' ')
          break
        case 'lastName':
          updatedMaster.structured_name = {
            ...updatedMaster.structured_name,
            givenName: updatedMaster.structured_name?.givenName || '',
            familyName: value as string
          }
          updatedMaster.full_name = [updatedMaster.structured_name?.givenName, value].filter(Boolean).join(' ')
          break
        case 'company':
        case 'organization':
          updatedMaster.organization = value as string
          break
        case 'title':
        case 'role':
          updatedMaster.title = value as string
          break
        case 'phones':
          updatedMaster.phones = value as PhoneNumber[]
          break
        case 'urls':
          updatedMaster.urls = value as UrlEntry[]
          break
        case 'notes':
          updatedMaster.notes = value as string
          break
        case 'tags':
          updatedMaster.tags = value as string[]
          break
      }
      
      // Update source links
      if (sourceFile) {
        const sourceLink: SourceLink = {
          sourceFileName: sourceFile.filename,
          sourceType: sourceFile.file_type,
          sourceRowRef: rawContact.row_index,
          fieldsFromSource: [field]
        }
        
        const existingLinkIndex = updatedMaster.source_links?.findIndex(
          l => l.sourceFileName === sourceFile.filename && l.sourceRowRef === rawContact.row_index
        )
        
        if (existingLinkIndex !== undefined && existingLinkIndex >= 0) {
          updatedMaster.source_links![existingLinkIndex].fieldsFromSource.push(field)
        } else {
          updatedMaster.source_links = [...(updatedMaster.source_links || []), sourceLink]
        }
      }
      
      return { ...prev, masterContact: updatedMaster }
    })
  }, [])

  /**
   * Reset master contact
   */
  const resetMasterContact = useCallback(() => {
    setState(prev => ({
      ...prev,
      masterContact: createEmptyMasterContact(),
      matchedContacts: []
    }))
  }, [])

  /**
   * Clear all imported data
   */
  const clearAll = useCallback(() => {
    setState({
      sourceFiles: [],
      rawContacts: [],
      masterContact: createEmptyMasterContact(),
      matchedContacts: [],
      fieldMappings: new Map(),
      isProcessing: false,
      isSaving: false,
      error: null
    })
  }, [])

  /**
   * Save master contact to Supabase
   */
  const saveMasterContact = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    const contact = state.masterContact
    
    if (!contact.full_name && !contact.primary_email) {
      return { success: false, error: 'Kontaktilla täytyy olla vähintään nimi tai sähköposti' }
    }

    if (!user) {
      return { success: false, error: 'Kirjaudu sisään tallentaaksesi kontakteja' }
    }

    setState(prev => ({ ...prev, isSaving: true, error: null }))

    try {
      const contactToSave = {
        id: contact.id || crypto.randomUUID(),
        user_id: user.id,
        full_name: contact.full_name || '',
        structured_name: contact.structured_name || { givenName: '', familyName: '' },
        kind: contact.kind || 'individual',
        primary_email: contact.primary_email || undefined,
        secondary_emails: contact.secondary_emails || [],
        phones: contact.phones || [],
        organization: contact.organization || undefined,
        title: contact.title || undefined,
        urls: contact.urls || [],
        addresses: contact.addresses || [],
        notes: contact.notes || undefined,
        tags: contact.tags || [],
        source_links: contact.source_links || [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      const { error } = await supabase
        .from('mixmatch_master_contacts')
        .upsert(contactToSave as any, { onConflict: 'id' })

      if (error) {
        console.error('Supabase save error:', error)
        setState(prev => ({ ...prev, isSaving: false, error: error.message }))
        return { success: false, error: error.message }
      }

      setState(prev => ({ 
        ...prev, 
        isSaving: false,
        masterContact: createEmptyMasterContact(),
        matchedContacts: []
      }))
      
      return { success: true }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Tallennusvirhe'
      setState(prev => ({ ...prev, isSaving: false, error: errorMessage }))
      return { success: false, error: errorMessage }
    }
  }, [state.masterContact, user])

  return {
    ...state,
    importFiles,
    updateFieldMapping,
    selectRawContact,
    updateMasterField,
    applyFieldFromSource,
    resetMasterContact,
    clearAll,
    saveMasterContact
  }
}

function createEmptyMasterContact(): Partial<MasterContact> {
  return {
    id: crypto.randomUUID(),
    full_name: '',
    structured_name: { givenName: '', familyName: '' },
    kind: 'individual' as ContactKind,
    primary_email: '',
    secondary_emails: [],
    phones: [],
    organization: '',
    title: '',
    urls: [],
    addresses: [],
    notes: '',
    tags: [],
    source_links: []
  }
}

function buildMasterFromNormalized(
  normalized: NormalizedFields,
  rawContact: RawSourceContact
): Partial<MasterContact> {
  return {
    id: crypto.randomUUID(),
    full_name: normalized.fullName || [normalized.firstName, normalized.lastName].filter(Boolean).join(' '),
    structured_name: {
      givenName: normalized.firstName || '',
      familyName: normalized.lastName || ''
    },
    kind: 'individual' as ContactKind,
    primary_email: normalized.email,
    secondary_emails: normalized.secondaryEmails || [],
    phones: normalized.phones || (normalized.phone ? [{ label: 'work', number: normalized.phone }] : []),
    organization: normalized.organization || normalized.company,
    title: normalized.title || normalized.role,
    urls: normalized.urls || [],
    addresses: normalized.address ? [normalized.address] : [],
    notes: normalized.notes,
    tags: normalized.tags || [],
    source_links: []
  }
}
