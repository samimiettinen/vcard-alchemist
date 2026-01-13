import { useState } from 'react'
import { 
  User, 
  Building2, 
  ChevronDown, 
  ChevronRight, 
  Mail, 
  Phone, 
  Link2,
  Sparkles,
  FileSpreadsheet
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import type { EnrichedContact } from '@/hooks/useEnrichmentEngine'

interface EnrichmentResultsPanelProps {
  enrichedContacts: EnrichedContact[]
}

export function EnrichmentResultsPanel({ enrichedContacts }: EnrichmentResultsPanelProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const enrichedCount = enrichedContacts.filter(ec => ec.matchedSources.length > 0).length
  const totalCount = enrichedContacts.length

  if (enrichedContacts.length === 0) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold">Rikastetut kontaktit</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p>Suorita rikastus nähdäksesi tulokset</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Rikastetut kontaktit</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {enrichedCount}/{totalCount} rikastettu
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full px-4 pb-4">
          <div className="space-y-2">
            {enrichedContacts.map(ec => {
              const isExpanded = expandedIds.has(ec.id)
              const hasEnrichments = ec.matchedSources.length > 0
              const fields = ec.enrichedFields

              return (
                <Collapsible key={ec.id} open={isExpanded} onOpenChange={() => toggleExpanded(ec.id)}>
                  <div className={`rounded-lg border bg-card ${hasEnrichments ? 'ring-1 ring-primary/20' : ''}`}>
                    <CollapsibleTrigger className="w-full p-3 text-left hover:bg-accent/50 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-shrink-0">
                          <User className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium truncate">
                              {fields.fullName || 
                               [fields.firstName, fields.lastName].filter(Boolean).join(' ') ||
                               'Nimetön'}
                            </p>
                            {hasEnrichments && (
                              <Badge variant="default" className="text-xs">
                                <Sparkles className="h-3 w-3 mr-1" />
                                +{ec.matchedSources.length}
                              </Badge>
                            )}
                          </div>
                          {fields.email && (
                            <p className="text-sm text-muted-foreground truncate">{fields.email}</p>
                          )}
                          {(fields.organization || fields.company) && (
                            <p className="text-xs text-muted-foreground truncate">
                              {fields.organization || fields.company}
                            </p>
                          )}
                        </div>
                      </div>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="px-3 pb-3 pt-0 border-t">
                        <div className="grid grid-cols-2 gap-3 mt-3">
                          {/* Contact details */}
                          <div className="space-y-2">
                            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                              Yhteystiedot
                            </h4>
                            {fields.email && (
                              <div className="flex items-center gap-2 text-sm">
                                <Mail className="h-3 w-3 text-muted-foreground" />
                                <span className="truncate">{fields.email}</span>
                              </div>
                            )}
                            {fields.phone && (
                              <div className="flex items-center gap-2 text-sm">
                                <Phone className="h-3 w-3 text-muted-foreground" />
                                <span>{fields.phone}</span>
                              </div>
                            )}
                            {fields.linkedinUrl && (
                              <div className="flex items-center gap-2 text-sm">
                                <Link2 className="h-3 w-3 text-muted-foreground" />
                                <span className="truncate">{fields.linkedinUrl}</span>
                              </div>
                            )}
                            {(fields.title || fields.role) && (
                              <div className="text-sm text-muted-foreground">
                                {fields.title || fields.role}
                              </div>
                            )}
                          </div>

                          {/* Enrichment sources */}
                          {hasEnrichments && (
                            <div className="space-y-2">
                              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                Rikastuslähteet
                              </h4>
                              {ec.matchedSources.map((match, idx) => (
                                <div key={idx} className="flex items-start gap-2 text-sm">
                                  <FileSpreadsheet className="h-3 w-3 text-muted-foreground mt-0.5" />
                                  <div>
                                    <p className="truncate">{match.sourceFile.filename}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {Math.round(match.matchScore * 100)}% • {match.matchReasons.join(', ')}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Tags */}
                        {fields.tags && fields.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-3">
                            {fields.tags.map((tag, i) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
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
