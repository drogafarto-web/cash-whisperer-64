-- Tornar closure_id nullable em cash_envelopes para permitir envelopes sem closure
ALTER TABLE public.cash_envelopes 
ALTER COLUMN closure_id DROP NOT NULL;