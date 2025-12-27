import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Paperclip, 
  Upload, 
  X, 
  FileText, 
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';

export type DocumentCategory = 'folha' | 'das' | 'darf' | 'gps' | 'inss' | 'fgts' | 'iss' | 'receitas';

interface AccountingFileUploadProps {
  unitId: string;
  ano: number;
  mes: number;
  categoria: DocumentCategory;
  label: string;
  existingFile?: { id: string; file_name: string; file_path: string } | null;
  onUploadComplete?: () => void;
  onDeleteComplete?: () => void;
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
}: AccountingFileUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const queryClient = useQueryClient();

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
      // Upload to storage
      const filePath = `contabilidade/${unitId}/${ano}/${mes}/${categoria}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('accounting-documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Insert metadata
      const { error: insertError } = await supabase
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
        });

      if (insertError) throw insertError;

      toast.success('Arquivo enviado com sucesso');
      queryClient.invalidateQueries({ queryKey: ['competence-documents', unitId, ano, mes] });
      onUploadComplete?.();
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

  return (
    <div className="mt-3 pt-3 border-t border-border/50">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
        <Paperclip className="h-3 w-3" />
        {label}
      </div>

      {existingFile ? (
        <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
          <FileText className="h-4 w-4 text-primary" />
          <span className="text-sm flex-1 truncate">{existingFile.file_name}</span>
          <Badge variant="secondary" className="gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Anexado
          </Badge>
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
