import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Download, FileSpreadsheet, Users, Building2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import type { EnrichedContact } from '@/hooks/useEnrichmentEngine'
import type { TeamMember, ScrapeResult } from '@/lib/api/teamScraper'

interface ExportableData {
  enrichedContacts?: EnrichedContact[]
  scrapedResults?: ScrapeResult | null
  selectedScrapedMembers?: Set<number>
  globalNotes?: string
}

interface UniversalDownloadButtonProps {
  data: ExportableData
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  className?: string
}

// Prepare enriched contacts for export
function prepareEnrichedExportData(enrichedContacts: EnrichedContact[], globalNotes: string = '') {
  return enrichedContacts.map(ec => {
    const orgUrl = ec.enrichedFields.websiteUrl || 
      ec.enrichedFields.urls?.find(u => u.label === 'website')?.url || ''
    
    const country = typeof ec.enrichedFields.address === 'object' && ec.enrichedFields.address 
      ? ec.enrichedFields.address.country || ''
      : ''
    
    let firstName = ec.enrichedFields.firstName || ''
    let lastName = ec.enrichedFields.lastName || ''
    
    if (!firstName && !lastName && ec.enrichedFields.fullName) {
      const nameParts = ec.enrichedFields.fullName.trim().split(/\s+/)
      if (nameParts.length === 1) {
        firstName = nameParts[0]
      } else if (nameParts.length >= 2) {
        firstName = nameParts[0]
        lastName = nameParts.slice(1).join(' ')
      }
    }
    
    return {
      'First Name': firstName,
      'Last Name': lastName,
      'Full Name': ec.enrichedFields.fullName || 
        [ec.enrichedFields.firstName, ec.enrichedFields.lastName].filter(Boolean).join(' '),
      'Email': ec.enrichedFields.email || '',
      'Organization': ec.enrichedFields.organization || ec.enrichedFields.company || '',
      'Organization URL': orgUrl,
      'Organization Type': ec.enrichedFields.organizationType || '',
      'Country': country,
      'Phone': ec.enrichedFields.phone || '',
      'Title': ec.enrichedFields.title || ec.enrichedFields.role || '',
      'LinkedIn': ec.enrichedFields.linkedinUrl || '',
      'Tags': ec.enrichedFields.tags?.join(', ') || '',
      'Notes': ec.enrichedFields.notes || '',
      'Internal Notes': globalNotes || '',
      'Enrichment Sources': ec.matchedSources.length,
      'Enrichment Source Names': ec.matchedSources.map(m => m.sourceFile.filename).join(', ')
    }
  })
}

// Prepare scraped contacts for export
function prepareScrapedExportData(result: ScrapeResult, selectedMembers: Set<number>) {
  return result.teamMembers
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
}

// Export data to CSV
function exportToCSV(data: Record<string, any>[], filename: string) {
  if (data.length === 0) return false

  const headers = Object.keys(data[0])
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(h => {
        const value = String(row[h] || '')
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
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`
  link.click()
  URL.revokeObjectURL(url)
  return true
}

// Export data to Excel
function exportToExcel(data: Record<string, any>[], filename: string, sheetName: string) {
  if (data.length === 0) return false

  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  
  const colWidths = Object.keys(data[0]).map(key => ({
    wch: Math.max(key.length, ...data.map(row => String(row[key] || '').length))
  }))
  ws['!cols'] = colWidths.map(w => ({ wch: Math.min(w.wch, 50) }))

  XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`)
  return true
}

export function UniversalDownloadButton({ 
  data, 
  variant = 'outline', 
  size = 'default',
  className 
}: UniversalDownloadButtonProps) {
  const { enrichedContacts = [], scrapedResults, selectedScrapedMembers, globalNotes = '' } = data

  const hasEnrichedContacts = enrichedContacts.length > 0
  const hasScrapedContacts = scrapedResults?.teamMembers && 
    selectedScrapedMembers && 
    selectedScrapedMembers.size > 0

  const totalContacts = enrichedContacts.length + 
    (hasScrapedContacts ? selectedScrapedMembers!.size : 0)

  const handleExportEnrichedCSV = () => {
    const exportData = prepareEnrichedExportData(enrichedContacts, globalNotes)
    if (exportToCSV(exportData, 'enriched_contacts')) {
      toast.success(`Exported ${exportData.length} enriched contacts to CSV`)
    } else {
      toast.error('No contacts to export')
    }
  }

  const handleExportEnrichedExcel = () => {
    const exportData = prepareEnrichedExportData(enrichedContacts, globalNotes)
    if (exportToExcel(exportData, 'enriched_contacts', 'Enriched Contacts')) {
      toast.success(`Exported ${exportData.length} enriched contacts to Excel`)
    } else {
      toast.error('No contacts to export')
    }
  }

  const handleExportScrapedCSV = () => {
    if (!scrapedResults || !selectedScrapedMembers) return
    const exportData = prepareScrapedExportData(scrapedResults, selectedScrapedMembers)
    if (exportToCSV(exportData, scrapedResults.organizationName || 'scraped_contacts')) {
      toast.success(`Exported ${exportData.length} scraped contacts to CSV`)
    } else {
      toast.error('No contacts to export')
    }
  }

  const handleExportScrapedExcel = () => {
    if (!scrapedResults || !selectedScrapedMembers) return
    const exportData = prepareScrapedExportData(scrapedResults, selectedScrapedMembers)
    if (exportToExcel(exportData, scrapedResults.organizationName || 'scraped_contacts', 'Team Members')) {
      toast.success(`Exported ${exportData.length} scraped contacts to Excel`)
    } else {
      toast.error('No contacts to export')
    }
  }

  const handleExportAllCSV = () => {
    // Merge both datasets with normalized columns
    const enrichedData = hasEnrichedContacts 
      ? prepareEnrichedExportData(enrichedContacts, globalNotes) 
      : []
    const scrapedData = hasScrapedContacts && scrapedResults && selectedScrapedMembers
      ? prepareScrapedExportData(scrapedResults, selectedScrapedMembers).map(item => ({
          'First Name': item['First Name'],
          'Last Name': item['Last Name'],
          'Full Name': item['Full Name'],
          'Email': item['Email'],
          'Organization': item['Organization Name'],
          'Organization URL': item['Organization URL'],
          'Organization Type': '',
          'Country': '',
          'Phone': item['Phone'] || item['Mobile Phone'],
          'Title': item['Title'],
          'LinkedIn': item['LinkedIn URL'],
          'Tags': '',
          'Notes': item['Bio'],
          'Internal Notes': '',
          'Enrichment Sources': 0,
          'Enrichment Source Names': 'Scraped'
        }))
      : []

    const allData = [...enrichedData, ...scrapedData]
    if (exportToCSV(allData, 'all_contacts')) {
      toast.success(`Exported ${allData.length} contacts to CSV`)
    } else {
      toast.error('No contacts to export')
    }
  }

  const handleExportAllExcel = () => {
    // Create Excel with separate sheets
    const wb = XLSX.utils.book_new()
    
    if (hasEnrichedContacts) {
      const enrichedData = prepareEnrichedExportData(enrichedContacts, globalNotes)
      const ws1 = XLSX.utils.json_to_sheet(enrichedData)
      const colWidths1 = Object.keys(enrichedData[0]).map(key => ({
        wch: Math.min(Math.max(key.length, 20), 50)
      }))
      ws1['!cols'] = colWidths1
      XLSX.utils.book_append_sheet(wb, ws1, 'Enriched Contacts')
    }
    
    if (hasScrapedContacts && scrapedResults && selectedScrapedMembers) {
      const scrapedData = prepareScrapedExportData(scrapedResults, selectedScrapedMembers)
      const ws2 = XLSX.utils.json_to_sheet(scrapedData)
      const colWidths2 = Object.keys(scrapedData[0]).map(key => ({
        wch: Math.min(Math.max(key.length, 20), 50)
      }))
      ws2['!cols'] = colWidths2
      XLSX.utils.book_append_sheet(wb, ws2, 'Scraped Team Members')
    }

    if (wb.SheetNames.length > 0) {
      XLSX.writeFile(wb, `all_contacts_${new Date().toISOString().split('T')[0]}.xlsx`)
      toast.success(`Exported contacts to Excel`)
    } else {
      toast.error('No contacts to export')
    }
  }

  if (totalContacts === 0) {
    return (
      <Button variant={variant} size={size} className={className} disabled>
        <Download className="h-4 w-4 mr-2" />
        Download
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} className={className}>
          <Download className="h-4 w-4 mr-2" />
          Download
          <Badge variant="secondary" className="ml-2 text-xs">
            {totalContacts}
          </Badge>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {/* All contacts */}
        {(hasEnrichedContacts || hasScrapedContacts) && (
          <>
            <DropdownMenuLabel className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              All Contacts ({totalContacts})
            </DropdownMenuLabel>
            <DropdownMenuItem onClick={handleExportAllCSV}>
              <Download className="h-4 w-4 mr-2" />
              Export All to CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportAllExcel}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Export All to Excel
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        {/* Enriched contacts */}
        {hasEnrichedContacts && (
          <>
            <DropdownMenuLabel className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Enriched ({enrichedContacts.length})
            </DropdownMenuLabel>
            <DropdownMenuItem onClick={handleExportEnrichedCSV}>
              <Download className="h-4 w-4 mr-2" />
              CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportEnrichedExcel}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Excel
            </DropdownMenuItem>
          </>
        )}

        {/* Scraped contacts */}
        {hasScrapedContacts && (
          <>
            {hasEnrichedContacts && <DropdownMenuSeparator />}
            <DropdownMenuLabel className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Scraped ({selectedScrapedMembers?.size || 0})
            </DropdownMenuLabel>
            <DropdownMenuItem onClick={handleExportScrapedCSV}>
              <Download className="h-4 w-4 mr-2" />
              CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportScrapedExcel}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Excel
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
