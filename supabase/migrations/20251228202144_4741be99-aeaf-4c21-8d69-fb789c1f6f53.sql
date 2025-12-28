-- Adicionar campo CPF na tabela profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS cpf VARCHAR(20) UNIQUE;

-- Adicionar campo telefone se não existir
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS telefone VARCHAR(20);

-- Adicionar campo data_nascimento se não existir
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS data_nascimento DATE;

-- Adicionar campo must_change_password para forçar troca de senha
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.profiles.cpf IS 'CPF ou CNPJ do usuário - chave única';
COMMENT ON COLUMN public.profiles.telefone IS 'Telefone/celular do usuário';
COMMENT ON COLUMN public.profiles.data_nascimento IS 'Data de nascimento do usuário';
COMMENT ON COLUMN public.profiles.must_change_password IS 'Se true, usuário deve trocar senha no próximo login';