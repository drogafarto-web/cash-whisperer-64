import { useState, useCallback } from 'react';
import { Upload, FileText, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { sanitizeFileName } from '@/lib/sanitizeFileName';
import { TaxDocumentOcrResult } from '@/types/payables';

interface TaxDocumentUploadProps {
  unitId?: string;
  onOcrComplete: (result: TaxDocumentOcrResult, file: File, filePath: string) => void;
  onError?: (error: string) => void;
}

export function TaxDocumentUpload({ unitId, onOcrComplete, onError }: TaxDocumentUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const processFile = useCallback(async (file: File) => {
    if (!file.type.includes('pdf') && !file.type.includes('image')) {
      toast.error('Formato não suportado. Use PDF ou imagem.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo 10MB.');
      return;
    }

    setSelectedFile(file);
    setIsProcessing(true);

    try {
      // Upload to storage first
      const safeFileName = sanitizeFileName(file.name);
      const timestamp = Date.now();
      const folder = unitId || 'sem-unidade';
      const filePath = `tax-documents/${folder}/${timestamp}_${safeFileName}`;

      const { error: uploadError } = await supabase.storage
        .from('payables')
        .upload(filePath, file);

      if (uploadError) {
        throw new Error(`Erro no upload: ${uploadError.message}`);
      }

      // Convert file to base64 for OCR
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          // Remove data URL prefix
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
      });

      // If PDF, we need to send as-is since the edge function handles it
      // For images, convert directly
      if (file.type.includes('pdf')) {
        // For PDF, read as data URL
        reader.readAsDataURL(file);
      } else {
        reader.readAsDataURL(file);
      }

      const base64 = await base64Promise;

      // Call OCR edge function
      const { data: ocrResponse, error: ocrError } = await supabase.functions.invoke('ocr-tax-document', {
        body: {
          image_base64: base64,
          file_name: file.name,
        },
      });

      if (ocrError) {
        throw new Error(`Erro no OCR: ${ocrError.message}`);
      }

      if (!ocrResponse?.success || !ocrResponse?.data) {
        throw new Error(ocrResponse?.error || 'Erro ao processar documento');
      }

      const ocrResult: TaxDocumentOcrResult = ocrResponse.data;
      
      toast.success('Documento analisado com sucesso!');
      onOcrComplete(ocrResult, file, filePath);

    } catch (error) {
      console.error('Error processing tax document:', error);
      const message = error instanceof Error ? error.message : 'Erro ao processar documento';
      toast.error(message);
      onError?.(message);
    } finally {
      setIsProcessing(false);
    }
  }, [unitId, onOcrComplete, onError]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      processFile(file);
    }
  }, [processFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
    e.target.value = '';
  }, [processFile]);

  return (
    <Card 
      className={`border-2 border-dashed transition-colors ${
        isDragging 
          ? 'border-primary bg-primary/5' 
          : 'border-muted-foreground/25 hover:border-primary/50'
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <CardContent className="flex flex-col items-center justify-center py-10 gap-4">
        {isProcessing ? (
          <>
            <Loader2 className="h-12 w-12 text-primary animate-spin" />
            <div className="text-center">
              <p className="text-lg font-medium">Analisando documento...</p>
              <p className="text-sm text-muted-foreground">
                {selectedFile?.name}
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="p-4 rounded-full bg-primary/10">
              <Upload className="h-8 w-8 text-primary" />
            </div>
            <div className="text-center">
              <p className="text-lg font-medium">
                Arraste ou clique para enviar
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                DARF, GPS, FGTS, DAS, INSS (PDF ou imagem)
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => document.getElementById('tax-doc-input')?.click()}
            >
              <FileText className="mr-2 h-4 w-4" />
              Selecionar Arquivo
            </Button>
            <input
              id="tax-doc-input"
              type="file"
              className="hidden"
              accept=".pdf,image/*"
              onChange={handleFileSelect}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
