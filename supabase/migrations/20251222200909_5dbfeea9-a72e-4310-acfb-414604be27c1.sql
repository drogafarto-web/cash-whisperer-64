-- Tabela de configurações do portal de contabilidade
CREATE TABLE public.accounting_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Período do histórico
  historico_inicio_mes integer NOT NULL DEFAULT 11,
  historico_inicio_ano integer NOT NULL DEFAULT 2024,
  historico_fim_mes integer NOT NULL DEFAULT 12,
  historico_fim_ano integer NOT NULL DEFAULT 2025,
  -- Lembrete mensal
  reminder_day integer NOT NULL DEFAULT 5 CHECK (reminder_day >= 1 AND reminder_day <= 28),
  reminder_hour integer NOT NULL DEFAULT 8 CHECK (reminder_hour >= 0 AND reminder_hour <= 23),
  -- Timestamps
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.accounting_settings ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "admin_read_accounting_settings"
ON public.accounting_settings
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_manage_accounting_settings"
ON public.accounting_settings
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger para updated_at
CREATE TRIGGER update_accounting_settings_updated_at
BEFORE UPDATE ON public.accounting_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir configuração padrão
INSERT INTO public.accounting_settings (
  historico_inicio_mes, historico_inicio_ano,
  historico_fim_mes, historico_fim_ano,
  reminder_day, reminder_hour
) VALUES (11, 2024, 12, 2025, 5, 8);

-- Adicionar coluna updated_at em accounting_contacts se não existir
ALTER TABLE public.accounting_contacts ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Trigger para updated_at em accounting_contacts
DROP TRIGGER IF EXISTS update_accounting_contacts_updated_at ON public.accounting_contacts;
CREATE TRIGGER update_accounting_contacts_updated_at
BEFORE UPDATE ON public.accounting_contacts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();