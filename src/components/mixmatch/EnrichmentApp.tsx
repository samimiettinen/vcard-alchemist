import { useState, useCallback } from 'react'
import { useEnrichmentEngine } from '@/hooks/useEnrichmentEngine'
import { ListImportCard } from './ListImportCard'
import { FieldSelectionCard } from './FieldSelectionCard'
import { EnrichmentResultsPanel } from './EnrichmentResultsPanel'
import { SavedContactsPanel } from './SavedContactsPanel'
import { DuplicateWarningDialog } from './DuplicateWarningDialog'
import { DuplicateManagerPanel } from './DuplicateManagerPanel'
import { TeamScraperPanel } from './TeamScraperPanel'
import { UniversalDownloadButton } from './UniversalDownloadButton'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { 
  Sparkles, 
  Trash2,
  ArrowRight,
  MessageSquare,
  AlertTriangle,
  Globe,
  GitMerge
} from 'lucide-react'
import { toast } from 'sonner'
import type { MasterContact, RawSourceContact } from '@/types/database'
import type { ScrapeResult } from '@/lib/api/teamScraper'

export function EnrichmentApp() {
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false)
  const [scrapedResults, setScrapedResults] = useState<ScrapeResult | null>(null)
  const [selectedScrapedMembers, setSelectedScrapedMembers] = useState<Set<number>>(new Set())
  
  const {
    primaryList,
    secondaryList,
    tertiaryList,
    enrichedContacts,
    selectedEnrichmentFields,
    globalNotes,
    isProcessing,
    error,
    primaryListDuplicates,
    importList,
    importScrapedContacts,
    removeList,
    runEnrichment,
    setGlobalNotes,
    toggleEnrichmentField,
    selectAllEnrichmentFields,
    deselectAllEnrichmentFields,
    clearAll,
    mergeContacts,
    removeContacts
  } = useEnrichmentEngine()

  // Get all contacts for duplicate management
  const allContacts = [
    ...primaryList.contacts,
    ...secondaryList.contacts,
    ...tertiaryList.contacts
  ]

  const handleMergeContacts = useCallback((mergedContact: RawSourceContact, removedIds: string[]) => {
    mergeContacts(mergedContact, removedIds)
  }, [mergeContacts])

  const handleRemoveContacts = useCallback((contactIds: string[]) => {
    removeContacts(contactIds)
  }, [removeContacts])

  const canEnrich = primaryList.contacts.length > 0 && 
    (secondaryList.contacts.length > 0 || tertiaryList.contacts.length > 0)

  const handleEnrichClick = () => {
    if (primaryListDuplicates.length > 0) {
      setShowDuplicateWarning(true)
    } else {
      runEnrichment()
    }
  }

  const handleProceedWithDuplicates = () => {
    setShowDuplicateWarning(false)
    runEnrichment()
  }

  const handleEditContact = (contact: MasterContact) => {
    toast.info('Muokkaus ei ole käytettävissä rikastusnäkymässä')
  }

  const handleScrapedDataChange = (result: ScrapeResult | null, selected: Set<number>) => {
    setScrapedResults(result)
    setSelectedScrapedMembers(selected)
  }

  return (
    <div className="h-screen w-full bg-background">
      <ResizablePanelGroup direction="horizontal" className="h-full">
        {/* Left section: List imports */}
        <ResizablePanel defaultSize={40} minSize={30} maxSize={50}>
          <div className="h-full flex flex-col p-4">
            <Tabs defaultValue="enrich" className="h-full flex flex-col">
              <TabsList className="w-full mb-4">
                <TabsTrigger value="enrich" className="flex-1 text-xs">Rikasta</TabsTrigger>
                <TabsTrigger value="scrape" className="flex-1 text-xs">
                  <Globe className="h-3 w-3 mr-1" />
                  Scrape
                </TabsTrigger>
                <TabsTrigger value="duplicates" className="flex-1 text-xs">
                  <GitMerge className="h-3 w-3 mr-1" />
                  Duplikaatit
                </TabsTrigger>
                <TabsTrigger value="saved" className="flex-1 text-xs">Tallennetut</TabsTrigger>
              </TabsList>
              
              <TabsContent value="enrich" className="flex-1 flex flex-col gap-4 m-0 overflow-hidden">
                {/* Global notes field */}
                <Card className="flex-shrink-0">
                  <CardHeader className="pb-2 pt-3 px-4">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      <Label htmlFor="global-notes" className="text-sm font-medium">
                        Internal Notes
                      </Label>
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 pb-3 pt-0">
                    <Textarea
                      id="global-notes"
                      placeholder="Add notes that will be included with every contact..."
                      value={globalNotes}
                      onChange={(e) => setGlobalNotes(e.target.value)}
                      className="min-h-[60px] resize-none text-sm"
                      maxLength={500}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {globalNotes.length}/500 characters
                    </p>
                  </CardContent>
                </Card>

                {/* Field selection */}
                <FieldSelectionCard
                  selectedFields={selectedEnrichmentFields}
                  onToggleField={toggleEnrichmentField}
                  onSelectAll={selectAllEnrichmentFields}
                  onDeselectAll={deselectAllEnrichmentFields}
                />

                {/* List imports */}
                <div className="flex-1 flex flex-col gap-3 overflow-auto">
                  <ListImportCard
                    role="primary"
                    title="1. Päälista"
                    description="Valitse ensin päälista jonka kontakteja rikastetaan"
                    sourceFile={primaryList.sourceFile}
                    contactCount={primaryList.contacts.length}
                    isProcessing={isProcessing}
                    error={error}
                    onImport={(file) => importList(file, 'primary')}
                    onRemove={() => removeList('primary')}
                  />
                  
                  <div className="flex justify-center">
                    <ArrowRight className="h-4 w-4 text-muted-foreground rotate-90" />
                  </div>
                  
                  <ListImportCard
                    role="secondary"
                    title="2. Sekundäärilista"
                    description="Lisätiedot päälistaa varten (valinnainen)"
                    sourceFile={secondaryList.sourceFile}
                    contactCount={secondaryList.contacts.length}
                    isProcessing={isProcessing}
                    error={null}
                    onImport={(file) => importList(file, 'secondary')}
                    onRemove={() => removeList('secondary')}
                    disabled={!primaryList.sourceFile}
                  />
                  
                  <ListImportCard
                    role="tertiary"
                    title="3. Kolmas lista"
                    description="Lisätiedot päälistaa varten (valinnainen)"
                    sourceFile={tertiaryList.sourceFile}
                    contactCount={tertiaryList.contacts.length}
                    isProcessing={isProcessing}
                    error={null}
                    onImport={(file) => importList(file, 'tertiary')}
                    onRemove={() => removeList('tertiary')}
                    disabled={!primaryList.sourceFile}
                  />
                </div>

                {/* Actions */}
                <Card className="flex-shrink-0">
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-2">
                      {primaryListDuplicates.length > 0 && (
                        <div className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-950/30 rounded-md border border-amber-200 dark:border-amber-800">
                          <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                          <span className="text-xs text-amber-700 dark:text-amber-400">
                            {primaryListDuplicates.length} potential duplicate group{primaryListDuplicates.length > 1 ? 's' : ''} detected
                          </span>
                          <Badge variant="outline" className="ml-auto text-xs">
                            {primaryListDuplicates.reduce((sum, g) => sum + g.contacts.length, 0)} contacts
                          </Badge>
                        </div>
                      )}
                      
                      <Button
                        onClick={handleEnrichClick}
                        disabled={!canEnrich || isProcessing}
                        className="w-full"
                      >
                        <Sparkles className="h-4 w-4 mr-2" />
                        Suorita rikastus
                      </Button>
                      
                      <div className="flex gap-2">
                        <UniversalDownloadButton 
                          data={{
                            enrichedContacts,
                            scrapedResults,
                            selectedScrapedMembers,
                            globalNotes
                          }}
                          className="flex-1"
                        />
                        
                        <Button
                          variant="ghost"
                          onClick={clearAll}
                          disabled={!primaryList.sourceFile}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="scrape" className="flex-1 m-0 overflow-auto">
                <TeamScraperPanel 
                  onImportToList={importScrapedContacts} 
                  onDataChange={handleScrapedDataChange}
                />
              </TabsContent>
              
              <TabsContent value="duplicates" className="flex-1 m-0 overflow-hidden">
                <DuplicateManagerPanel
                  contacts={allContacts}
                  onMergeContacts={handleMergeContacts}
                  onRemoveContacts={handleRemoveContacts}
                />
              </TabsContent>
              
              <TabsContent value="saved" className="flex-1 m-0 overflow-hidden">
                <SavedContactsPanel onEditContact={handleEditContact} />
              </TabsContent>
            </Tabs>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right section: Results */}
        <ResizablePanel defaultSize={70} minSize={50}>
          <div className="h-full p-4">
            <EnrichmentResultsPanel enrichedContacts={enrichedContacts} />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
      
      <DuplicateWarningDialog
        open={showDuplicateWarning}
        onOpenChange={setShowDuplicateWarning}
        duplicateGroups={primaryListDuplicates}
        onProceed={handleProceedWithDuplicates}
        onCancel={() => setShowDuplicateWarning(false)}
      />
    </div>
  )
}
