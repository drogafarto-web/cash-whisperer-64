-- Adicionar coluna pix_tipo à tabela payables
ALTER TABLE payables 
ADD COLUMN pix_tipo text;

-- Comentário explicativo
COMMENT ON COLUMN payables.pix_tipo IS 'Tipo da chave PIX: cpf, cnpj, email, telefone, aleatoria';