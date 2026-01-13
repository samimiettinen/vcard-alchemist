-- Create the mixmatch_master_contacts table for storing merged contacts
CREATE TABLE public.mixmatch_master_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  structured_name JSONB NOT NULL DEFAULT '{"givenName": "", "familyName": ""}',
  kind TEXT NOT NULL DEFAULT 'individual' CHECK (kind IN ('individual', 'org')),
  primary_email TEXT,
  secondary_emails TEXT[] NOT NULL DEFAULT '{}',
  phones JSONB NOT NULL DEFAULT '[]',
  organization TEXT,
  title TEXT,
  urls JSONB NOT NULL DEFAULT '[]',
  addresses JSONB NOT NULL DEFAULT '[]',
  notes TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  source_links JSONB NOT NULL DEFAULT '[]',
  consiglieri_contact_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_mixmatch_master_contacts_email ON public.mixmatch_master_contacts (primary_email);
CREATE INDEX idx_mixmatch_master_contacts_name ON public.mixmatch_master_contacts (full_name);
CREATE INDEX idx_mixmatch_master_contacts_org ON public.mixmatch_master_contacts (organization);

-- Enable Row Level Security
ALTER TABLE public.mixmatch_master_contacts ENABLE ROW LEVEL SECURITY;

-- Create policy for public read/write access (adjust as needed for your auth setup)
-- For now, allowing all operations since no auth is implemented yet
CREATE POLICY "Allow all operations on mixmatch_master_contacts"
ON public.mixmatch_master_contacts
FOR ALL
USING (true)
WITH CHECK (true);

-- Create trigger for automatic updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_mixmatch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_mixmatch_master_contacts_updated_at
BEFORE UPDATE ON public.mixmatch_master_contacts
FOR EACH ROW
EXECUTE FUNCTION public.update_mixmatch_updated_at();