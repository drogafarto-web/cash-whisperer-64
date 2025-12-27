-- Create table for accounting competence documents
CREATE TABLE public.accounting_competence_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID REFERENCES public.units(id),
  ano INTEGER NOT NULL,
  mes INTEGER NOT NULL,
  categoria TEXT NOT NULL CHECK (categoria IN ('folha', 'das', 'darf', 'gps', 'inss', 'fgts', 'iss', 'receitas')),
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  descricao TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID
);

-- Create index for common queries
CREATE INDEX idx_accounting_competence_documents_lookup 
  ON public.accounting_competence_documents (unit_id, ano, mes);

-- Enable RLS
ALTER TABLE public.accounting_competence_documents ENABLE ROW LEVEL SECURITY;

-- Policy: admin, contabilidade, contador can read
CREATE POLICY "read_competence_documents" ON public.accounting_competence_documents
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'contabilidade'::app_role) OR 
    has_role(auth.uid(), 'contador'::app_role) OR
    has_role(auth.uid(), 'financeiro'::app_role)
  );

-- Policy: admin, contabilidade can insert
CREATE POLICY "insert_competence_documents" ON public.accounting_competence_documents
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND (
      has_role(auth.uid(), 'admin'::app_role) OR 
      has_role(auth.uid(), 'contabilidade'::app_role)
    )
  );

-- Policy: admin, contabilidade can delete
CREATE POLICY "delete_competence_documents" ON public.accounting_competence_documents
  FOR DELETE
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'contabilidade'::app_role)
  );