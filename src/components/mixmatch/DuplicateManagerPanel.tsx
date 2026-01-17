import { useState, useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { 
  Users, 
  Building2, 
  GitMerge, 
  Trash2, 
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  RefreshCw
} from 'lucide-react'
import { toast } from 'sonner'
import type { RawSourceContact, NormalizedFields } from '@/types/database'
import { detectDuplicates, type DuplicateGroup } from '@/lib/matching/matchingService'
import { cn } from '@/lib/utils'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

interface DuplicateManagerPanelProps {
  contacts: RawSourceContact[]
  onMergeContacts: (mergedContact: RawSourceContact, removedIds: string[]) => void
  onRemoveContacts: (contactIds: string[]) => void
}

type DuplicateType = 'contacts' | 'organizations'

interface OrganizationGroup {
  id: string
  organizationName: string
  contacts: RawSourceContact[]
}

export function DuplicateManagerPanel({
  contacts,
  onMergeContacts,
  onRemoveContacts
}: DuplicateManagerPanelProps) {
  const [duplicateType, setDuplicateType] = useState<DuplicateType>('contacts')
  const [threshold, setThreshold] = useState([0.5])
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [selectedForMerge, setSelectedForMerge] = useState<Map<string, Set<string>>>(new Map())
  const [primaryContact, setPrimaryContact] = useState<Map<string, string>>(new Map())

  // Detect contact duplicates
  const contactDuplicates = useMemo((): DuplicateGroup[] => {
    if (contacts.length === 0) return []
    return detectDuplicates(contacts, threshold[0])
  }, [contacts, threshold])

  // Detect organization duplicates (same org name, different contacts)
  const organizationDuplicates = useMemo((): OrganizationGroup[] => {
    const orgMap = new Map<string, RawSourceContact[]>()
    
    for (const contact of contacts) {
      const org = (contact.normalized_fields.organization || 
                   contact.normalized_fields.company || '').toLowerCase().trim()
      if (!org) continue
      
      const existing = orgMap.get(org) || []
      existing.push(contact)
      orgMap.set(org, existing)
    }
    
    // Only return orgs with multiple contacts
    return Array.from(orgMap.entries())
      .filter(([_, contacts]) => contacts.length > 1)
      .map(([orgName, contacts]) => ({
        id: crypto.randomUUID(),
        organizationName: contacts[0].normalized_fields.organization || 
                         contacts[0].normalized_fields.company || orgName,
        contacts
      }))
      .sort((a, b) => b.contacts.length - a.contacts.length)
  }, [contacts])

  const toggleGroupExpanded = useCallback((groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupId)) {
        next.delete(groupId)
      } else {
        next.add(groupId)
      }
      return next
    })
  }, [])

  const toggleContactSelection = useCallback((groupId: string, contactId: string) => {
    setSelectedForMerge(prev => {
      const next = new Map(prev)
      const groupSelection = new Set(next.get(groupId) || [])
      
      if (groupSelection.has(contactId)) {
        groupSelection.delete(contactId)
      } else {
        groupSelection.add(contactId)
      }
      
      next.set(groupId, groupSelection)
      return next
    })
  }, [])

  const selectAllInGroup = useCallback((groupId: string, contactIds: string[]) => {
    setSelectedForMerge(prev => {
      const next = new Map(prev)
      next.set(groupId, new Set(contactIds))
      return next
    })
  }, [])

  const setPrimaryForMerge = useCallback((groupId: string, contactId: string) => {
    setPrimaryContact(prev => {
      const next = new Map(prev)
      next.set(groupId, contactId)
      return next
    })
  }, [])

  const handleMergeGroup = useCallback((group: DuplicateGroup | OrganizationGroup) => {
    const selected = selectedForMerge.get(group.id)
    if (!selected || selected.size < 2) {
      toast.error('Select at least 2 contacts to merge')
      return
    }

    const primary = primaryContact.get(group.id)
    if (!primary || !selected.has(primary)) {
      toast.error('Select a primary contact for the merge')
      return
    }

    const contactsToMerge = group.contacts.filter(c => selected.has(c.id))
    const primaryContactData = contactsToMerge.find(c => c.id === primary)!
    const otherContacts = contactsToMerge.filter(c => c.id !== primary)

    // Merge fields from other contacts into primary
    const mergedFields: NormalizedFields = { ...primaryContactData.normalized_fields }
    
    for (const other of otherContacts) {
      const fields = other.normalized_fields
      
      // Fill missing fields
      if (!mergedFields.email && fields.email) mergedFields.email = fields.email
      if (!mergedFields.phone && fields.phone) mergedFields.phone = fields.phone
      if (!mergedFields.linkedinUrl && fields.linkedinUrl) mergedFields.linkedinUrl = fields.linkedinUrl
      if (!mergedFields.title && fields.title) mergedFields.title = fields.title
      if (!mergedFields.websiteUrl && fields.websiteUrl) mergedFields.websiteUrl = fields.websiteUrl
      if (!mergedFields.address && fields.address) mergedFields.address = fields.address
      
      // Merge arrays
      if (fields.secondaryEmails?.length) {
        mergedFields.secondaryEmails = [
          ...(mergedFields.secondaryEmails || []),
          ...fields.secondaryEmails.filter(e => !mergedFields.secondaryEmails?.includes(e))
        ]
      }
      if (fields.phones?.length) {
        const existingNumbers = mergedFields.phones?.map(p => p.number) || []
        mergedFields.phones = [
          ...(mergedFields.phones || []),
          ...fields.phones.filter(p => !existingNumbers.includes(p.number))
        ]
      }
      if (fields.tags?.length) {
        mergedFields.tags = [
          ...(mergedFields.tags || []),
          ...fields.tags.filter(t => !mergedFields.tags?.includes(t))
        ]
      }
      
      // Append notes
      if (fields.notes && fields.notes !== mergedFields.notes) {
        mergedFields.notes = mergedFields.notes 
          ? `${mergedFields.notes}\n---\n${fields.notes}`
          : fields.notes
      }
    }

    const mergedContact: RawSourceContact = {
      ...primaryContactData,
      normalized_fields: mergedFields
    }

    const removedIds = otherContacts.map(c => c.id)
    
    onMergeContacts(mergedContact, removedIds)
    
    // Clear selection for this group
    setSelectedForMerge(prev => {
      const next = new Map(prev)
      next.delete(group.id)
      return next
    })
    setPrimaryContact(prev => {
      const next = new Map(prev)
      next.delete(group.id)
      return next
    })
    
    toast.success(`Merged ${selected.size} contacts into one`)
  }, [selectedForMerge, primaryContact, onMergeContacts])

  const handleRemoveSelected = useCallback((groupId: string, contactIds: string[]) => {
    onRemoveContacts(contactIds)
    
    setSelectedForMerge(prev => {
      const next = new Map(prev)
      next.delete(groupId)
      return next
    })
    
    toast.success(`Removed ${contactIds.length} contact${contactIds.length > 1 ? 's' : ''}`)
  }, [onRemoveContacts])

  const renderContactCard = (
    contact: RawSourceContact, 
    groupId: string,
    isSelected: boolean,
    isPrimary: boolean
  ) => {
    const name = contact.normalized_fields.fullName || 
      [contact.normalized_fields.firstName, contact.normalized_fields.lastName]
        .filter(Boolean).join(' ') || 'Unknown'
    const email = contact.normalized_fields.email || ''
    const org = contact.normalized_fields.organization || 
      contact.normalized_fields.company || ''
    const title = contact.normalized_fields.title || ''
    const phone = contact.normalized_fields.phone || ''

    return (
      <div 
        key={contact.id} 
        className={cn(
          "p-2 rounded border text-xs transition-colors",
          isSelected ? "bg-primary/10 border-primary" : "bg-background",
          isPrimary && "ring-2 ring-primary"
        )}
      >
        <div className="flex items-start gap-2">
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => toggleContactSelection(groupId, contact.id)}
            className="mt-0.5"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium truncate">{name}</span>
              {isPrimary && (
                <Badge variant="default" className="text-[10px] px-1 py-0">Primary</Badge>
              )}
            </div>
            {title && <div className="text-muted-foreground truncate">{title}</div>}
            {org && <div className="text-muted-foreground truncate">{org}</div>}
            {email && <div className="text-muted-foreground truncate">{email}</div>}
            {phone && <div className="text-muted-foreground truncate">{phone}</div>}
          </div>
          {isSelected && !isPrimary && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-[10px] px-2"
              onClick={() => setPrimaryForMerge(groupId, contact.id)}
            >
              Set Primary
            </Button>
          )}
        </div>
      </div>
    )
  }

  const renderDuplicateGroup = (group: DuplicateGroup | OrganizationGroup, index: number) => {
    const isExpanded = expandedGroups.has(group.id)
    const selected = selectedForMerge.get(group.id) || new Set()
    const primary = primaryContact.get(group.id)
    const isOrgGroup = 'organizationName' in group

    return (
      <Collapsible
        key={group.id}
        open={isExpanded}
        onOpenChange={() => toggleGroupExpanded(group.id)}
      >
        <Card className="mb-2">
          <CollapsibleTrigger asChild>
            <CardHeader className="p-3 cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2">
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
                {isOrgGroup ? (
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Users className="h-4 w-4 text-muted-foreground" />
                )}
                <div className="flex-1">
                  <span className="text-xs font-medium">
                    {isOrgGroup 
                      ? (group as OrganizationGroup).organizationName
                      : `Group ${index + 1}`
                    }
                  </span>
                  <span className="text-xs text-muted-foreground ml-2">
                    {group.contacts.length} contacts
                  </span>
                </div>
                {'matchReasons' in group && (
                  <div className="flex gap-1">
                    {(group as DuplicateGroup).matchReasons.slice(0, 2).map((reason, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px]">
                        {reason}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          
          <CollapsibleContent>
            <CardContent className="p-3 pt-0 space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-[10px]"
                  onClick={() => selectAllInGroup(group.id, group.contacts.map(c => c.id))}
                >
                  Select All
                </Button>
                <div className="flex-1" />
                {selected.size >= 2 && (
                  <>
                    <Button
                      size="sm"
                      variant="default"
                      className="h-6 text-[10px]"
                      onClick={() => handleMergeGroup(group)}
                      disabled={!primary}
                    >
                      <GitMerge className="h-3 w-3 mr-1" />
                      Merge Selected
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-6 text-[10px]"
                      onClick={() => handleRemoveSelected(group.id, Array.from(selected))}
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Remove
                    </Button>
                  </>
                )}
              </div>
              
              <div className="space-y-1">
                {group.contacts.map(contact => 
                  renderContactCard(
                    contact, 
                    group.id, 
                    selected.has(contact.id),
                    primary === contact.id
                  )
                )}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    )
  }

  const currentGroups = duplicateType === 'contacts' ? contactDuplicates : organizationDuplicates
  const totalDuplicates = currentGroups.reduce((sum, g) => sum + g.contacts.length, 0)

  return (
    <div className="h-full flex flex-col">
      <Card className="flex-shrink-0 mb-3">
        <CardHeader className="p-3 pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Duplicate Detection
          </CardTitle>
          <CardDescription className="text-xs">
            Find and merge duplicate contacts or organizations
          </CardDescription>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <Tabs value={duplicateType} onValueChange={(v) => setDuplicateType(v as DuplicateType)}>
            <TabsList className="w-full h-8">
              <TabsTrigger value="contacts" className="flex-1 text-xs h-7">
                <Users className="h-3 w-3 mr-1" />
                Contacts ({contactDuplicates.length})
              </TabsTrigger>
              <TabsTrigger value="organizations" className="flex-1 text-xs h-7">
                <Building2 className="h-3 w-3 mr-1" />
                Organizations ({organizationDuplicates.length})
              </TabsTrigger>
            </TabsList>
          </Tabs>
          
          {duplicateType === 'contacts' && (
            <div className="mt-3 space-y-2">
              <Label className="text-xs">
                Match Sensitivity: {Math.round(threshold[0] * 100)}%
              </Label>
              <Slider
                value={threshold}
                onValueChange={setThreshold}
                min={0.3}
                max={0.9}
                step={0.05}
                className="w-full"
              />
              <p className="text-[10px] text-muted-foreground">
                Lower = more matches, Higher = stricter matching
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {currentGroups.length === 0 ? (
        <Card className="flex-1">
          <CardContent className="h-full flex flex-col items-center justify-center text-center p-6">
            <CheckCircle2 className="h-10 w-10 text-green-500 mb-3" />
            <p className="text-sm font-medium">No duplicates found</p>
            <p className="text-xs text-muted-foreground mt-1">
              {duplicateType === 'contacts' 
                ? 'All contacts appear to be unique'
                : 'No organizations with multiple contacts'
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="flex-1">
          <div className="space-y-2 pr-2">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground">
                {currentGroups.length} groups • {totalDuplicates} contacts
              </p>
            </div>
            {currentGroups.map((group, index) => renderDuplicateGroup(group, index))}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}
