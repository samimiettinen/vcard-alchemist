import { useState } from 'react'
import { User, FileSpreadsheet } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import type { RawSourceContact, SourceFile } from '@/types/database'

interface RawContactListProps {
  rawContacts: RawSourceContact[]
  sourceFiles: SourceFile[]
  onSelectContact: (contactId: string) => void
}

export function RawContactList({
  rawContacts,
  sourceFiles,
  onSelectContact
}: RawContactListProps) {
  const [search, setSearch] = useState('')
  
  const filteredContacts = rawContacts.filter(contact => {
    if (!search) return true
    const searchLower = search.toLowerCase()
    const n = contact.normalized_fields
    return (
      n.fullName?.toLowerCase().includes(searchLower) ||
      n.firstName?.toLowerCase().includes(searchLower) ||
      n.lastName?.toLowerCase().includes(searchLower) ||
      n.email?.toLowerCase().includes(searchLower) ||
      n.company?.toLowerCase().includes(searchLower) ||
      n.organization?.toLowerCase().includes(searchLower)
    )
  })

  // Group by source file
  const bySource = filteredContacts.reduce((acc, contact) => {
    const sourceFile = sourceFiles.find(f => f.id === contact.source_file_id)
    const key = sourceFile?.filename || 'unknown'
    if (!acc[key]) acc[key] = []
    acc[key].push(contact)
    return acc
  }, {} as Record<string, RawSourceContact[]>)

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold">Kaikki kontaktit</CardTitle>
        <Input
          placeholder="Hae nimellä, sähköpostilla..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mt-2"
        />
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full px-4 pb-4">
          {filteredContacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <User className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">
                {rawContacts.length === 0 
                  ? 'Tuo tiedostoja nähdäksesi kontaktit'
                  : 'Ei hakutuloksia'
                }
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(bySource).map(([sourceName, contacts]) => (
                <div key={sourceName}>
                  <div className="flex items-center gap-2 mb-2 sticky top-0 bg-background py-1">
                    <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">
                      {sourceName}
                    </span>
                    <Badge variant="outline" className="text-xs ml-auto">
                      {contacts.length}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    {contacts.map(contact => {
                      const n = contact.normalized_fields
                      const name = n.fullName || [n.firstName, n.lastName].filter(Boolean).join(' ') || 'Nimetön'
                      
                      return (
                        <button
                          key={contact.id}
                          onClick={() => onSelectContact(contact.id)}
                          className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors text-left"
                        >
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <User className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{name}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {n.email || n.organization || n.company || '—'}
                            </p>
                          </div>
                        </button>
                      )
                    })}
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
