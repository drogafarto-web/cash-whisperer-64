-- Add column to track when NF is in the same document as boleto
ALTER TABLE public.payables 
ADD COLUMN IF NOT EXISTS nf_in_same_document BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.payables.nf_in_same_document 
IS 'Indica se a NF está no mesmo documento do boleto';