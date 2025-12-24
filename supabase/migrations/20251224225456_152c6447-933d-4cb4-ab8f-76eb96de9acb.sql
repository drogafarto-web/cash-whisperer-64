-- Remover a constraint de unicidade do closure_id que impede múltiplos envelopes
ALTER TABLE public.cash_envelopes DROP CONSTRAINT IF EXISTS cash_envelopes_closure_id_key;