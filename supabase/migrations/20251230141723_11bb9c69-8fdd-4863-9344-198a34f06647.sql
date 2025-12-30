-- Remove o constraint antigo que bloqueia anos anteriores a 2026
ALTER TABLE public.accounting_lab_documents DROP CONSTRAINT IF EXISTS accounting_lab_documents_ano_check;

-- Adiciona novo constraint mais flexível (anos a partir de 2020)
ALTER TABLE public.accounting_lab_documents ADD CONSTRAINT accounting_lab_documents_ano_check CHECK ((ano >= 2020));

-- Adiciona comentário para clareza
COMMENT ON CONSTRAINT accounting_lab_documents_ano_check ON public.accounting_lab_documents IS 'Permite documentos com competência a partir de 2020';