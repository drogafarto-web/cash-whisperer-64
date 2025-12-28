-- Alterar o tipo da coluna ocr_confidence de integer para numeric(4,3)
ALTER TABLE public.payables 
ALTER COLUMN ocr_confidence TYPE numeric(4,3) 
USING (CASE WHEN ocr_confidence IS NOT NULL THEN ocr_confidence::numeric / 100 ELSE NULL END);