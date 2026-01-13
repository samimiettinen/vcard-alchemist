import { Download, User, Building2, RefreshCw, Save, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import type { MasterContact, ContactKind } from '@/types/database'
import { generateVCard, downloadVCard } from '@/lib/vcard/vcardGenerator'
import { toast } from 'sonner'

interface MasterContactPanelProps {
  masterContact: Partial<MasterContact>
  onUpdateField: <K extends keyof MasterContact>(field: K, value: MasterContact[K]) => void
  onReset: () => void
  onSave: () => Promise<{ success: boolean; error?: string }>
  isSaving: boolean
}

export function MasterContactPanel({
  masterContact,
  onUpdateField,
  onReset,
  onSave,
  isSaving
}: MasterContactPanelProps) {
  const hasContent = Boolean(masterContact.full_name || masterContact.primary_email)
  
  const handleDownload = () => {
    if (!masterContact.full_name) return
    downloadVCard(masterContact as MasterContact)
  }

  const handleSave = async () => {
    const result = await onSave()
    if (result.success) {
      toast.success('Kontakti tallennettu tietokantaan!')
    } else {
      toast.error(`Tallennus epäonnistui: ${result.error}`)
    }
  }

  const vcardPreview = hasContent ? generateVCard(masterContact as MasterContact) : ''

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Master-kontakti</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onReset}
              disabled={!hasContent || isSaving}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Tyhjennä
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              disabled={!hasContent}
            >
              <Download className="h-4 w-4 mr-1" />
              vCard
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!hasContent || isSaving}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              Tallenna
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <Tabs defaultValue="preview" className="h-full flex flex-col">
          <div className="px-4">
            <TabsList className="w-full">
              <TabsTrigger value="preview" className="flex-1">Esikatselu</TabsTrigger>
              <TabsTrigger value="vcard" className="flex-1">vCard</TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="preview" className="flex-1 overflow-hidden m-0 px-4 pb-4">
            <ScrollArea className="h-full">
              {hasContent ? (
                <div className="space-y-4 pt-4">
                  {/* Contact type toggle */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant={masterContact.kind === 'individual' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => onUpdateField('kind', 'individual' as ContactKind)}
                    >
                      <User className="h-4 w-4 mr-1" />
                      Henkilö
                    </Button>
                    <Button
                      variant={masterContact.kind === 'org' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => onUpdateField('kind', 'org' as ContactKind)}
                    >
                      <Building2 className="h-4 w-4 mr-1" />
                      Organisaatio
                    </Button>
                  </div>
                  
                  <Separator />
                  
                  {/* Contact card preview */}
                  <div className="rounded-lg border bg-card p-4 space-y-3">
                    {/* Name & title */}
                    <div>
                      <h3 className="text-xl font-semibold">{masterContact.full_name || 'Nimetön'}</h3>
                      {masterContact.title && (
                        <p className="text-muted-foreground">{masterContact.title}</p>
                      )}
                      {masterContact.organization && (
                        <p className="text-sm text-muted-foreground">{masterContact.organization}</p>
                      )}
                    </div>
                    
                    {/* Contact details */}
                    <div className="space-y-2 text-sm">
                      {masterContact.primary_email && (
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground w-20">Sähköposti:</span>
                          <span>{masterContact.primary_email}</span>
                        </div>
                      )}
                      
                      {masterContact.phones?.map((phone, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-muted-foreground w-20 capitalize">{phone.label}:</span>
                          <span>{phone.number}</span>
                        </div>
                      ))}
                      
                      {masterContact.urls?.map((url, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-muted-foreground w-20 capitalize">{url.label}:</span>
                          <a 
                            href={url.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-primary hover:underline truncate"
                          >
                            {url.url}
                          </a>
                        </div>
                      ))}
                    </div>
                    
                    {/* Tags */}
                    {masterContact.tags && masterContact.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {masterContact.tags.map((tag, i) => (
                          <Badge key={i} variant="secondary">{tag}</Badge>
                        ))}
                      </div>
                    )}
                    
                    {/* Notes */}
                    {masterContact.notes && (
                      <div className="pt-2 border-t">
                        <p className="text-xs text-muted-foreground mb-1">Muistiinpanot:</p>
                        <p className="text-sm whitespace-pre-wrap">{masterContact.notes}</p>
                      </div>
                    )}
                  </div>
                  
                  {/* Source links */}
                  {masterContact.source_links && masterContact.source_links.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Lähteet:</p>
                      {masterContact.source_links.map((source, i) => (
                        <div 
                          key={i}
                          className="text-xs text-muted-foreground p-2 bg-muted/50 rounded"
                        >
                          <span className="font-medium">{source.sourceFileName}</span>
                          {source.fieldsFromSource?.length > 0 && (
                            <span> ({source.fieldsFromSource.join(', ')})</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <User className="h-16 w-16 text-muted-foreground/20 mb-4" />
                  <p className="text-muted-foreground">
                    Valitse kenttiä Mix & Match -paneelista<br />
                    rakentaaksesi master-kontaktin
                  </p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="vcard" className="flex-1 overflow-hidden m-0 px-4 pb-4">
            <ScrollArea className="h-full">
              {vcardPreview ? (
                <pre className="p-4 bg-muted rounded-lg text-xs font-mono whitespace-pre-wrap break-all mt-4">
                  {vcardPreview}
                </pre>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-muted-foreground">
                    vCard näkyy tässä kun<br />
                    kontaktilla on sisältöä
                  </p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
