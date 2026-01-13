import { User, Building2, Mail, Phone, Globe, MapPin, FileText, Tag } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import type { RawSourceContact, SourceFile, NormalizedFields } from '@/types/database'

interface SourceContactsPanelProps {
  matchedContacts: RawSourceContact[]
  sourceFiles: SourceFile[]
  selectedContactId?: string
  onSelectContact: (contactId: string) => void
}

export function SourceContactsPanel({
  matchedContacts,
  sourceFiles,
  selectedContactId,
  onSelectContact
}: SourceContactsPanelProps) {
  // Group contacts by source file
  const contactsBySource = matchedContacts.reduce((acc, contact) => {
    const sourceFile = sourceFiles.find(f => f.id === contact.source_file_id)
    const sourceKey = sourceFile?.filename || 'Tuntematon lähde'
    
    if (!acc[sourceKey]) {
      acc[sourceKey] = []
    }
    acc[sourceKey].push(contact)
    return acc
  }, {} as Record<string, RawSourceContact[]>)

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold">Lähteet</CardTitle>
        <p className="text-sm text-muted-foreground">
          {matchedContacts.length > 0 
            ? `${matchedContacts.length} matchaavaa kontaktia`
            : 'Valitse kontakti aloittaaksesi'
          }
        </p>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full px-4 pb-4">
          {matchedContacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <User className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">
                Tuo tiedostoja ja valitse kontakti<br />aloittaaksesi matchauksen
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(contactsBySource).map(([sourceName, contacts]) => (
                <div key={sourceName}>
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {sourceName}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {contacts.map(contact => (
                      <ContactCard
                        key={contact.id}
                        contact={contact}
                        isSelected={contact.id === selectedContactId}
                        onClick={() => onSelectContact(contact.id)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

interface ContactCardProps {
  contact: RawSourceContact
  isSelected: boolean
  onClick: () => void
}

function ContactCard({ contact, isSelected, onClick }: ContactCardProps) {
  const { normalized_fields: n, confidence_scores: scores } = contact
  const displayName = n.fullName || [n.firstName, n.lastName].filter(Boolean).join(' ') || 'Nimetön'
  
  return (
    <div
      onClick={onClick}
      className={`
        p-3 rounded-lg cursor-pointer transition-all duration-200
        ${isSelected 
          ? 'bg-primary text-primary-foreground ring-2 ring-primary' 
          : 'bg-muted/50 hover:bg-muted'
        }
      `}
    >
      <div className="flex items-start gap-3">
        <div className={`
          w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
          ${isSelected ? 'bg-primary-foreground/20' : 'bg-primary/10'}
        `}>
          <User className={`h-4 w-4 ${isSelected ? 'text-primary-foreground' : 'text-primary'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{displayName}</p>
          
          {/* Preview of key fields */}
          <div className="mt-1 space-y-0.5">
            {n.email && (
              <div className="flex items-center gap-1.5 text-xs opacity-80">
                <Mail className="h-3 w-3" />
                <span className="truncate">{n.email}</span>
              </div>
            )}
            {(n.organization || n.company) && (
              <div className="flex items-center gap-1.5 text-xs opacity-80">
                <Building2 className="h-3 w-3" />
                <span className="truncate">{n.organization || n.company}</span>
              </div>
            )}
            {(n.title || n.role) && (
              <div className="flex items-center gap-1.5 text-xs opacity-70">
                <span className="truncate">{n.title || n.role}</span>
              </div>
            )}
          </div>
          
          {/* Confidence indicator */}
          <div className="flex items-center gap-1 mt-2">
            {Object.entries(scores).slice(0, 4).map(([field, score]) => (
              <Badge 
                key={field}
                variant={isSelected ? 'outline' : 'secondary'}
                className={`text-[10px] px-1.5 py-0 ${isSelected ? 'border-primary-foreground/30' : ''}`}
              >
                {Math.round(score * 100)}%
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
