-- Add user_id column to mixmatch_master_contacts
ALTER TABLE public.mixmatch_master_contacts 
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index for user_id lookups
CREATE INDEX idx_mixmatch_master_contacts_user_id ON public.mixmatch_master_contacts (user_id);

-- Drop the old permissive policy
DROP POLICY IF EXISTS "Allow all operations on mixmatch_master_contacts" ON public.mixmatch_master_contacts;

-- Create new RLS policies for authenticated users only
CREATE POLICY "Users can view their own contacts"
ON public.mixmatch_master_contacts
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own contacts"
ON public.mixmatch_master_contacts
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own contacts"
ON public.mixmatch_master_contacts
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own contacts"
ON public.mixmatch_master_contacts
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);