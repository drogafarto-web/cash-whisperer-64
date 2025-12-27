-- Criar bucket de storage para documentos contábeis
INSERT INTO storage.buckets (id, name, public)
VALUES ('accounting-documents', 'accounting-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Policy para upload de documentos (usuários autenticados)
CREATE POLICY "Users can upload accounting documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'accounting-documents');

-- Policy para leitura de documentos
CREATE POLICY "Users can read accounting documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'accounting-documents');

-- Policy para deleção de documentos
CREATE POLICY "Users can delete own accounting documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'accounting-documents');