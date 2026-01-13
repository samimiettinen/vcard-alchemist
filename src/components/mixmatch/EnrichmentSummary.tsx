import { useMemo } from 'react'
import { 
  Sparkles, 
  Mail, 
  Phone, 
  Building2, 
  Briefcase, 
  Link2, 
  MapPin, 
  Tag, 
  FileText,
  Users,
  CheckCircle2,
  XCircle
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import type { EnrichedContact } from '@/hooks/useEnrichmentEngine'

interface EnrichmentSummaryProps {
  enrichedContacts: EnrichedContact[]
}

interface FieldStat {
  field: string
  label: string
  icon: React.ReactNode
  originalCount: number
  enrichedCount: number
  addedCount: number
}

export function EnrichmentSummary({ enrichedContacts }: EnrichmentSummaryProps) {
  const stats = useMemo(() => {
    if (enrichedContacts.length === 0) return null

    const totalContacts = enrichedContacts.length
    const enrichedCount = enrichedContacts.filter(ec => ec.matchedSources.length > 0).length
    const enrichmentRate = (enrichedCount / totalContacts) * 100

    // Calculate field-level statistics
    const fieldStats: FieldStat[] = []

    // Email
    const originalEmails = enrichedContacts.filter(ec => ec.original.normalized_fields.email).length
    const enrichedEmails = enrichedContacts.filter(ec => ec.enrichedFields.email).length
    fieldStats.push({
      field: 'email',
      label: 'Sähköposti',
      icon: <Mail className="h-4 w-4" />,
      originalCount: originalEmails,
      enrichedCount: enrichedEmails,
      addedCount: enrichedEmails - originalEmails
    })

    // Phone
    const originalPhones = enrichedContacts.filter(ec => 
      ec.original.normalized_fields.phone || 
      (ec.original.normalized_fields.phones && ec.original.normalized_fields.phones.length > 0)
    ).length
    const enrichedPhones = enrichedContacts.filter(ec => 
      ec.enrichedFields.phone || 
      (ec.enrichedFields.phones && ec.enrichedFields.phones.length > 0)
    ).length
    fieldStats.push({
      field: 'phone',
      label: 'Puhelin',
      icon: <Phone className="h-4 w-4" />,
      originalCount: originalPhones,
      enrichedCount: enrichedPhones,
      addedCount: enrichedPhones - originalPhones
    })

    // Organization
    const originalOrgs = enrichedContacts.filter(ec => 
      ec.original.normalized_fields.organization || ec.original.normalized_fields.company
    ).length
    const enrichedOrgs = enrichedContacts.filter(ec => 
      ec.enrichedFields.organization || ec.enrichedFields.company
    ).length
    fieldStats.push({
      field: 'organization',
      label: 'Organisaatio',
      icon: <Building2 className="h-4 w-4" />,
      originalCount: originalOrgs,
      enrichedCount: enrichedOrgs,
      addedCount: enrichedOrgs - originalOrgs
    })

    // Title/Role
    const originalTitles = enrichedContacts.filter(ec => 
      ec.original.normalized_fields.title || ec.original.normalized_fields.role
    ).length
    const enrichedTitles = enrichedContacts.filter(ec => 
      ec.enrichedFields.title || ec.enrichedFields.role
    ).length
    fieldStats.push({
      field: 'title',
      label: 'Titteli',
      icon: <Briefcase className="h-4 w-4" />,
      originalCount: originalTitles,
      enrichedCount: enrichedTitles,
      addedCount: enrichedTitles - originalTitles
    })

    // LinkedIn
    const originalLinkedIn = enrichedContacts.filter(ec => 
      ec.original.normalized_fields.linkedinUrl
    ).length
    const enrichedLinkedIn = enrichedContacts.filter(ec => 
      ec.enrichedFields.linkedinUrl
    ).length
    fieldStats.push({
      field: 'linkedin',
      label: 'LinkedIn',
      icon: <Link2 className="h-4 w-4" />,
      originalCount: originalLinkedIn,
      enrichedCount: enrichedLinkedIn,
      addedCount: enrichedLinkedIn - originalLinkedIn
    })

    // Address
    const originalAddresses = enrichedContacts.filter(ec => 
      ec.original.normalized_fields.address
    ).length
    const enrichedAddresses = enrichedContacts.filter(ec => 
      ec.enrichedFields.address
    ).length
    fieldStats.push({
      field: 'address',
      label: 'Osoite',
      icon: <MapPin className="h-4 w-4" />,
      originalCount: originalAddresses,
      enrichedCount: enrichedAddresses,
      addedCount: enrichedAddresses - originalAddresses
    })

    // Tags
    const originalWithTags = enrichedContacts.filter(ec => 
      ec.original.normalized_fields.tags && ec.original.normalized_fields.tags.length > 0
    ).length
    const enrichedWithTags = enrichedContacts.filter(ec => 
      ec.enrichedFields.tags && ec.enrichedFields.tags.length > 0
    ).length
    fieldStats.push({
      field: 'tags',
      label: 'Tagit',
      icon: <Tag className="h-4 w-4" />,
      originalCount: originalWithTags,
      enrichedCount: enrichedWithTags,
      addedCount: enrichedWithTags - originalWithTags
    })

    // Notes
    const originalNotes = enrichedContacts.filter(ec => 
      ec.original.normalized_fields.notes
    ).length
    const enrichedNotes = enrichedContacts.filter(ec => 
      ec.enrichedFields.notes
    ).length
    fieldStats.push({
      field: 'notes',
      label: 'Muistiinpanot',
      icon: <FileText className="h-4 w-4" />,
      originalCount: originalNotes,
      enrichedCount: enrichedNotes,
      addedCount: enrichedNotes - originalNotes
    })

    // Count total fields added
    const totalFieldsAdded = fieldStats.reduce((sum, fs) => sum + Math.max(0, fs.addedCount), 0)

    return {
      totalContacts,
      enrichedCount,
      notEnrichedCount: totalContacts - enrichedCount,
      enrichmentRate,
      fieldStats: fieldStats.filter(fs => fs.addedCount > 0 || fs.enrichedCount > 0),
      totalFieldsAdded
    }
  }, [enrichedContacts])

  if (!stats) {
    return null
  }

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg font-semibold">Rikastuksen yhteenveto</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold">{stats.totalContacts}</p>
            <p className="text-xs text-muted-foreground">Kontaktia yhteensä</p>
          </div>
          <div className="text-center p-3 bg-primary/10 rounded-lg">
            <div className="flex items-center justify-center gap-2 mb-1">
              <CheckCircle2 className="h-4 w-4 text-primary" />
            </div>
            <p className="text-2xl font-bold text-primary">{stats.enrichedCount}</p>
            <p className="text-xs text-muted-foreground">Rikastettu</p>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-center gap-2 mb-1">
              <XCircle className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold">{stats.notEnrichedCount}</p>
            <p className="text-xs text-muted-foreground">Ei täsmäystä</p>
          </div>
        </div>

        {/* Enrichment rate */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Rikastusaste</span>
            <span className="font-medium">{Math.round(stats.enrichmentRate)}%</span>
          </div>
          <Progress value={stats.enrichmentRate} className="h-2" />
        </div>

        {/* Field-level stats */}
        {stats.fieldStats.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Lisätyt tiedot kenttätasolla</h4>
            <div className="grid grid-cols-2 gap-2">
              {stats.fieldStats.map(fs => (
                <div 
                  key={fs.field} 
                  className={`flex items-center justify-between p-2 rounded-lg ${
                    fs.addedCount > 0 ? 'bg-primary/10' : 'bg-muted/30'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={fs.addedCount > 0 ? 'text-primary' : 'text-muted-foreground'}>
                      {fs.icon}
                    </span>
                    <span className="text-sm">{fs.label}</span>
                  </div>
                  <div className="text-right">
                    {fs.addedCount > 0 ? (
                      <span className="text-sm font-medium text-primary">+{fs.addedCount}</span>
                    ) : (
                      <span className="text-sm text-muted-foreground">{fs.enrichedCount}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Total fields added */}
        {stats.totalFieldsAdded > 0 && (
          <div className="pt-2 border-t">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Yhteensä lisättyjä tietoja</span>
              <span className="text-lg font-bold text-primary">+{stats.totalFieldsAdded}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
