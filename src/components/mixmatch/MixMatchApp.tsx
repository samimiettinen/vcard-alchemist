import { useContactEngine } from '@/hooks/useContactEngine'
import { FileImportPanel } from './FileImportPanel'
import { RawContactList } from './RawContactList'
import { SourceContactsPanel } from './SourceContactsPanel'
import { FieldMixerPanel } from './FieldMixerPanel'
import { MasterContactPanel } from './MasterContactPanel'
import { SavedContactsPanel } from './SavedContactsPanel'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { MasterContact } from '@/types/database'

export function MixMatchApp() {
  const {
    sourceFiles,
    rawContacts,
    masterContact,
    matchedContacts,
    isProcessing,
    isSaving,
    error,
    importFiles,
    selectRawContact,
    updateMasterField,
    applyFieldFromSource,
    resetMasterContact,
    loadContactForEdit,
    clearAll,
    saveMasterContact
  } = useContactEngine()

  const hasMatchedContacts = matchedContacts.length > 0

  const handleEditContact = (contact: MasterContact) => {
    loadContactForEdit(contact)
  }

  return (
    <div className="h-screen w-full bg-background">
      <ResizablePanelGroup direction="horizontal" className="h-full">
        {/* Left section: Import & contact list */}
        <ResizablePanel defaultSize={25} minSize={20} maxSize={35}>
          <div className="h-full flex flex-col p-4">
            <Tabs defaultValue="import" className="h-full flex flex-col">
              <TabsList className="w-full mb-4">
                <TabsTrigger value="import" className="flex-1">Tuo</TabsTrigger>
                <TabsTrigger value="saved" className="flex-1">Tallennetut</TabsTrigger>
              </TabsList>
              
              <TabsContent value="import" className="flex-1 flex flex-col gap-4 m-0 overflow-hidden">
                <div className="flex-shrink-0 h-[280px]">
                  <FileImportPanel
                    sourceFiles={sourceFiles}
                    isProcessing={isProcessing}
                    error={error}
                    onImport={importFiles}
                    onClearAll={clearAll}
                  />
                </div>
                <div className="flex-1 min-h-0">
                  <RawContactList
                    rawContacts={rawContacts}
                    sourceFiles={sourceFiles}
                    onSelectContact={selectRawContact}
                  />
                </div>
              </TabsContent>
              
              <TabsContent value="saved" className="flex-1 m-0 overflow-hidden">
                <SavedContactsPanel onEditContact={handleEditContact} />
              </TabsContent>
            </Tabs>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Middle section: Sources & Mix/Match */}
        <ResizablePanel defaultSize={40} minSize={30}>
          <div className="h-full flex flex-col p-4 gap-4">
            <div className="h-1/3 min-h-[200px]">
              <SourceContactsPanel
                matchedContacts={matchedContacts}
                sourceFiles={sourceFiles}
                onSelectContact={selectRawContact}
              />
            </div>
            <div className="flex-1 min-h-0">
              <FieldMixerPanel
                masterContact={masterContact}
                matchedContacts={matchedContacts}
                sourceFiles={sourceFiles}
                onUpdateField={updateMasterField}
                onApplyFromSource={applyFieldFromSource}
              />
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right section: Master contact & vCard */}
        <ResizablePanel defaultSize={35} minSize={25}>
          <div className="h-full p-4">
            <MasterContactPanel
              masterContact={masterContact}
              onUpdateField={updateMasterField}
              onReset={resetMasterContact}
              onSave={saveMasterContact}
              isSaving={isSaving}
            />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
