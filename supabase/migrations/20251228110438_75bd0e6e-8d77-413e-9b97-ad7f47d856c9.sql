-- Etapa 5.2: Corrigir RLS de accounting_competence_documents
-- Atualizar política de leitura para incluir filtro por unit_id para usuários de unidade
DROP POLICY IF EXISTS "read_competence_documents" ON public.accounting_competence_documents;

CREATE POLICY "read_competence_documents"
ON public.accounting_competence_documents
FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role) OR
  public.has_role(auth.uid(), 'contabilidade'::public.app_role) OR
  public.has_role(auth.uid(), 'contador'::public.app_role) OR
  public.has_role(auth.uid(), 'financeiro'::public.app_role) OR
  (unit_id = public.get_user_unit(auth.uid())) OR
  (public.get_user_unit(auth.uid()) IS NULL)
);