import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Paperclip, 
  Upload, 
  X, 
  FileText, 
  Loader2,
  CheckCircle2,
  FileSpreadsheet,
  ExternalLink,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';
import { sanitizeFileName } from '@/lib/sanitizeFileName';
import { analyzeAccountingDocument, isTaxDocument as checkIsTaxDoc } from '@/services/accountingOcrService';

export type DocumentCategory = 'folha' | 'das' | 'darf' | 'gps' | 'inss' | 'fgts' | 'iss' | 'receitas';

const TAX_CATEGORIES: DocumentCategory[] = ['das', 'darf', 'gps', 'inss', 'fgts', 'iss'];

interface ExistingFile {
  id: string;
  file_name: string;
  file_path: string;
  mime_type?: string | null;
  ocr_status?: string | null;
  ocr_data?: Record<string, unknown> | null;
}

interface OcrResult {
  valor: number | null;
  vencimento: string | null;
}

interface AccountingFileUploadProps {
  unitId: string;
  ano: number;
  mes: number;
  categoria: DocumentCategory;
  label: string;
  existingFile?: ExistingFile | null;
  onUploadComplete?: () => void;
  onDeleteComplete?: () => void;
  onOcrComplete?: (result: OcrResult) => void;
}

export function AccountingFileUpload({ 
  unitId, 
  ano, 
  mes, 
  categoria, 
  label,
  existingFile,
  onUploadComplete,
  onDeleteComplete,
  onOcrComplete,
}: AccountingFileUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isProcessingOcr, setIsProcessingOcr] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const isTaxCategory = TAX_CATEGORIES.includes(categoria);

  // State for signed URL (private bucket)
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loadingUrl, setLoadingUrl] = useState(false);

  // Generate signed URL for preview (bucket is private)
  useEffect(() => {
    if (!existingFile?.file_path) {
      setSignedUrl(null);
      return;
    }

    const generateSignedUrl = async () => {
      setLoadingUrl(true);
      try {
        const { data, error } = await supabase.storage
          .from('accounting-documents')
          .createSignedUrl(existingFile.file_path, 60 * 10); // 10 minutes

        if (error) {
          console.error('Error generating signed URL:', error);
          setSignedUrl(null);
        } else {
          setSignedUrl(data.signedUrl);
        }
      } catch (err) {
        console.error('Error generating signed URL:', err);
        setSignedUrl(null);
      } finally {
        setLoadingUrl(false);
      }
    };

    generateSignedUrl();
  }, [existingFile?.file_path]);

  const processOcr = async (filePath: string, documentId: string, file: File) => {
    setIsProcessingOcr(true);
    try {
      // Use unified accounting OCR service (handles PDF→image conversion)
      const result = await analyzeAccountingDocument(file, unitId);

      // Update document with OCR results
      const ocrStatus = result.confidence > 0.5 ? 'processado' : 'erro';
      const ocrData = {
        valor: result.totalValue,
        vencimento: result.dueDate,
        tipo_documento: result.documentType,
        confidence: result.confidence,
      };

      await supabase
        .from('accounting_competence_documents')
        .update({ 
          ocr_status: ocrStatus,
          ocr_data: ocrData,
        })
        .eq('id', documentId);

      // If OCR was successful and we have values, call the callback
      const valor = result.totalValue;
      const vencimento = result.dueDate;
      
      if (valor !== null || vencimento !== null) {
        onOcrComplete?.({ valor, vencimento });
        toast.success(`${categoria.toUpperCase()} lido automaticamente via IA`);
      } else {
        toast.info('IA processou, mas não foi possível extrair valores. Preencha manualmente.');
      }

      queryClient.invalidateQueries({ queryKey: ['competence-documents', unitId, ano, mes] });
    } catch (error: any) {
      console.error('OCR processing error:', error);
      // Update document with error status
      await supabase
        .from('accounting_competence_documents')
        .update({ ocr_status: 'erro' })
        .eq('id', documentId);
      
      toast.warning('Não foi possível ler automaticamente, preencha manualmente.');
    } finally {
      setIsProcessingOcr(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Tipo de arquivo não permitido. Use PDF, imagem ou planilha.');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo 10MB.');
      return;
    }

    setIsUploading(true);

    try {
      // Sanitize filename to avoid S3 errors with special characters (º, ª, ç, etc.)
      const safeFileName = sanitizeFileName(file.name);
      const filePath = `contabilidade/${unitId}/${ano}/${mes}/${categoria}/${Date.now()}_${safeFileName}`;
      const { error: uploadError } = await supabase.storage
        .from('accounting-documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Insert metadata
      const { data: insertedDoc, error: insertError } = await supabase
        .from('accounting_competence_documents')
        .insert({
          unit_id: unitId,
          ano,
          mes,
          categoria,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          mime_type: file.type,
          created_by: user?.id,
          ocr_status: isTaxCategory ? 'pendente' : null,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      toast.success('Arquivo enviado com sucesso');
      queryClient.invalidateQueries({ queryKey: ['competence-documents', unitId, ano, mes] });
      onUploadComplete?.();

      // Process OCR for tax documents (PDF/images only)
      if (isTaxCategory && insertedDoc && (file.type === 'application/pdf' || file.type.startsWith('image/'))) {
        processOcr(filePath, insertedDoc.id, file);
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error('Erro ao enviar arquivo: ' + error.message);
    } finally {
      setIsUploading(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDelete = async () => {
    if (!existingFile) return;

    setIsDeleting(true);

    try {
      // Delete from storage
      await supabase.storage
        .from('accounting-documents')
        .remove([existingFile.file_path]);

      // Delete metadata
      const { error } = await supabase
        .from('accounting_competence_documents')
        .delete()
        .eq('id', existingFile.id);

      if (error) throw error;

      toast.success('Arquivo removido');
      queryClient.invalidateQueries({ queryKey: ['competence-documents', unitId, ano, mes] });
      onDeleteComplete?.();
    } catch (error: any) {
      console.error('Delete error:', error);
      toast.error('Erro ao remover arquivo: ' + error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  // Render preview based on mime type
  const renderPreview = () => {
    if (!existingFile) return null;

    // Loading state
    if (loadingUrl) {
      return (
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Carregando preview...
        </div>
      );
    }

    // No URL available
    if (!signedUrl) {
      return (
        <div className="mt-2 text-xs text-muted-foreground">
          Preview indisponível
        </div>
      );
    }

    const mimeType = existingFile.mime_type || '';

    if (mimeType.startsWith('image/')) {
      return (
        <div className="mt-2">
          <img 
            src={signedUrl} 
            alt={existingFile.file_name}
            className="max-h-32 rounded border border-border object-contain"
          />
        </div>
      );
    }

    if (mimeType === 'application/pdf') {
      return (
        <div className="mt-2">
          <iframe 
            src={signedUrl}
            title={existingFile.file_name}
            className="h-48 w-full rounded border border-border"
          />
        </div>
      );
    }

    // For other types (spreadsheets, etc.), show icon + link
    return (
      <a 
        href={signedUrl} 
        target="_blank" 
        rel="noopener noreferrer"
        className="mt-2 flex items-center gap-2 text-sm text-primary hover:underline"
      >
        <FileSpreadsheet className="h-4 w-4" />
        Abrir {existingFile.file_name}
        <ExternalLink className="h-3 w-3" />
      </a>
    );
  };

  // Render OCR status badge
  const renderOcrStatus = () => {
    if (!existingFile || !isTaxCategory) return null;

    const status = existingFile.ocr_status;
    
    if (status === 'processado') {
      const ocrData = existingFile.ocr_data;
      return (
        <Badge variant="default" className="gap-1 bg-green-600">
          <Sparkles className="h-3 w-3" />
          OCR ✓
          {ocrData?.valor && ` R$ ${Number(ocrData.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
        </Badge>
      );
    }

    if (status === 'erro') {
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertCircle className="h-3 w-3" />
          OCR falhou
        </Badge>
      );
    }

    if (status === 'pendente' || isProcessingOcr) {
      return (
        <Badge variant="secondary" className="gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Lendo...
        </Badge>
      );
    }

    return null;
  };

  return (
    <div className="mt-3 pt-3 border-t border-border/50">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
        <Paperclip className="h-3 w-3" />
        {label}
        {isTaxCategory && (
          <span className="text-xs text-muted-foreground/70">(OCR automático)</span>
        )}
      </div>

      {existingFile ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
            <FileText className="h-4 w-4 text-primary" />
            <span className="text-sm flex-1 truncate">{existingFile.file_name}</span>
            <Badge variant="secondary" className="gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Anexado
            </Badge>
            {renderOcrStatus()}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={isDeleting}
              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
            >
              {isDeleting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <X className="h-3 w-3" />
              )}
            </Button>
          </div>
          {/* Preview inline */}
          {renderPreview()}
        </div>
      ) : (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp,.xls,.xlsx"
            onChange={handleFileSelect}
            className="hidden"
            id={`file-${categoria}`}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="gap-2 text-xs"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Upload className="h-3 w-3" />
                Selecionar arquivo
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
