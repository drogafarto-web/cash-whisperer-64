-- Remover transactions duplicadas do LIS, mantendo apenas a mais antiga de cada código por data
WITH duplicates AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY description, date, unit_id
      ORDER BY created_at ASC
    ) as rn
  FROM transactions
  WHERE description LIKE '[LIS %'
)
DELETE FROM transactions
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);