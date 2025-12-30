-- Add payable tracking columns to accounting_lab_documents
ALTER TABLE public.accounting_lab_documents 
ADD COLUMN IF NOT EXISTS payable_id UUID REFERENCES public.payables(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS payable_status TEXT DEFAULT 'pending';

-- Add comment for documentation
COMMENT ON COLUMN public.accounting_lab_documents.payable_id IS 'Reference to the payable created from this tax document';
COMMENT ON COLUMN public.accounting_lab_documents.payable_status IS 'Status of payable creation: pending, created, failed, skipped';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_accounting_lab_documents_payable_status 
ON public.accounting_lab_documents(payable_status);

CREATE INDEX IF NOT EXISTS idx_accounting_lab_documents_payable_id 
ON public.accounting_lab_documents(payable_id);