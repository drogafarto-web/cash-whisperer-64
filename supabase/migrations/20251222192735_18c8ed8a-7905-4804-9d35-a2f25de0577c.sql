-- Tabela de contatos da contabilidade
CREATE TABLE public.accounting_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  email text NOT NULL,
  telefone text,
  empresa text,
  ativo boolean DEFAULT true,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.accounting_contacts ENABLE ROW LEVEL SECURITY;

-- Policies para accounting_contacts
CREATE POLICY "Admin e contabilidade podem ver contatos" 
ON public.accounting_contacts FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'contabilidade'::app_role));

CREATE POLICY "Admin pode gerenciar contatos" 
ON public.accounting_contacts FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Tabela de tokens de acesso para contabilidade
CREATE TABLE public.accounting_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  tipo text NOT NULL DEFAULT 'mensal', -- 'mensal' ou 'historico'
  ano integer,
  mes integer,
  -- Para histórico: range completo
  ano_inicio integer,
  mes_inicio integer,
  ano_fim integer,
  mes_fim integer,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  contact_id uuid REFERENCES public.accounting_contacts(id),
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.accounting_tokens ENABLE ROW LEVEL SECURITY;

-- Policies para accounting_tokens
CREATE POLICY "Admin e contabilidade podem ver tokens" 
ON public.accounting_tokens FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'contabilidade'::app_role));

CREATE POLICY "Admin e contabilidade podem criar tokens" 
ON public.accounting_tokens FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'contabilidade'::app_role));

CREATE POLICY "Service role pode atualizar tokens" 
ON public.accounting_tokens FOR UPDATE 
USING (true);

-- Índices para performance
CREATE INDEX idx_accounting_tokens_token ON public.accounting_tokens(token);
CREATE INDEX idx_accounting_tokens_expires ON public.accounting_tokens(expires_at);

-- Tabela para log de emails enviados
CREATE TABLE public.accounting_email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id uuid REFERENCES public.accounting_tokens(id),
  contact_id uuid REFERENCES public.accounting_contacts(id),
  email_to text NOT NULL,
  subject text NOT NULL,
  sent_at timestamptz DEFAULT now(),
  status text DEFAULT 'sent',
  error_message text
);

-- Enable RLS
ALTER TABLE public.accounting_email_logs ENABLE ROW LEVEL SECURITY;

-- Policies para email logs
CREATE POLICY "Admin e contabilidade podem ver logs de email" 
ON public.accounting_email_logs FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'contabilidade'::app_role));

CREATE POLICY "Sistema pode inserir logs" 
ON public.accounting_email_logs FOR INSERT 
WITH CHECK (true);