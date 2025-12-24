-- Create storage bucket for payables (boletos, supplier invoices)
INSERT INTO storage.buckets (id, name, public)
VALUES ('payables', 'payables', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for payables bucket
-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload payables files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'payables');

-- Allow authenticated users to view payables files
CREATE POLICY "Authenticated users can view payables files"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'payables');

-- Allow authenticated users to update their uploaded files
CREATE POLICY "Authenticated users can update payables files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'payables');

-- Allow authenticated users to delete payables files
CREATE POLICY "Authenticated users can delete payables files"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'payables');