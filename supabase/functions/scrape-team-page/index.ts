import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TeamMember {
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  mobilePhone: string;
  title: string;
  linkedinUrl: string;
  imageUrl: string;
  bio: string;
}

interface ScrapeResult {
  success: boolean;
  organizationName: string;
  organizationUrl: string;
  teamMembers: TeamMember[];
  rawMarkdown?: string;
  error?: string;
}

// Helper function to fetch with retry for transient connection issues
async function fetchWithRetry(
  url: string, 
  options: RequestInit, 
  maxRetries = 3, 
  delayMs = 1000
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Fetch attempt ${attempt}/${maxRetries} for ${url}`);
      const response = await fetch(url, options);
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.log(`Attempt ${attempt} failed: ${lastError.message}`);
      
      // Only retry on connection errors, not on other types of errors
      if (lastError.message.includes('Connection refused') || 
          lastError.message.includes('ECONNREFUSED') ||
          lastError.message.includes('tcp connect error')) {
        if (attempt < maxRetries) {
          console.log(`Waiting ${delayMs}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
          delayMs *= 2; // Exponential backoff
        }
      } else {
        // Don't retry for non-connection errors
        throw lastError;
      }
    }
  }
  
  throw lastError || new Error('All retry attempts failed');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, organizationName } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      console.error('FIRECRAWL_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl connector not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format URL
    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    console.log('Scraping team page URL:', formattedUrl);

    // Step 1: Scrape the page with Firecrawl (with retry logic)
    const scrapeResponse = await fetchWithRetry(
      'https://api.firecrawl.dev/v1/scrape',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: formattedUrl,
          formats: ['markdown', 'links'],
          onlyMainContent: true,
          waitFor: 2000,
        }),
      },
      3, // max retries
      1000 // initial delay
    );

    const scrapeData = await scrapeResponse.json();

    if (!scrapeResponse.ok || !scrapeData.success) {
      console.error('Firecrawl API error:', scrapeData);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: scrapeData.error || `Failed to scrape page: ${scrapeResponse.status}` 
        }),
        { status: scrapeResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const markdown = scrapeData.data?.markdown || scrapeData.markdown || '';
    const links = scrapeData.data?.links || scrapeData.links || [];
    const metadata = scrapeData.data?.metadata || scrapeData.metadata || {};

    console.log('Page scraped successfully, markdown length:', markdown.length);

    // Step 2: Use Lovable AI Gateway to extract team member data
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'AI Gateway not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const extractionPrompt = `You are a data extraction expert. Analyze the following website content from a team/about page and extract team member information.

Website URL: ${formattedUrl}
Organization Name (if provided): ${organizationName || 'Not provided - please extract from content'}

Available links on the page:
${links.slice(0, 50).join('\n')}

Page content:
${markdown.substring(0, 15000)}

Extract all team members you can find. For each person, provide:
- firstName: First name
- lastName: Last name (family name)
- fullName: Full name as shown
- email: Email address if available
- phone: Phone number if available
- mobilePhone: Mobile phone if separate from main phone
- title: Job title/role
- linkedinUrl: LinkedIn profile URL if available
- imageUrl: Profile image URL if available
- bio: Short bio or description if available

Also extract:
- organizationName: The company/organization name
- organizationUrl: The main website URL

Respond ONLY with valid JSON in this exact format:
{
  "organizationName": "Company Name",
  "organizationUrl": "https://example.com",
  "teamMembers": [
    {
      "firstName": "John",
      "lastName": "Doe",
      "fullName": "John Doe",
      "email": "john@example.com",
      "phone": "+358 40 123 4567",
      "mobilePhone": "",
      "title": "CEO",
      "linkedinUrl": "https://linkedin.com/in/johndoe",
      "imageUrl": "",
      "bio": "Founder and CEO with 20 years of experience"
    }
  ]
}

Important:
- Extract LinkedIn URLs from the links array - look for linkedin.com/in/ patterns
- If you find partial info, include what you can and leave other fields as empty strings
- Parse Finnish and international phone number formats
- For names, try to separate first and last names properly
- Be thorough - include ALL team members you can identify`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'user', content: extractionPrompt }
        ],
        max_tokens: 8000,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI Gateway error:', errorText);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to process with AI' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content || '';

    console.log('AI extraction complete');

    // Parse the JSON from AI response
    let extractedData: ScrapeResult;
    try {
      // Find JSON in the response (it might be wrapped in markdown code blocks)
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      extractedData = {
        success: true,
        organizationName: parsed.organizationName || organizationName || metadata.title || '',
        organizationUrl: parsed.organizationUrl || formattedUrl,
        teamMembers: parsed.teamMembers || [],
        rawMarkdown: markdown.substring(0, 5000) // Include some raw content for debugging
      };
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      console.log('Raw AI response:', aiContent.substring(0, 1000));
      
      // Return partial success with raw data
      extractedData = {
        success: true,
        organizationName: organizationName || metadata.title || '',
        organizationUrl: formattedUrl,
        teamMembers: [],
        rawMarkdown: markdown.substring(0, 5000),
        error: 'Could not extract structured data - raw content available'
      };
    }

    console.log(`Extracted ${extractedData.teamMembers.length} team members`);

    return new Response(
      JSON.stringify(extractedData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in scrape-team-page:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
