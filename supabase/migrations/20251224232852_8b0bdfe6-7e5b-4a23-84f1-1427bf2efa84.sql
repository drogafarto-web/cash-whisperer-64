-- Adicionar coluna para contagem de reimpressões
ALTER TABLE public.cash_envelopes 
ADD COLUMN reprint_count INTEGER NOT NULL DEFAULT 0;