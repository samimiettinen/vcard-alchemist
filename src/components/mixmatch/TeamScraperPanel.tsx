import { useState, useCallback, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Globe, 
  Loader2, 
  Download, 
  Users, 
  Building2, 
  Linkedin,
  Mail,
  Phone,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Import,
  ArrowRight
} from 'lucide-react'
import { scrapeTeamPage, type TeamMember, type ScrapeResult } from '@/lib/api/teamScraper'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import type { ListRole } from '@/hooks/useEnrichmentEngine'

interface TeamScraperPanelProps {
  onImportToList?: (
    members: TeamMember[],
    organizationName: string,
    organizationUrl: string,
    role: ListRole
  ) => void
  onDataChange?: (result: ScrapeResult | null, selectedMembers: Set<number>) => void
}

export function TeamScraperPanel({ onImportToList, onDataChange }: TeamScraperPanelProps) {
  const [url, setUrl] = useState('')
  const [organizationName, setOrganizationName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<ScrapeResult | null>(null)
  const [selectedMembers, setSelectedMembers] = useState<Set<number>>(new Set())

  // Notify parent of data changes
  useEffect(() => {
    onDataChange?.(result, selectedMembers)
  }, [result, selectedMembers, onDataChange])

  const handleScrape = useCallback(async () => {
    if (!url.trim()) {
      toast.error('Please enter a URL')
      return
    }

    setIsLoading(true)
    setResult(null)
    setSelectedMembers(new Set())

    try {
      const data = await scrapeTeamPage(url.trim(), organizationName.trim() || undefined)
      
      if (data.success) {
        setResult(data)
        // Select all members by default
        const allSelected = new Set(data.teamMembers.map((_, i) => i))
        setSelectedMembers(allSelected)
        
        if (data.teamMembers.length > 0) {
          // Auto-import to primary list
          if (onImportToList) {
            onImportToList(
              data.teamMembers,
              data.organizationName,
              data.organizationUrl,
              'primary'
            )
            toast.success(`Found and imported ${data.teamMembers.length} team members to Primary list`)
          } else {
            toast.success(`Found ${data.teamMembers.length} team members`)
          }
        } else if (data.error) {
          toast.warning(data.error)
        } else {
          toast.warning('No team members found on this page')
        }
      } else {
        toast.error(data.error || 'Failed to scrape page')
        setResult(data)
      }
    } catch (error) {
      console.error('Scrape error:', error)
      toast.error('Failed to scrape page')
    } finally {
      setIsLoading(false)
    }
  }, [url, organizationName, onImportToList])

  const toggleMember = useCallback((index: number) => {
    setSelectedMembers(prev => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }, [])

  const selectAll = useCallback(() => {
    if (result?.teamMembers) {
      setSelectedMembers(new Set(result.teamMembers.map((_, i) => i)))
    }
  }, [result])

  const deselectAll = useCallback(() => {
    setSelectedMembers(new Set())
  }, [])

  const exportToExcel = useCallback(() => {
    if (!result?.teamMembers || selectedMembers.size === 0) return

    const exportData = result.teamMembers
      .filter((_, i) => selectedMembers.has(i))
      .map(member => ({
        'Organization Name': result.organizationName,
        'Organization URL': result.organizationUrl,
        'First Name': member.firstName,
        'Last Name': member.lastName,
        'Full Name': member.fullName,
        'Email': member.email,
        'Phone': member.phone,
        'Mobile Phone': member.mobilePhone,
        'Title': member.title,
        'LinkedIn URL': member.linkedinUrl,
        'Image URL': member.imageUrl,
        'Bio': member.bio
      }))

    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Team Members')
    
    // Set column widths
    const colWidths = Object.keys(exportData[0] || {}).map(key => ({
      wch: Math.max(key.length, 20)
    }))
    ws['!cols'] = colWidths

    const filename = `${result.organizationName || 'team'}_members_${new Date().toISOString().split('T')[0]}.xlsx`
    XLSX.writeFile(wb, filename)
    
    toast.success(`Exported ${exportData.length} contacts`)
  }, [result, selectedMembers])

  const exportToCSV = useCallback(() => {
    if (!result?.teamMembers || selectedMembers.size === 0) return

    const exportData = result.teamMembers
      .filter((_, i) => selectedMembers.has(i))
      .map(member => ({
        'Organization Name': result.organizationName,
        'Organization URL': result.organizationUrl,
        'First Name': member.firstName,
        'Last Name': member.lastName,
        'Full Name': member.fullName,
        'Email': member.email,
        'Phone': member.phone,
        'Mobile Phone': member.mobilePhone,
        'Title': member.title,
        'LinkedIn URL': member.linkedinUrl,
        'Image URL': member.imageUrl,
        'Bio': member.bio
      }))

    const headers = Object.keys(exportData[0] || {})
    const csvContent = [
      headers.join(','),
      ...exportData.map(row => 
        headers.map(h => {
          const value = String(row[h as keyof typeof row] || '')
          if (value.includes(',') || value.includes('\n') || value.includes('"')) {
            return `"${value.replace(/"/g, '""')}"`
          }
          return value
        }).join(',')
      )
    ].join('\n')

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const urlObj = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = urlObj
    link.download = `${result.organizationName || 'team'}_members_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(urlObj)

    toast.success(`Exported ${exportData.length} contacts`)
  }, [result, selectedMembers])

  const handleImportToList = useCallback((role: ListRole) => {
    if (!result?.teamMembers || selectedMembers.size === 0 || !onImportToList) return

    const membersToImport = result.teamMembers.filter((_, i) => selectedMembers.has(i))
    
    onImportToList(
      membersToImport,
      result.organizationName,
      result.organizationUrl,
      role
    )

    toast.success(`Imported ${membersToImport.length} contacts to ${role} list`)
  }, [result, selectedMembers, onImportToList])

  return (
    <div className="space-y-6">
      {/* Input Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Team Page Scraper
          </CardTitle>
          <CardDescription>
            Enter a company team/about page URL to extract contact information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="team-url">Team Page URL</Label>
            <Input
              id="team-url"
              type="url"
              placeholder="https://company.com/team or /about or /meista"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleScrape()}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="org-name">Organization Name (optional)</Label>
            <Input
              id="org-name"
              placeholder="Company Name - will be auto-detected if not provided"
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
            />
          </div>

          <Button 
            onClick={handleScrape} 
            disabled={isLoading || !url.trim()}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Scraping...
              </>
            ) : (
              <>
                <Users className="mr-2 h-4 w-4" />
                Scrape Team Page
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Results Section */}
      {result && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  {result.organizationName || 'Scraped Results'}
                </CardTitle>
                {result.organizationUrl && (
                  <CardDescription className="flex items-center gap-1 mt-1">
                    <a 
                      href={result.organizationUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1"
                    >
                      {result.organizationUrl}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </CardDescription>
                )}
              </div>
              <Badge variant={result.teamMembers.length > 0 ? 'default' : 'secondary'}>
                {result.teamMembers.length} members found
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {result.teamMembers.length > 0 ? (
              <>
                {/* Selection Controls */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={selectAll}>
                      Select All
                    </Button>
                    <Button variant="outline" size="sm" onClick={deselectAll}>
                      Deselect All
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {selectedMembers.size} selected
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={exportToCSV}
                      disabled={selectedMembers.size === 0}
                    >
                      <Download className="mr-1 h-3 w-3" />
                      CSV
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={exportToExcel}
                      disabled={selectedMembers.size === 0}
                    >
                      <Download className="mr-1 h-3 w-3" />
                      Excel
                    </Button>
                  </div>
                </div>

                {/* Import to List Controls */}
                {onImportToList && (
                  <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
                    <Import className="h-4 w-4 text-primary flex-shrink-0" />
                    <span className="text-sm font-medium flex-1">Import to enrichment list:</span>
                    <Button 
                      size="sm" 
                      variant="default"
                      onClick={() => handleImportToList('primary')}
                      disabled={selectedMembers.size === 0}
                    >
                      Primary
                      <ArrowRight className="ml-1 h-3 w-3" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleImportToList('secondary')}
                      disabled={selectedMembers.size === 0}
                    >
                      Secondary
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleImportToList('tertiary')}
                      disabled={selectedMembers.size === 0}
                    >
                      Tertiary
                    </Button>
                  </div>
                )}

                {/* Team Members List */}
                <ScrollArea className="h-[400px] rounded-md border">
                  <div className="p-4 space-y-3">
                    {result.teamMembers.map((member, index) => (
                      <div 
                        key={index}
                        className={`p-4 rounded-lg border transition-colors ${
                          selectedMembers.has(index) 
                            ? 'bg-primary/5 border-primary/20' 
                            : 'bg-muted/30 border-border'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={selectedMembers.has(index)}
                            onCheckedChange={() => toggleMember(index)}
                            className="mt-1"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium">{member.fullName || `${member.firstName} ${member.lastName}`.trim()}</span>
                              {member.title && (
                                <Badge variant="secondary" className="text-xs">
                                  {member.title}
                                </Badge>
                              )}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                              {member.email && (
                                <span className="flex items-center gap-1">
                                  <Mail className="h-3 w-3" />
                                  {member.email}
                                </span>
                              )}
                              {(member.phone || member.mobilePhone) && (
                                <span className="flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {member.mobilePhone || member.phone}
                                </span>
                              )}
                              {member.linkedinUrl && (
                                <a 
                                  href={member.linkedinUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-primary hover:underline"
                                >
                                  <Linkedin className="h-3 w-3" />
                                  LinkedIn
                                </a>
                              )}
                            </div>
                            {member.bio && (
                              <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                                {member.bio}
                              </p>
                            )}
                          </div>
                          {member.email || member.linkedinUrl ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No team members could be extracted from this page.</p>
                {result.error && (
                  <p className="text-sm mt-2 text-amber-600">{result.error}</p>
                )}
                <p className="text-sm mt-2">
                  Try a different URL or check if the page has team member information.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}