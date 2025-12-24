-- Atualizar RLS policies para lis_closure_items e cash_envelopes
-- Permitir inserção/atualização sem depender de closure_id

-- 1. Dropar policies antigas de lis_closure_items que dependem de closure_id
DROP POLICY IF EXISTS "Users can insert lis_closure_items" ON public.lis_closure_items;
DROP POLICY IF EXISTS "Users can update lis_closure_items" ON public.lis_closure_items;
DROP POLICY IF EXISTS "Users can view lis_closure_items" ON public.lis_closure_items;

-- 2. Criar novas policies baseadas em unit_id
CREATE POLICY "Users can insert lis_closure_items by unit" 
ON public.lis_closure_items 
FOR INSERT 
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND (
    has_role(auth.uid(), 'admin'::app_role) 
    OR get_user_unit(auth.uid()) IS NULL 
    OR unit_id = get_user_unit(auth.uid())
  )
);

CREATE POLICY "Users can update lis_closure_items by unit" 
ON public.lis_closure_items 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR get_user_unit(auth.uid()) IS NULL 
  OR unit_id = get_user_unit(auth.uid())
);

CREATE POLICY "Users can view lis_closure_items by unit" 
ON public.lis_closure_items 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'contabilidade'::app_role)
  OR has_role(auth.uid(), 'financeiro'::app_role)
  OR get_user_unit(auth.uid()) IS NULL 
  OR unit_id = get_user_unit(auth.uid())
);

-- 3. Dropar policies antigas de cash_envelopes que dependem de closure_id
DROP POLICY IF EXISTS "Users can insert cash_envelopes" ON public.cash_envelopes;
DROP POLICY IF EXISTS "Users can update cash_envelopes" ON public.cash_envelopes;
DROP POLICY IF EXISTS "Users can view cash_envelopes" ON public.cash_envelopes;

-- 4. Criar novas policies para cash_envelopes baseadas em unit_id
CREATE POLICY "Users can insert cash_envelopes by unit" 
ON public.cash_envelopes 
FOR INSERT 
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND (
    has_role(auth.uid(), 'admin'::app_role) 
    OR get_user_unit(auth.uid()) IS NULL 
    OR unit_id = get_user_unit(auth.uid())
  )
);

CREATE POLICY "Users can update cash_envelopes by unit" 
ON public.cash_envelopes 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR get_user_unit(auth.uid()) IS NULL 
  OR unit_id = get_user_unit(auth.uid())
);

CREATE POLICY "Users can view cash_envelopes by unit" 
ON public.cash_envelopes 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'contabilidade'::app_role)
  OR has_role(auth.uid(), 'financeiro'::app_role)
  OR get_user_unit(auth.uid()) IS NULL 
  OR unit_id = get_user_unit(auth.uid())
);