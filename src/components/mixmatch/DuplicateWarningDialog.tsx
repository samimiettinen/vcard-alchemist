import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Users } from 'lucide-react'
import type { RawSourceContact } from '@/types/database'

export interface DuplicateGroup {
  id: string
  contacts: RawSourceContact[]
  matchReasons: string[]
}

interface DuplicateWarningDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  duplicateGroups: DuplicateGroup[]
  onProceed: () => void
  onCancel: () => void
}

export function DuplicateWarningDialog({
  open,
  onOpenChange,
  duplicateGroups,
  onProceed,
  onCancel
}: DuplicateWarningDialogProps) {
  const totalDuplicates = duplicateGroups.reduce((sum, g) => sum + g.contacts.length, 0)
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
            Potential Duplicates Detected
          </DialogTitle>
          <DialogDescription>
            Found {duplicateGroups.length} groups with {totalDuplicates} potential duplicate contacts in your primary list.
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="flex-1 max-h-[400px] pr-4">
          <div className="space-y-4">
            {duplicateGroups.map((group, groupIndex) => (
              <div 
                key={group.id} 
                className="border rounded-lg p-3 bg-muted/30"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    Group {groupIndex + 1}: {group.contacts.length} similar contacts
                  </span>
                </div>
                
                <div className="flex flex-wrap gap-1 mb-3">
                  {group.matchReasons.map((reason, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {reason}
                    </Badge>
                  ))}
                </div>
                
                <div className="space-y-2">
                  {group.contacts.map((contact, i) => {
                    const name = contact.normalized_fields.fullName || 
                      [contact.normalized_fields.firstName, contact.normalized_fields.lastName]
                        .filter(Boolean).join(' ') || 
                      'Unknown'
                    const email = contact.normalized_fields.email || ''
                    const org = contact.normalized_fields.organization || 
                      contact.normalized_fields.company || ''
                    
                    return (
                      <div 
                        key={contact.id} 
                        className="text-sm p-2 bg-background rounded border"
                      >
                        <div className="font-medium">{name}</div>
                        {email && (
                          <div className="text-muted-foreground text-xs">{email}</div>
                        )}
                        {org && (
                          <div className="text-muted-foreground text-xs">{org}</div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        
        <DialogFooter className="flex gap-2 pt-4">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onProceed}>
            Continue with Enrichment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
