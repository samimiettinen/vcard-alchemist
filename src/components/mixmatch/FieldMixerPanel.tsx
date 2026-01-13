import { useState } from 'react'
import { Check, Edit2, ChevronDown, ChevronUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import type { MasterContact, RawSourceContact, SourceFile, NormalizedFields, PhoneNumber, UrlEntry } from '@/types/database'

interface FieldMixerPanelProps {
  masterContact: Partial<MasterContact>
  matchedContacts: RawSourceContact[]
  sourceFiles: SourceFile[]
  onUpdateField: <K extends keyof MasterContact>(field: K, value: MasterContact[K]) => void
  onApplyFromSource: (field: keyof NormalizedFields, rawContactId: string) => void
}

type FieldConfig = {
  key: keyof NormalizedFields
  masterKey: keyof MasterContact
  label: string
  type: 'text' | 'textarea' | 'array'
}

const FIELD_CONFIGS: FieldConfig[] = [
  { key: 'fullName', masterKey: 'full_name', label: 'Nimi', type: 'text' },
  { key: 'email', masterKey: 'primary_email', label: 'Sähköposti', type: 'text' },
  { key: 'phone', masterKey: 'phones', label: 'Puhelin', type: 'text' },
  { key: 'organization', masterKey: 'organization', label: 'Organisaatio', type: 'text' },
  { key: 'title', masterKey: 'title', label: 'Titteli', type: 'text' },
  { key: 'linkedinUrl', masterKey: 'urls', label: 'LinkedIn', type: 'text' },
  { key: 'websiteUrl', masterKey: 'urls', label: 'Verkkosivusto', type: 'text' },
  { key: 'notes', masterKey: 'notes', label: 'Muistiinpanot', type: 'textarea' },
  { key: 'tags', masterKey: 'tags', label: 'Tagit', type: 'array' },
]

export function FieldMixerPanel({
  masterContact,
  matchedContacts,
  sourceFiles,
  onUpdateField,
  onApplyFromSource
}: FieldMixerPanelProps) {
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set(['fullName', 'email']))
  const [editingField, setEditingField] = useState<string | null>(null)

  const toggleField = (fieldKey: string) => {
    setExpandedFields(prev => {
      const next = new Set(prev)
      if (next.has(fieldKey)) {
        next.delete(fieldKey)
      } else {
        next.add(fieldKey)
      }
      return next
    })
  }

  const getSourceValues = (fieldKey: keyof NormalizedFields) => {
    const values: { contactId: string; value: unknown; source: string; confidence: number }[] = []
    
    for (const contact of matchedContacts) {
      const value = contact.normalized_fields[fieldKey]
      if (value !== undefined && value !== null && value !== '') {
        const sourceFile = sourceFiles.find(f => f.id === contact.source_file_id)
        values.push({
          contactId: contact.id,
          value,
          source: sourceFile?.filename || 'Tuntematon',
          confidence: contact.confidence_scores[fieldKey] || 0
        })
      }
    }
    
    return values
  }

  const getMasterValue = (config: FieldConfig): string => {
    const value = masterContact[config.masterKey]
    if (!value) return ''
    
    if (config.masterKey === 'phones' && Array.isArray(value)) {
      return (value as PhoneNumber[]).map((p) => p.number).join(', ')
    }
    if (config.masterKey === 'urls' && Array.isArray(value)) {
      const urls = value as UrlEntry[]
      const url = urls.find((u) => 
        config.key === 'linkedinUrl' ? u.label === 'linkedin' : u.label === 'website'
      )
      return url?.url || ''
    }
    if (config.masterKey === 'tags' && Array.isArray(value)) {
      return (value as string[]).join(', ')
    }
    
    return String(value)
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold">Mix & Match</CardTitle>
        <p className="text-sm text-muted-foreground">
          Valitse parhaat arvot eri lähteistä
        </p>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full px-4 pb-4">
          <div className="space-y-2">
            {FIELD_CONFIGS.map(config => {
              const sourceValues = getSourceValues(config.key)
              const masterValue = getMasterValue(config)
              const isExpanded = expandedFields.has(config.key)
              const isEditing = editingField === config.key
              
              return (
                <Collapsible
                  key={config.key}
                  open={isExpanded}
                  onOpenChange={() => toggleField(config.key)}
                >
                  <div className="rounded-lg border bg-card">
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{config.label}</span>
                          {sourceValues.length > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              {sourceValues.length} lähde{sourceValues.length > 1 ? 'ttä' : ''}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {masterValue && (
                            <span className="text-sm text-muted-foreground truncate max-w-[150px]">
                              {masterValue}
                            </span>
                          )}
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    
                    <CollapsibleContent>
                      <div className="px-3 pb-3 space-y-2">
                        {/* Current master value / edit field */}
                        <div className="flex items-center gap-2">
                          {isEditing ? (
                            config.type === 'textarea' ? (
                              <Textarea
                                value={masterValue}
                                onChange={(e) => onUpdateField(config.masterKey, e.target.value as never)}
                                onBlur={() => setEditingField(null)}
                                className="min-h-[80px]"
                                autoFocus
                              />
                            ) : (
                              <Input
                                value={masterValue}
                                onChange={(e) => onUpdateField(config.masterKey, e.target.value as never)}
                                onBlur={() => setEditingField(null)}
                                onKeyDown={(e) => e.key === 'Enter' && setEditingField(null)}
                                autoFocus
                              />
                            )
                          ) : (
                            <div 
                              onClick={() => setEditingField(config.key)}
                              className="flex-1 p-2 bg-primary/5 rounded border border-primary/20 cursor-text min-h-[38px] flex items-center"
                            >
                              {masterValue ? (
                                <span className="text-sm">{masterValue}</span>
                              ) : (
                                <span className="text-sm text-muted-foreground italic">
                                  Kirjoita tai valitse arvo alta...
                                </span>
                              )}
                            </div>
                          )}
                          {!isEditing && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditingField(config.key)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        
                        {/* Source values */}
                        {sourceValues.length > 0 && (
                          <div className="space-y-1.5 pt-1">
                            <p className="text-xs text-muted-foreground uppercase tracking-wide">
                              Vaihtoehdot lähteistä:
                            </p>
                            {sourceValues.map(sv => (
                              <button
                                key={`${sv.contactId}-${config.key}`}
                                onClick={() => onApplyFromSource(config.key, sv.contactId)}
                                className="w-full flex items-center justify-between p-2 rounded bg-muted/50 hover:bg-muted transition-colors text-left"
                              >
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm truncate">
                                    {config.type === 'array' && Array.isArray(sv.value)
                                      ? (sv.value as string[]).join(', ')
                                      : String(sv.value)
                                    }
                                  </p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {sv.source}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 ml-2">
                                  <Badge variant="outline" className="text-xs">
                                    {Math.round(sv.confidence * 100)}%
                                  </Badge>
                                  <Check className="h-4 w-4 text-primary opacity-0 group-hover:opacity-100" />
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              )
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
