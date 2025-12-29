-- Add UPDATE policy for accounting_competence_documents
CREATE POLICY "update_competence_documents" 
ON public.accounting_competence_documents 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'contabilidade'::app_role) OR
  has_role(auth.uid(), 'contador'::app_role) OR
  has_role(auth.uid(), 'financeiro'::app_role) OR 
  (unit_id = get_user_unit(auth.uid())) OR 
  (get_user_unit(auth.uid()) IS NULL)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'contabilidade'::app_role) OR
  has_role(auth.uid(), 'contador'::app_role) OR
  has_role(auth.uid(), 'financeiro'::app_role) OR 
  (unit_id = get_user_unit(auth.uid())) OR 
  (get_user_unit(auth.uid()) IS NULL)
);