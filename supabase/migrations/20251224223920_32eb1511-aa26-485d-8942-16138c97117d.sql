-- Fase 1: Adicionar unit_id em lis_closure_items e tornar closure_id nullable

-- 1.1 Adicionar coluna unit_id
ALTER TABLE public.lis_closure_items 
ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES public.units(id);

-- 1.2 Popular unit_id com dados existentes via lis_closures
UPDATE public.lis_closure_items li
SET unit_id = lc.unit_id
FROM public.lis_closures lc
WHERE li.closure_id = lc.id
  AND li.unit_id IS NULL;

-- 1.3 Tornar closure_id nullable (remover NOT NULL constraint se existir)
ALTER TABLE public.lis_closure_items 
ALTER COLUMN closure_id DROP NOT NULL;

-- 1.4 Criar índice para performance nas queries por unit_id
CREATE INDEX IF NOT EXISTS idx_lis_closure_items_unit_envelope 
ON public.lis_closure_items(unit_id, envelope_id) 
WHERE envelope_id IS NULL;

-- 1.5 Criar índice para busca de itens disponíveis para envelope
CREATE INDEX IF NOT EXISTS idx_lis_closure_items_available_for_envelope
ON public.lis_closure_items(unit_id, cash_component, envelope_id)
WHERE cash_component > 0 AND envelope_id IS NULL;