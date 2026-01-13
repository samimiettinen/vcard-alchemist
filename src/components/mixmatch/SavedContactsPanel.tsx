import { useState, useEffect } from 'react'
import { User, Building2, Trash2, Pencil, Loader2, Search, RefreshCw, Download, FileSpreadsheet } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { supabase } from '@/lib/supabaseClient'
import type { MasterContact } from '@/types/database'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'

interface SavedContactsPanelProps {
  onEditContact: (contact: MasterContact) => void
}

export function SavedContactsPanel({ onEditContact }: SavedContactsPanelProps) {
  const [contacts, setContacts] = useState<MasterContact[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [deleteContactId, setDeleteContactId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const fetchContacts = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('mixmatch_master_contacts')
        .select('*')
        .order('updated_at', { ascending: false })

      if (error) {
        console.error('Error fetching contacts:', error)
        toast.error('Kontaktien haku epäonnistui')
        return
      }

      // Transform the data to match our MasterContact type
      const transformedContacts: MasterContact[] = (data || []).map(row => ({
        id: row.id,
        full_name: row.full_name,
        structured_name: row.structured_name as unknown as MasterContact['structured_name'],
        kind: row.kind as MasterContact['kind'],
        primary_email: row.primary_email || undefined,
        secondary_emails: row.secondary_emails || [],
        phones: (row.phones as unknown as MasterContact['phones']) || [],
        organization: row.organization || undefined,
        title: row.title || undefined,
        urls: (row.urls as unknown as MasterContact['urls']) || [],
        addresses: (row.addresses as unknown as MasterContact['addresses']) || [],
        notes: row.notes || undefined,
        tags: row.tags || [],
        source_links: (row.source_links as unknown as MasterContact['source_links']) || [],
        consiglieri_contact_id: row.consiglieri_contact_id || undefined,
        created_at: row.created_at,
        updated_at: row.updated_at
      }))

      setContacts(transformedContacts)
    } catch (err) {
      console.error('Error:', err)
      toast.error('Virhe kontaktien haussa')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchContacts()
  }, [])

  const handleDelete = async () => {
    if (!deleteContactId) return
    
    setIsDeleting(true)
    try {
      const { error } = await supabase
        .from('mixmatch_master_contacts')
        .delete()
        .eq('id', deleteContactId)

      if (error) {
        console.error('Delete error:', error)
        toast.error('Poisto epäonnistui')
        return
      }

      setContacts(prev => prev.filter(c => c.id !== deleteContactId))
      toast.success('Kontakti poistettu')
    } catch (err) {
      console.error('Error:', err)
      toast.error('Virhe poistossa')
    } finally {
      setIsDeleting(false)
      setDeleteContactId(null)
    }
  }

  const filteredContacts = contacts.filter(contact => {
    if (!searchQuery.trim()) return true
    const query = searchQuery.toLowerCase()
    return (
      contact.full_name?.toLowerCase().includes(query) ||
      contact.primary_email?.toLowerCase().includes(query) ||
      contact.organization?.toLowerCase().includes(query) ||
      contact.tags?.some(tag => tag.toLowerCase().includes(query))
    )
  })

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredContacts.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredContacts.map(c => c.id)))
    }
  }

  const getExportContacts = () => {
    if (selectedIds.size > 0) {
      return contacts.filter(c => selectedIds.has(c.id))
    }
    return contacts
  }

  const prepareExportData = (contactsToExport: MasterContact[]) => {
    return contactsToExport.map(c => ({
      'Nimi': c.full_name || '',
      'Etunimi': c.structured_name?.givenName || '',
      'Sukunimi': c.structured_name?.familyName || '',
      'Sähköposti': c.primary_email || '',
      'Muut sähköpostit': c.secondary_emails?.join('; ') || '',
      'Puhelimet': c.phones?.map(p => `${p.label}: ${p.number}`).join('; ') || '',
      'Organisaatio': c.organization || '',
      'Titteli': c.title || '',
      'Tagit': c.tags?.join(', ') || '',
      'URL-osoitteet': c.urls?.map(u => u.url).join('; ') || '',
      'Muistiinpanot': c.notes || '',
      'Tyyppi': c.kind === 'org' ? 'Organisaatio' : 'Henkilö',
      'Luotu': c.created_at || '',
      'Päivitetty': c.updated_at || ''
    }))
  }

  const exportToCSV = () => {
    const exportContacts = getExportContacts()
    if (exportContacts.length === 0) {
      toast.error('Ei kontakteja vietäväksi')
      return
    }

    const data = prepareExportData(exportContacts)
    const headers = Object.keys(data[0])
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(h => {
          const value = String(row[h as keyof typeof row] || '')
          // Escape quotes and wrap in quotes if contains comma or newline
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
    link.download = `kontaktit_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
    toast.success(`${exportContacts.length} kontaktia viety CSV-tiedostoon`)
    setSelectedIds(new Set())
  }

  const exportToExcel = () => {
    const exportContacts = getExportContacts()
    if (exportContacts.length === 0) {
      toast.error('Ei kontakteja vietäväksi')
      return
    }

    const data = prepareExportData(exportContacts)
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Kontaktit')
    
    // Auto-size columns
    const colWidths = Object.keys(data[0]).map(key => ({
      wch: Math.max(key.length, ...data.map(row => String(row[key as keyof typeof row] || '').length))
    }))
    ws['!cols'] = colWidths.map(w => ({ wch: Math.min(w.wch, 50) }))

    XLSX.writeFile(wb, `kontaktit_${new Date().toISOString().split('T')[0]}.xlsx`)
    toast.success(`${exportContacts.length} kontaktia viety Excel-tiedostoon`)
    setSelectedIds(new Set())
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg font-semibold">
              Tallennetut ({contacts.length})
            </CardTitle>
            {selectedIds.size > 0 && (
              <Badge variant="secondary" className="text-xs">
                {selectedIds.size} valittu
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={contacts.length === 0}
                >
                  <Download className="h-4 w-4 mr-1" />
                  Vie
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportToCSV}>
                  <Download className="h-4 w-4 mr-2" />
                  CSV-tiedosto
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportToExcel}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Excel-tiedosto
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchContacts}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
        <div className="relative mt-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Etsi kontakteja..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full px-4 pb-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <User className="h-16 w-16 text-muted-foreground/20 mb-4" />
              <p className="text-muted-foreground">
                {searchQuery ? 'Ei hakutuloksia' : 'Ei tallennettuja kontakteja'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Select all row */}
              {filteredContacts.length > 0 && (
                <div className="flex items-center gap-2 py-2 px-1 border-b">
                  <Checkbox
                    checked={selectedIds.size === filteredContacts.length && filteredContacts.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                  <span className="text-sm text-muted-foreground">
                    Valitse kaikki ({filteredContacts.length})
                  </span>
                </div>
              )}
              {filteredContacts.map(contact => (
                <div
                  key={contact.id}
                  className={`p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors group ${
                    selectedIds.has(contact.id) ? 'ring-2 ring-primary/50' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="flex-shrink-0 mt-0.5">
                        <Checkbox
                          checked={selectedIds.has(contact.id)}
                          onCheckedChange={() => toggleSelection(contact.id)}
                        />
                      </div>
                      <div 
                        className="flex items-start gap-2 flex-1 min-w-0 cursor-pointer"
                        onClick={() => toggleSelection(contact.id)}
                      >
                        <div className="flex-shrink-0 mt-0.5">
                          {contact.kind === 'org' ? (
                            <Building2 className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <User className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{contact.full_name}</p>
                          {contact.title && (
                            <p className="text-sm text-muted-foreground truncate">{contact.title}</p>
                          )}
                          {contact.organization && (
                            <p className="text-sm text-muted-foreground truncate">{contact.organization}</p>
                          )}
                          {contact.primary_email && (
                            <p className="text-xs text-muted-foreground truncate mt-1">{contact.primary_email}</p>
                          )}
                          {contact.tags && contact.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {contact.tags.slice(0, 3).map((tag, i) => (
                                <Badge key={i} variant="secondary" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                              {contact.tags.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{contact.tags.length - 3}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => { e.stopPropagation(); onEditContact(contact); }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); setDeleteContactId(contact.id); }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>

      <AlertDialog open={!!deleteContactId} onOpenChange={(open) => !open && setDeleteContactId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Poista kontakti?</AlertDialogTitle>
            <AlertDialogDescription>
              Tätä toimintoa ei voi peruuttaa. Kontakti poistetaan pysyvästi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Peruuta</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete} 
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Poista
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
