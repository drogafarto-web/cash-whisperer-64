-- Add file_bucket column to payables table
ALTER TABLE public.payables 
ADD COLUMN file_bucket text DEFAULT 'payables';

-- Update existing records that have file paths from accounting-documents bucket
UPDATE public.payables 
SET file_bucket = 'accounting-documents' 
WHERE file_path LIKE 'kiosk/%' OR file_path LIKE 'accounting/%';

-- Add comment for documentation
COMMENT ON COLUMN public.payables.file_bucket IS 'Storage bucket where the file is stored (payables or accounting-documents)';