-- ============================================
-- TABELA 1: accounting_competence_data
-- Dados informados pela contabilidade para cada unidade/competência
-- ============================================
CREATE TABLE public.accounting_competence_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID REFERENCES public.units(id) ON DELETE CASCADE,
  ano INTEGER NOT NULL CHECK (ano >= 2026),
  mes INTEGER NOT NULL CHECK (mes >= 1 AND mes <= 12),
  
  -- Folha
  total_folha NUMERIC(12,2) DEFAULT 0,
  encargos NUMERIC(12,2) DEFAULT 0,
  prolabore NUMERIC(12,2) DEFAULT 0,
  num_funcionarios INTEGER DEFAULT 0,
  
  -- Impostos
  das_valor NUMERIC(12,2) DEFAULT 0,
  das_vencimento DATE,
  darf_valor NUMERIC(12,2) DEFAULT 0,
  darf_vencimento DATE,
  gps_valor NUMERIC(12,2) DEFAULT 0,
  gps_vencimento DATE,
  inss_valor NUMERIC(12,2) DEFAULT 0,
  inss_vencimento DATE,
  fgts_valor NUMERIC(12,2) DEFAULT 0,
  fgts_vencimento DATE,
  iss_valor NUMERIC(12,2) DEFAULT 0,
  iss_vencimento DATE,
  
  -- Receitas (visão contabilidade)
  receita_servicos NUMERIC(12,2) DEFAULT 0,
  receita_outras NUMERIC(12,2) DEFAULT 0,
  receita_observacoes TEXT,
  
  -- Metadata
  informado_por UUID,
  informado_em TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'informado', 'confirmado')),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  UNIQUE(unit_id, ano, mes)
);

-- RLS para accounting_competence_data
ALTER TABLE public.accounting_competence_data ENABLE ROW LEVEL SECURITY;

-- Admin, contador, contabilidade e financeiro podem ver todos
CREATE POLICY "privileged_read_competence_data" ON public.accounting_competence_data
  FOR SELECT USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'contador'::app_role) OR 
    has_role(auth.uid(), 'contabilidade'::app_role) OR 
    has_role(auth.uid(), 'financeiro'::app_role) OR
    unit_id = get_user_unit(auth.uid())
  );

-- Admin e contabilidade podem inserir/atualizar
CREATE POLICY "privileged_manage_competence_data" ON public.accounting_competence_data
  FOR ALL USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'contabilidade'::app_role)
  );

-- Trigger para updated_at
CREATE TRIGGER update_accounting_competence_data_updated_at
  BEFORE UPDATE ON public.accounting_competence_data
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- TABELA 2: accounting_lab_submissions
-- Envios do Lab para a contabilidade
-- ============================================
CREATE TABLE public.accounting_lab_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID REFERENCES public.units(id) ON DELETE CASCADE,
  ano INTEGER NOT NULL CHECK (ano >= 2026),
  mes INTEGER NOT NULL CHECK (mes >= 1 AND mes <= 12),
  
  -- Status geral
  status TEXT DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'enviado', 'recebido')),
  enviado_em TIMESTAMP WITH TIME ZONE,
  enviado_por UUID,
  recebido_em TIMESTAMP WITH TIME ZONE,
  recebido_por UUID,
  
  -- Resumo de receitas (visão lab)
  receita_servicos_lab NUMERIC(12,2) DEFAULT 0,
  receita_outras_lab NUMERIC(12,2) DEFAULT 0,
  observacoes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  UNIQUE(unit_id, ano, mes)
);

-- RLS para accounting_lab_submissions
ALTER TABLE public.accounting_lab_submissions ENABLE ROW LEVEL SECURITY;

-- Usuários podem ver submissions da sua unidade ou privilegiados veem todos
CREATE POLICY "read_lab_submissions" ON public.accounting_lab_submissions
  FOR SELECT USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'contador'::app_role) OR 
    has_role(auth.uid(), 'contabilidade'::app_role) OR 
    has_role(auth.uid(), 'financeiro'::app_role) OR
    unit_id = get_user_unit(auth.uid()) OR
    get_user_unit(auth.uid()) IS NULL
  );

-- Usuários podem inserir para sua unidade
CREATE POLICY "insert_lab_submissions" ON public.accounting_lab_submissions
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      unit_id = get_user_unit(auth.uid()) OR
      get_user_unit(auth.uid()) IS NULL
    )
  );

-- Usuários podem atualizar submissions da sua unidade
CREATE POLICY "update_lab_submissions" ON public.accounting_lab_submissions
  FOR UPDATE USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'contabilidade'::app_role) OR
    unit_id = get_user_unit(auth.uid()) OR
    get_user_unit(auth.uid()) IS NULL
  );

-- Trigger para updated_at
CREATE TRIGGER update_accounting_lab_submissions_updated_at
  BEFORE UPDATE ON public.accounting_lab_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- TABELA 3: accounting_lab_documents
-- Arquivos enviados pelo Lab
-- ============================================
CREATE TABLE public.accounting_lab_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID REFERENCES public.accounting_lab_submissions(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES public.units(id) ON DELETE CASCADE,
  ano INTEGER NOT NULL CHECK (ano >= 2026),
  mes INTEGER NOT NULL CHECK (mes >= 1 AND mes <= 12),
  
  -- Tipo do documento
  tipo TEXT NOT NULL CHECK (tipo IN ('nf', 'despesa', 'extrato_bancario', 'outro')),
  
  -- Arquivo
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  
  -- Campos específicos
  valor NUMERIC(12,2),
  descricao TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID
);

-- RLS para accounting_lab_documents
ALTER TABLE public.accounting_lab_documents ENABLE ROW LEVEL SECURITY;

-- Mesmas regras de leitura
CREATE POLICY "read_lab_documents" ON public.accounting_lab_documents
  FOR SELECT USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'contador'::app_role) OR 
    has_role(auth.uid(), 'contabilidade'::app_role) OR 
    has_role(auth.uid(), 'financeiro'::app_role) OR
    unit_id = get_user_unit(auth.uid()) OR
    get_user_unit(auth.uid()) IS NULL
  );

-- Usuários podem inserir documentos para sua unidade
CREATE POLICY "insert_lab_documents" ON public.accounting_lab_documents
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      unit_id = get_user_unit(auth.uid()) OR
      get_user_unit(auth.uid()) IS NULL
    )
  );

-- Usuários podem deletar documentos da sua unidade (apenas rascunhos)
CREATE POLICY "delete_lab_documents" ON public.accounting_lab_documents
  FOR DELETE USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    (
      (unit_id = get_user_unit(auth.uid()) OR get_user_unit(auth.uid()) IS NULL) AND
      EXISTS (
        SELECT 1 FROM public.accounting_lab_submissions s 
        WHERE s.id = submission_id AND s.status = 'rascunho'
      )
    )
  );