-- Tabela para armazenar documentos enviados pela contabilidade
CREATE TABLE public.accounting_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Vínculo com token/competência/contato
  token_id UUID REFERENCES public.accounting_tokens(id),
  contact_id UUID REFERENCES public.accounting_contacts(id),
  
  -- Competência
  ano INTEGER NOT NULL,
  mes INTEGER NOT NULL,
  
  -- Tipo do documento
  tipo_documento TEXT NOT NULL, -- 'das', 'darf', 'gps', 'inss', 'fgts', 'folha', 'nf_servico', 'outro'
  
  -- Arquivo
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  
  -- Dados extraídos via OCR
  ocr_data JSONB,
  ocr_status TEXT DEFAULT 'pendente', -- 'pendente', 'processado', 'erro', 'manual'
  
  -- Valores confirmados
  valor_documento NUMERIC(14,2),
  data_vencimento DATE,
  data_pagamento DATE,
  
  -- Status do documento
  status TEXT DEFAULT 'enviado', -- 'enviado', 'conferido', 'vinculado', 'pago'
  
  -- Vinculação com tabelas de dados
  vinculado_a TEXT, -- 'seed_taxes', 'seed_payroll', 'seed_revenue'
  vinculado_id UUID,
  
  -- Observações
  observacoes TEXT,
  
  -- Auditoria
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  updated_by UUID
);

-- Índices para performance
CREATE INDEX idx_accounting_documents_competencia ON public.accounting_documents(ano, mes);
CREATE INDEX idx_accounting_documents_token ON public.accounting_documents(token_id);
CREATE INDEX idx_accounting_documents_status ON public.accounting_documents(status);

-- Enable RLS
ALTER TABLE public.accounting_documents ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança
-- Admin e contabilidade podem ver todos os documentos
CREATE POLICY "Admin e contabilidade podem ver documentos"
ON public.accounting_documents
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'contabilidade'::app_role) OR
  has_role(auth.uid(), 'contador'::app_role) OR
  has_role(auth.uid(), 'financeiro'::app_role)
);

-- Qualquer pessoa pode inserir (via link público)
CREATE POLICY "Público pode inserir documentos"
ON public.accounting_documents
FOR INSERT
WITH CHECK (true);

-- Admin pode atualizar documentos
CREATE POLICY "Admin pode atualizar documentos"
ON public.accounting_documents
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'contabilidade'::app_role));

-- Admin pode deletar documentos
CREATE POLICY "Admin pode deletar documentos"
ON public.accounting_documents
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger para updated_at
CREATE TRIGGER update_accounting_documents_updated_at
BEFORE UPDATE ON public.accounting_documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Criar bucket de storage para documentos da contabilidade
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'accounting-documents', 
  'accounting-documents', 
  false,
  10485760, -- 10MB
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage
-- Qualquer pessoa pode fazer upload (via link público sem auth)
CREATE POLICY "Público pode fazer upload de documentos contábeis"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'accounting-documents');

-- Usuários autenticados podem visualizar
CREATE POLICY "Autenticados podem ver documentos contábeis"
ON storage.objects
FOR SELECT
USING (bucket_id = 'accounting-documents' AND auth.uid() IS NOT NULL);

-- Admin pode deletar
CREATE POLICY "Admin pode deletar documentos contábeis"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'accounting-documents' AND 
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);