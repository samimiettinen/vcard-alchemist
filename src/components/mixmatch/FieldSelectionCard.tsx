import { 
  Mail, 
  Phone, 
  Building2, 
  Briefcase, 
  Link2, 
  MapPin, 
  Tag, 
  FileText,
  Globe
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import type { EnrichableField } from '@/hooks/useEnrichmentEngine'

interface FieldSelectionCardProps {
  selectedFields: Set<EnrichableField>
  onToggleField: (field: EnrichableField) => void
  onSelectAll: () => void
  onDeselectAll: () => void
}

interface FieldOption {
  id: EnrichableField
  label: string
  icon: React.ReactNode
}

const FIELD_OPTIONS: FieldOption[] = [
  { id: 'email', label: 'Sähköposti', icon: <Mail className="h-4 w-4" /> },
  { id: 'phone', label: 'Puhelin', icon: <Phone className="h-4 w-4" /> },
  { id: 'organization', label: 'Organisaatio', icon: <Building2 className="h-4 w-4" /> },
  { id: 'title', label: 'Titteli', icon: <Briefcase className="h-4 w-4" /> },
  { id: 'linkedin', label: 'LinkedIn', icon: <Link2 className="h-4 w-4" /> },
  { id: 'website', label: 'Verkkosivu', icon: <Globe className="h-4 w-4" /> },
  { id: 'address', label: 'Osoite', icon: <MapPin className="h-4 w-4" /> },
  { id: 'tags', label: 'Tagit', icon: <Tag className="h-4 w-4" /> },
  { id: 'notes', label: 'Muistiinpanot', icon: <FileText className="h-4 w-4" /> },
]

export function FieldSelectionCard({
  selectedFields,
  onToggleField,
  onSelectAll,
  onDeselectAll
}: FieldSelectionCardProps) {
  const allSelected = selectedFields.size === FIELD_OPTIONS.length
  const noneSelected = selectedFields.size === 0

  return (
    <Card className="flex-shrink-0">
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Rikastettavat kentät</CardTitle>
          <div className="flex gap-2">
            <button
              onClick={onSelectAll}
              className="text-xs text-primary hover:underline disabled:opacity-50"
              disabled={allSelected}
            >
              Kaikki
            </button>
            <span className="text-muted-foreground">|</span>
            <button
              onClick={onDeselectAll}
              className="text-xs text-primary hover:underline disabled:opacity-50"
              disabled={noneSelected}
            >
              Ei mitään
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-3 pt-0">
        <div className="grid grid-cols-2 gap-2">
          {FIELD_OPTIONS.map(field => (
            <div
              key={field.id}
              className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors ${
                selectedFields.has(field.id) 
                  ? 'bg-primary/10 hover:bg-primary/15' 
                  : 'bg-muted/30 hover:bg-muted/50'
              }`}
              onClick={() => onToggleField(field.id)}
            >
              <Checkbox
                id={`field-${field.id}`}
                checked={selectedFields.has(field.id)}
                onCheckedChange={() => onToggleField(field.id)}
              />
              <span className={selectedFields.has(field.id) ? 'text-primary' : 'text-muted-foreground'}>
                {field.icon}
              </span>
              <Label 
                htmlFor={`field-${field.id}`} 
                className="text-xs cursor-pointer flex-1"
              >
                {field.label}
              </Label>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {selectedFields.size}/{FIELD_OPTIONS.length} kenttää valittu
        </p>
      </CardContent>
    </Card>
  )
}
