import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { 
  Upload, 
  FileText, 
  Loader2, 
  CheckCircle, 
  AlertCircle,
  X,
  Receipt,
  Users,
  FileSpreadsheet,
} from 'lucide-react';

interface UploadedFile {
  id: string;
  file: File;
  status: 'uploading' | 'processing' | 'done' | 'error';
  error?: string;
  ocrData?: {
    tipo_documento: string;
    valor: number | null;
    vencimento: string | null;
    competencia: { ano: number; mes: number } | null;
    confidence: number;
  };
  savedId?: string;
}

interface AccountingUploadZoneProps {
  ano: number;
  mes: number;
  tokenId?: string;
  onUploadComplete?: () => void;
}

const TIPO_OPTIONS = [
  { value: 'das', label: 'DAS (Simples Nacional)', icon: Receipt },
  { value: 'darf', label: 'DARF', icon: Receipt },
  { value: 'gps', label: 'GPS (Previdência)', icon: Receipt },
  { value: 'inss', label: 'INSS', icon: Receipt },
  { value: 'fgts', label: 'FGTS', icon: Receipt },
  { value: 'folha', label: 'Folha de Pagamento', icon: Users },
  { value: 'nf_servico', label: 'NF de Serviços', icon: FileSpreadsheet },
  { value: 'outro', label: 'Outro', icon: FileText },
];

export function AccountingUploadZone({ 
  ano, 
  mes, 
  tokenId,
  onUploadComplete 
}: AccountingUploadZoneProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const processFile = async (file: File): Promise<UploadedFile> => {
    const fileId = crypto.randomUUID();
    const uploadedFile: UploadedFile = {
      id: fileId,
      file,
      status: 'uploading',
    };

    try {
      // 1. Upload to storage
      const filePath = `${ano}/${mes}/${fileId}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('accounting-documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      uploadedFile.status = 'processing';
      setFiles(prev => prev.map(f => f.id === fileId ? uploadedFile : f));

      // 2. Convert to base64 for OCR
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]); // Remove data:image/...;base64, prefix
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // 3. Call OCR edge function
      const { data: ocrResult, error: ocrError } = await supabase.functions.invoke('ocr-tax-document', {
        body: { image_base64: base64, file_name: file.name }
      });

      if (ocrError) {
        console.error('OCR error:', ocrError);
        // Continue without OCR data
      }

      const ocrData = ocrResult?.data || null;
      uploadedFile.ocrData = ocrData;

      // 4. Save document record
      const { data: docData, error: docError } = await supabase
        .from('accounting_documents')
        .insert({
          token_id: tokenId,
          ano,
          mes,
          tipo_documento: ocrData?.tipo_documento || 'outro',
          file_path: filePath,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type,
          ocr_data: ocrData,
          ocr_status: ocrData ? 'processado' : 'manual',
          valor_documento: ocrData?.valor || null,
          data_vencimento: ocrData?.vencimento || null,
          status: 'enviado',
        })
        .select()
        .single();

      if (docError) throw docError;

      uploadedFile.status = 'done';
      uploadedFile.savedId = docData.id;
      onUploadComplete?.();
      
    } catch (error: any) {
      console.error('Upload error:', error);
      uploadedFile.status = 'error';
      uploadedFile.error = error.message;
    }

    return uploadedFile;
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    await handleFiles(droppedFiles);
  }, [ano, mes, tokenId]);

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    await handleFiles(selectedFiles);
    e.target.value = ''; // Reset input
  };

  const handleFiles = async (newFiles: File[]) => {
    // Filter valid files
    const validFiles = newFiles.filter(f => 
      f.type === 'application/pdf' || 
      f.type.startsWith('image/')
    );

    if (validFiles.length < newFiles.length) {
      toast.warning('Alguns arquivos foram ignorados. Aceitos: PDF, JPG, PNG');
    }

    // Add files to state with uploading status
    const initialFiles: UploadedFile[] = validFiles.map(f => ({
      id: crypto.randomUUID(),
      file: f,
      status: 'uploading' as const,
    }));

    setFiles(prev => [...prev, ...initialFiles]);

    // Process each file
    for (const initialFile of initialFiles) {
      const result = await processFile(initialFile.file);
      setFiles(prev => prev.map(f => 
        f.id === initialFile.id ? { ...result, id: initialFile.id } : f
      ));
    }
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const updateFileType = async (id: string, newType: string) => {
    const file = files.find(f => f.id === id);
    if (!file?.savedId) return;

    try {
      await supabase
        .from('accounting_documents')
        .update({ tipo_documento: newType })
        .eq('id', file.savedId);

      setFiles(prev => prev.map(f => 
        f.id === id ? { ...f, ocrData: { ...f.ocrData!, tipo_documento: newType } } : f
      ));
      toast.success('Tipo atualizado');
    } catch (error) {
      toast.error('Erro ao atualizar tipo');
    }
  };

  const updateFileValue = async (id: string, value: number) => {
    const file = files.find(f => f.id === id);
    if (!file?.savedId) return;

    try {
      await supabase
        .from('accounting_documents')
        .update({ valor_documento: value })
        .eq('id', file.savedId);

      setFiles(prev => prev.map(f => 
        f.id === id ? { ...f, ocrData: { ...f.ocrData!, valor: value } } : f
      ));
    } catch (error) {
      toast.error('Erro ao atualizar valor');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5 text-primary" />
          Enviar Documentos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Drop zone */}
        <div
          className={`
            relative border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
            ${dragActive 
              ? 'border-primary bg-primary/5' 
              : 'border-muted-foreground/25 hover:border-primary/50'
            }
          `}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => document.getElementById('file-upload')?.click()}
        >
          <input
            id="file-upload"
            type="file"
            multiple
            accept=".pdf,image/*"
            className="hidden"
            onChange={handleFileInput}
          />
          <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm font-medium">
            Arraste arquivos aqui ou clique para selecionar
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            PDF, JPG, PNG • Guias de impostos, folha, NFs
          </p>
        </div>

        {/* Uploaded files */}
        {files.length > 0 && (
          <div className="space-y-3">
            {files.map((file) => (
              <div 
                key={file.id}
                className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border"
              >
                {/* Status icon */}
                <div className="pt-1">
                  {file.status === 'uploading' && (
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  )}
                  {file.status === 'processing' && (
                    <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
                  )}
                  {file.status === 'done' && (
                    <CheckCircle className="h-5 w-5 text-emerald-500" />
                  )}
                  {file.status === 'error' && (
                    <AlertCircle className="h-5 w-5 text-destructive" />
                  )}
                </div>

                {/* File info */}
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium truncate">{file.file.name}</p>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6"
                      onClick={() => removeFile(file.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  {file.status === 'uploading' && (
                    <p className="text-xs text-muted-foreground">Enviando...</p>
                  )}
                  {file.status === 'processing' && (
                    <p className="text-xs text-muted-foreground">Processando OCR...</p>
                  )}
                  {file.status === 'error' && (
                    <p className="text-xs text-destructive">{file.error}</p>
                  )}

                  {file.status === 'done' && file.ocrData && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Tipo</Label>
                        <Select 
                          value={file.ocrData.tipo_documento}
                          onValueChange={(v) => updateFileType(file.id, v)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TIPO_OPTIONS.map(opt => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Valor (R$)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          className="h-8 text-xs"
                          defaultValue={file.ocrData.valor || ''}
                          onBlur={(e) => updateFileValue(file.id, parseFloat(e.target.value) || 0)}
                        />
                      </div>
                    </div>
                  )}

                  {file.ocrData?.confidence !== undefined && (
                    <Badge 
                      variant={file.ocrData.confidence > 0.7 ? 'secondary' : 'outline'}
                      className="text-xs"
                    >
                      OCR: {Math.round(file.ocrData.confidence * 100)}%
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
