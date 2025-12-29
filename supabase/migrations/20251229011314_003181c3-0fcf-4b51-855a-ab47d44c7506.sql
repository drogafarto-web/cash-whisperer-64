-- 1. Atualizar bucket para permitir XML
UPDATE storage.buckets 
SET allowed_mime_types = ARRAY[
  'application/pdf', 
  'image/jpeg', 
  'image/png', 
  'image/webp',
  'text/xml',
  'application/xml'
]
WHERE id = 'accounting-documents';

-- 2. Remover política conflitante para public
DROP POLICY IF EXISTS "Público pode fazer upload de documentos contábeis" ON storage.objects;

-- 3. Garantir políticas corretas para autenticados
DROP POLICY IF EXISTS "Users can upload accounting documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload accounting documents" ON storage.objects;

CREATE POLICY "Authenticated users can upload accounting documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'accounting-documents');

-- Garantir política de leitura para documentos próprios
DROP POLICY IF EXISTS "Users can view accounting documents" ON storage.objects;

CREATE POLICY "Users can view accounting documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'accounting-documents');