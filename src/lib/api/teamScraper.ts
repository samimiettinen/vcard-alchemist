import { supabase } from '@/integrations/supabase/client'

export interface TeamMember {
  firstName: string
  lastName: string
  fullName: string
  email: string
  phone: string
  mobilePhone: string
  title: string
  linkedinUrl: string
  imageUrl: string
  bio: string
}

export interface ScrapeResult {
  success: boolean
  organizationName: string
  organizationUrl: string
  teamMembers: TeamMember[]
  rawMarkdown?: string
  error?: string
}

export async function scrapeTeamPage(url: string, organizationName?: string): Promise<ScrapeResult> {
  const { data, error } = await supabase.functions.invoke('scrape-team-page', {
    body: { url, organizationName },
  })

  if (error) {
    return { 
      success: false, 
      error: error.message,
      organizationName: organizationName || '',
      organizationUrl: url,
      teamMembers: []
    }
  }

  return data as ScrapeResult
}
