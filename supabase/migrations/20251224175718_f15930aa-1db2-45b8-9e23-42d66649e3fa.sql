-- Tabela de notas fiscais de fornecedores (entrada)
CREATE TABLE public.supplier_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_number TEXT NOT NULL,
  document_series TEXT,
  supplier_name TEXT NOT NULL,
  supplier_cnpj TEXT,
  issue_date DATE NOT NULL,
  due_date DATE,
  total_value DECIMAL(12,2) NOT NULL,
  payment_conditions TEXT,
  installments_count INT DEFAULT 1,
  description TEXT,
  file_path TEXT,
  file_name TEXT,
  unit_id UUID REFERENCES public.units(id),
  category_id UUID REFERENCES public.categories(id),
  status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'PARCIAL', 'PAGO', 'CANCELADO')),
  ocr_confidence INT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de boletos e títulos a pagar
CREATE TABLE public.payables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_invoice_id UUID REFERENCES public.supplier_invoices(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL DEFAULT 'boleto' CHECK (tipo IN ('boleto', 'parcela', 'avulso', 'recibo')),
  linha_digitavel TEXT,
  codigo_barras TEXT,
  banco_codigo TEXT,
  banco_nome TEXT,
  beneficiario TEXT,
  beneficiario_cnpj TEXT,
  valor DECIMAL(12,2) NOT NULL,
  vencimento DATE NOT NULL,
  parcela_numero INT DEFAULT 1,
  parcela_total INT DEFAULT 1,
  description TEXT,
  file_path TEXT,
  file_name TEXT,
  unit_id UUID REFERENCES public.units(id),
  category_id UUID REFERENCES public.categories(id),
  status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'PAGO', 'VENCIDO', 'CANCELADO')),
  paid_at TIMESTAMPTZ,
  paid_amount DECIMAL(12,2),
  paid_method TEXT,
  matched_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  matched_bank_item_id UUID,
  ocr_confidence INT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_supplier_invoices_unit_id ON public.supplier_invoices(unit_id);
CREATE INDEX idx_supplier_invoices_status ON public.supplier_invoices(status);
CREATE INDEX idx_supplier_invoices_issue_date ON public.supplier_invoices(issue_date);
CREATE INDEX idx_supplier_invoices_supplier_cnpj ON public.supplier_invoices(supplier_cnpj);

CREATE INDEX idx_payables_unit_id ON public.payables(unit_id);
CREATE INDEX idx_payables_status ON public.payables(status);
CREATE INDEX idx_payables_vencimento ON public.payables(vencimento);
CREATE INDEX idx_payables_supplier_invoice_id ON public.payables(supplier_invoice_id);
CREATE INDEX idx_payables_linha_digitavel ON public.payables(linha_digitavel);
CREATE INDEX idx_payables_beneficiario_cnpj ON public.payables(beneficiario_cnpj);

-- Triggers para updated_at
CREATE TRIGGER update_supplier_invoices_updated_at
  BEFORE UPDATE ON public.supplier_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payables_updated_at
  BEFORE UPDATE ON public.payables
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.supplier_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payables ENABLE ROW LEVEL SECURITY;

-- RLS Policies para supplier_invoices
CREATE POLICY "Users can view supplier_invoices" 
  ON public.supplier_invoices FOR SELECT 
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert supplier_invoices" 
  ON public.supplier_invoices FOR INSERT 
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update supplier_invoices" 
  ON public.supplier_invoices FOR UPDATE 
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete supplier_invoices" 
  ON public.supplier_invoices FOR DELETE 
  USING (auth.uid() IS NOT NULL);

-- RLS Policies para payables
CREATE POLICY "Users can view payables" 
  ON public.payables FOR SELECT 
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert payables" 
  ON public.payables FOR INSERT 
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update payables" 
  ON public.payables FOR UPDATE 
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete payables" 
  ON public.payables FOR DELETE 
  USING (auth.uid() IS NOT NULL);