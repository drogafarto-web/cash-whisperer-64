-- Corrigir RLS de transactions para isolamento por unidade
-- Usuários devem ver transações da sua unidade (não só as que criaram)

-- 1. DROP e recriar policy de SELECT
DROP POLICY IF EXISTS "Users can view transactions" ON public.transactions;

CREATE POLICY "Users can view transactions"
ON public.transactions FOR SELECT TO authenticated
USING (
  -- Admins, Contabilidade, Financeiro e Contadores podem ver tudo
  has_role(auth.uid(), 'admin') OR
  has_role(auth.uid(), 'contabilidade') OR
  has_role(auth.uid(), 'financeiro') OR
  has_role(auth.uid(), 'contador') OR
  -- Usuários sem unidade fixa podem ver tudo
  (get_user_unit(auth.uid()) IS NULL) OR
  -- Usuários com unidade fixa só veem transações da sua unidade
  (unit_id = get_user_unit(auth.uid()))
);

-- 2. Adicionar comentário explicativo
COMMENT ON POLICY "Users can view transactions" ON public.transactions IS 
'Isolamento por unidade: usuários operacionais só veem transações da sua unidade. Roles administrativas veem tudo.';