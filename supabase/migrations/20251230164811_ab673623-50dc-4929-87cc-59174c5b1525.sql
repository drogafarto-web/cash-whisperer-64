-- Atualizar payables existentes que estão sem category_id

-- Atualizar DAS
UPDATE payables
SET category_id = (SELECT id FROM categories WHERE name = 'DAS - Simples Nacional' LIMIT 1)
WHERE (beneficiario ILIKE '%DAS%' OR beneficiario ILIKE '%Simples Nacional%') 
  AND category_id IS NULL;

-- Atualizar FGTS
UPDATE payables
SET category_id = (SELECT id FROM categories WHERE name = 'FGTS' LIMIT 1)
WHERE beneficiario ILIKE '%FGTS%' 
  AND category_id IS NULL;

-- Atualizar DARF
UPDATE payables
SET category_id = (SELECT id FROM categories WHERE name = 'DARF - IRRF' LIMIT 1)
WHERE (beneficiario ILIKE '%DARF%' OR beneficiario ILIKE '%IRRF%')
  AND category_id IS NULL;

-- Atualizar GPS / INSS Patronal
UPDATE payables
SET category_id = (SELECT id FROM categories WHERE name = 'GPS - INSS Patronal' LIMIT 1)
WHERE (beneficiario ILIKE '%GPS%' OR beneficiario ILIKE '%INSS%')
  AND category_id IS NULL;

-- Atualizar ISS
UPDATE payables
SET category_id = (SELECT id FROM categories WHERE name = 'ISS' LIMIT 1)
WHERE beneficiario ILIKE '%ISS%'
  AND category_id IS NULL;