import { useState, useCallback, useEffect, useRef } from 'react'
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
  ArrowRight,
  Upload,
  FileSpreadsheet
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
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Notify parent of data changes
  useEffect(() => {
    onDataChange?.(result, selectedMembers)
  }, [result, selectedMembers, onDataChange])

  // Handle CSV import for batch URLs
  const handleCSVImport = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0)
      
      // Extract URLs from CSV (first column or URL column)
      const urls: string[] = []
      const hasHeader = lines[0]?.toLowerCase().includes('url') || !lines[0]?.startsWith('http')
      const startIndex = hasHeader ? 1 : 0
      
      for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i]
        // Handle both comma-separated and single-column formats
        const parts = line.split(',').map(p => p.trim().replace(/^["']|["']$/g, ''))
        const urlPart = parts.find(p => p.startsWith('http')) || parts[0]
        if (urlPart && urlPart.startsWith('http')) {
          urls.push(urlPart)
        }
      }

      if (urls.length === 0) {
        toast.error('No valid URLs found in CSV')
        return
      }

      toast.info(`Found ${urls.length} URLs to scrape`)
      
      // Batch scrape all URLs
      setIsLoading(true)
      setBatchProgress({ current: 0, total: urls.length })
      
      let allMembers: TeamMember[] = []
      let successCount = 0
      
      for (let i = 0; i < urls.length; i++) {
        setBatchProgress({ current: i + 1, total: urls.length })
        
        try {
          const data = await scrapeTeamPage(urls[i])
          if (data.success && data.teamMembers.length > 0) {
            allMembers = [...allMembers, ...data.teamMembers]
            successCount++
          }
        } catch (err) {
          console.error(`Failed to scrape ${urls[i]}:`, err)
        }
      }
      
      setBatchProgress(null)
      
      if (allMembers.length > 0) {
        const combinedResult: ScrapeResult = {
          success: true,
          teamMembers: allMembers,
          organizationName: `Batch Import (${successCount} sites)`,
          organizationUrl: ''
        }
        setResult(combinedResult)
        setSelectedMembers(new Set(allMembers.map((_, i) => i)))
        
        if (onImportToList) {
          onImportToList(allMembers, combinedResult.organizationName, '', 'primary')
          toast.success(`Imported ${allMembers.length} contacts from ${successCount} sites`)
        } else {
          toast.success(`Found ${allMembers.length} contacts from ${successCount} sites`)
        }
      } else {
        toast.warning('No contacts found in any of the URLs')
      }
    } catch (err) {
      console.error('CSV import error:', err)
      toast.error('Failed to parse CSV file')
    } finally {
      setIsLoading(false)
      setBatchProgress(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }, [onImportToList])

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
    <div className="space-y-4">
      {/* Input Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="h-4 w-4" />
            Team Page Scraper
          </CardTitle>
          <CardDescription className="text-xs">
            Enter a URL or import CSV with multiple URLs
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="team-url" className="text-xs">Team Page URL</Label>
            <Input
              id="team-url"
              type="url"
              placeholder="https://company.com/team"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleScrape()}
              className="h-8 text-sm"
            />
          </div>
          
          <div className="space-y-1.5">
            <Label htmlFor="org-name" className="text-xs">Organization Name (optional)</Label>
            <Input
              id="org-name"
              placeholder="Auto-detected if not provided"
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={handleScrape} 
              disabled={isLoading || !url.trim()}
              className="flex-1 h-8 text-xs"
              size="sm"
            >
              {isLoading && !batchProgress ? (
                <>
                  <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                  Scraping...
                </>
              ) : (
                <>
                  <Users className="mr-1.5 h-3 w-3" />
                  Scrape
                </>
              )}
            </Button>
            
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleCSVImport}
              className="hidden"
            />
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
            >
              <FileSpreadsheet className="mr-1.5 h-3 w-3" />
              Import CSV
            </Button>
          </div>
          
          {batchProgress && (
            <div className="text-xs text-muted-foreground text-center py-1">
              <Loader2 className="inline h-3 w-3 animate-spin mr-1" />
              Scraping {batchProgress.current} of {batchProgress.total}...
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results Section */}
      {result && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Building2 className="h-4 w-4" />
                  {result.organizationName || 'Scraped Results'}
                </CardTitle>
                {result.organizationUrl && (
                  <CardDescription className="flex items-center gap-1 mt-0.5 text-xs">
                    <a 
                      href={result.organizationUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1"
                    >
                      {result.organizationUrl}
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </CardDescription>
                )}
              </div>
              <Badge variant={result.teamMembers.length > 0 ? 'default' : 'secondary'} className="text-xs">
                {result.teamMembers.length} found
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {result.teamMembers.length > 0 ? (
              <>
                {/* Selection Controls */}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-1.5">
                    <Button variant="outline" size="sm" onClick={selectAll} className="h-7 text-xs px-2">
                      All
                    </Button>
                    <Button variant="outline" size="sm" onClick={deselectAll} className="h-7 text-xs px-2">
                      None
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {selectedMembers.size} sel.
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={exportToCSV}
                      disabled={selectedMembers.size === 0}
                      className="h-7 text-xs px-2"
                    >
                      <Download className="mr-1 h-2.5 w-2.5" />
                      CSV
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={exportToExcel}
                      disabled={selectedMembers.size === 0}
                      className="h-7 text-xs px-2"
                    >
                      <Download className="mr-1 h-2.5 w-2.5" />
                      Excel
                    </Button>
                  </div>
                </div>

                {/* Import to List Controls */}
                {onImportToList && (
                  <div className="flex items-center gap-1.5 p-2 bg-primary/5 rounded-md border border-primary/20">
                    <Import className="h-3 w-3 text-primary flex-shrink-0" />
                    <span className="text-xs font-medium flex-1">Import to:</span>
                    <Button 
                      size="sm" 
                      variant="default"
                      onClick={() => handleImportToList('primary')}
                      disabled={selectedMembers.size === 0}
                      className="h-6 text-xs px-2"
                    >
                      Primary
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleImportToList('secondary')}
                      disabled={selectedMembers.size === 0}
                      className="h-6 text-xs px-2"
                    >
                      Secondary
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleImportToList('tertiary')}
                      disabled={selectedMembers.size === 0}
                      className="h-6 text-xs px-2"
                    >
                      Tertiary
                    </Button>
                  </div>
                )}

                {/* Team Members List */}
                <ScrollArea className="h-[300px] rounded-md border">
                  <div className="p-2 space-y-1.5">
                    {result.teamMembers.map((member, index) => (
                      <div 
                        key={index}
                        className={`p-2 rounded-md border transition-colors ${
                          selectedMembers.has(index) 
                            ? 'bg-primary/5 border-primary/20' 
                            : 'bg-muted/30 border-border'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <Checkbox
                            checked={selectedMembers.has(index)}
                            onCheckedChange={() => toggleMember(index)}
                            className="mt-0.5 h-3.5 w-3.5"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-medium">{member.fullName || `${member.firstName} ${member.lastName}`.trim()}</span>
                              {member.title && (
                                <Badge variant="secondary" className="text-[10px] px-1 py-0">
                                  {member.title}
                                </Badge>
                              )}
                            </div>
                            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                              {member.email && (
                                <span className="flex items-center gap-0.5">
                                  <Mail className="h-2.5 w-2.5" />
                                  {member.email}
                                </span>
                              )}
                              {(member.phone || member.mobilePhone) && (
                                <span className="flex items-center gap-0.5">
                                  <Phone className="h-2.5 w-2.5" />
                                  {member.mobilePhone || member.phone}
                                </span>
                              )}
                              {member.linkedinUrl && (
                                <a 
                                  href={member.linkedinUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-0.5 text-primary hover:underline"
                                >
                                  <Linkedin className="h-2.5 w-2.5" />
                                  LinkedIn
                                </a>
                              )}
                            </div>
                          </div>
                          {member.email || member.linkedinUrl ? (
                            <CheckCircle2 className="h-3 w-3 text-green-500 flex-shrink-0" />
                          ) : (
                            <AlertCircle className="h-3 w-3 text-amber-500 flex-shrink-0" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-xs">No team members found.</p>
                {result.error && (
                  <p className="text-[11px] mt-1 text-amber-600">{result.error}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}