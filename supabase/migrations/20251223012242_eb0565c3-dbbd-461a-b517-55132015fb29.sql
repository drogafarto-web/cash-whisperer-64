-- =====================================================
-- Sistema de Faturamento por NFS-e (Convênios/Prefeituras)
-- =====================================================

-- 1. Tabela de Pagadores (Convênios/Prefeituras)
CREATE TABLE public.payers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  cnpj text UNIQUE,
  type text NOT NULL DEFAULT 'convenio', -- 'prefeitura', 'convenio', 'empresa'
  email text,
  phone text,
  city text,
  state text,
  address text,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Tabela de Notas Fiscais de Serviço
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificação da nota
  document_number text NOT NULL,
  document_full_number text,
  verification_code text,
  
  -- Datas e competência
  issue_date date NOT NULL,
  competence_year integer NOT NULL,
  competence_month integer NOT NULL,
  
  -- Valores
  service_value numeric NOT NULL,
  deductions numeric DEFAULT 0,
  iss_value numeric DEFAULT 0,
  net_value numeric NOT NULL,
  
  -- Emissor (laboratório)
  issuer_name text,
  issuer_cnpj text,
  
  -- Tomador (convênio/prefeitura)
  payer_id uuid REFERENCES public.payers(id),
  customer_name text NOT NULL,
  customer_cnpj text,
  customer_city text,
  
  -- Detalhes
  description text,
  service_code text,
  cnae text,
  
  -- Vínculo com unidade
  unit_id uuid REFERENCES public.units(id),
  
  -- Arquivo
  file_path text,
  file_name text,
  
  -- Status e workflow
  status text NOT NULL DEFAULT 'ABERTA',
  received_at date,
  notes text,
  
  -- Auditoria
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Índices para consultas frequentes
CREATE INDEX idx_invoices_competence ON public.invoices(competence_year, competence_month);
CREATE INDEX idx_invoices_payer ON public.invoices(payer_id);
CREATE INDEX idx_invoices_status ON public.invoices(status);
CREATE INDEX idx_invoices_unit ON public.invoices(unit_id);
CREATE INDEX idx_payers_cnpj ON public.payers(cnpj);
CREATE INDEX idx_payers_type ON public.payers(type);

-- 4. RLS para payers
ALTER TABLE public.payers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_payers" ON public.payers
FOR SELECT TO authenticated USING (true);

CREATE POLICY "admin_insert_payers" ON public.payers
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_update_payers" ON public.payers
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_delete_payers" ON public.payers
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 5. RLS para invoices
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_invoices" ON public.invoices
FOR SELECT TO authenticated USING (true);

CREATE POLICY "admin_contabilidade_insert_invoices" ON public.invoices
FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'contabilidade')
);

CREATE POLICY "admin_contabilidade_update_invoices" ON public.invoices
FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'contabilidade')
);

CREATE POLICY "admin_delete_invoices" ON public.invoices
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 6. Trigger para updated_at
CREATE TRIGGER update_payers_updated_at
  BEFORE UPDATE ON public.payers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();