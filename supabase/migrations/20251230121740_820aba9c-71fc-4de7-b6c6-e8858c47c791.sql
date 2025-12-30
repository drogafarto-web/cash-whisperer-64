-- Normalizar codigo_barras existentes (remover caracteres não numéricos)
UPDATE payables 
SET codigo_barras = regexp_replace(codigo_barras, '[^0-9]', '', 'g')
WHERE codigo_barras IS NOT NULL 
  AND codigo_barras ~ '[^0-9]';

-- Normalizar linha_digitavel existentes (remover caracteres não numéricos)
UPDATE payables 
SET linha_digitavel = regexp_replace(linha_digitavel, '[^0-9]', '', 'g')
WHERE linha_digitavel IS NOT NULL 
  AND linha_digitavel ~ '[^0-9]';