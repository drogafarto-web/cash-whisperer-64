-- Criar tabela para logs de auditoria contábil
CREATE TABLE public.accounting_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID REFERENCES public.units(id),
  ano INTEGER NOT NULL,
  mes INTEGER NOT NULL,
  categoria TEXT NOT NULL,  -- 'folha' | 'das' | 'darf' | 'gps' | 'inss' | 'fgts' | 'iss' | 'receitas' | 'geral'
  status TEXT NOT NULL DEFAULT 'pendente',  -- 'revisado' | 'pendencia' | 'pendente'
  comentario TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.accounting_audit_logs ENABLE ROW LEVEL SECURITY;

-- Policies para admin, contador e contabilidade
CREATE POLICY "admin_manage_audit_logs"
  ON public.accounting_audit_logs
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "contador_manage_audit_logs"
  ON public.accounting_audit_logs
  FOR ALL
  USING (has_role(auth.uid(), 'contador'::app_role))
  WITH CHECK (has_role(auth.uid(), 'contador'::app_role));

CREATE POLICY "contabilidade_view_audit_logs"
  ON public.accounting_audit_logs
  FOR SELECT
  USING (has_role(auth.uid(), 'contabilidade'::app_role));

-- Índice para buscas por competência
CREATE INDEX idx_accounting_audit_logs_competence 
  ON public.accounting_audit_logs(unit_id, ano, mes);

-- Trigger para updated_at
CREATE TRIGGER update_accounting_audit_logs_updated_at
  BEFORE UPDATE ON public.accounting_audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();