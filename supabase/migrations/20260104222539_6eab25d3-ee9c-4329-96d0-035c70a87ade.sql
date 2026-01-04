-- Remover o constraint antigo
ALTER TABLE public.cash_envelopes 
DROP CONSTRAINT IF EXISTS cash_envelopes_status_check;

-- Criar novo constraint com 'CONFERIDO' incluído
ALTER TABLE public.cash_envelopes 
ADD CONSTRAINT cash_envelopes_status_check 
CHECK (status = ANY (ARRAY['PENDENTE', 'EMITIDO', 'CONFERIDO']));