-- Add file_url column to imports table for storing original bank statement files
ALTER TABLE public.imports ADD COLUMN IF NOT EXISTS file_url TEXT;