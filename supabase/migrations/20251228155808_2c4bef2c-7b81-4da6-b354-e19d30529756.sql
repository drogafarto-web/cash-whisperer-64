-- Adicionar campo document_number para armazenar número do documento de origem
ALTER TABLE public.payables 
ADD COLUMN IF NOT EXISTS document_number TEXT;

-- Criar índice para busca por document_number
CREATE INDEX IF NOT EXISTS idx_payables_document_number ON public.payables(document_number);

-- Criar índice composto para verificação de duplicidade (CNPJ + document_number)
-- Não usamos UNIQUE constraint porque pode haver parcelas do mesmo documento
CREATE INDEX IF NOT EXISTS idx_payables_cnpj_doc_number 
ON public.payables(beneficiario_cnpj, document_number) 
WHERE document_number IS NOT NULL;

-- Verificar e adicionar política RLS para DELETE se não existir
DO $$
BEGIN
  -- Dropar política existente se houver
  DROP POLICY IF EXISTS "Users can delete payables" ON public.payables;
  
  -- Criar política que permite delete para usuários autenticados
  CREATE POLICY "Users can delete payables" 
  ON public.payables 
  FOR DELETE 
  USING (auth.uid() IS NOT NULL);
END $$;