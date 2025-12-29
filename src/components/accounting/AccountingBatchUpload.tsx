import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { 
  Upload, 
  FileText, 
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Barcode,
  Copy,
  Clock,
  FolderUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';
import { sanitizeFileName } from '@/lib/sanitizeFileName';
import { analyzeAccountingDocument } from '@/services/accountingOcrService';
import { cn } from '@/lib/utils';

type DocumentCategory = 'folha' | 'das' | 'darf' | 'gps' | 'inss' | 'fgts' | 'iss' | 'receitas';

interface BatchFile {
  id: string;
  file: File;
  status: 'waiting' | 'uploading' | 'processing' | 'done' | 'error';
  progress: number;
  detectedType?: string;
  extractedValue?: number | null;
  extractedDueDate?: string | null;
  codigoBarras?: string | null;
  pixKey?: string | null;
  pixTipo?: string | null;
  error?: string;
}

interface AccountingBatchUploadProps {
  unitId: string;
  ano: number;
  mes: number;
  onComplete?: () => void;
}

const CATEGORY_MAP: Record<string, DocumentCategory> = {
  'das': 'das',
  'darf': 'darf',
  'gps': 'gps',
  'inss': 'inss',
  'fgts': 'fgts',
  'iss': 'iss',
  'nf_servico': 'receitas',
  'outro': 'das', // Default
};

export function AccountingBatchUpload({ 
  unitId, 
  ano, 
  mes,
  onComplete,
}: AccountingBatchUploadProps) {
  const [files, setFiles] = useState<BatchFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    const validFiles: BatchFile[] = [];

    Array.from(newFiles).forEach(file => {
      if (!allowedTypes.includes(file.type)) {
        toast.error(`${file.name}: tipo não suportado. Use PDF ou imagem.`);
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name}: arquivo muito grande (máx. 10MB)`);
        return;
      }
      validFiles.push({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file,
        status: 'waiting',
        progress: 0,
      });
    });

    if (validFiles.length > 0) {
      setFiles(prev => [...prev, ...validFiles]);
      toast.success(`${validFiles.length} arquivo(s) adicionado(s)`);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const processFile = async (batchFile: BatchFile): Promise<BatchFile> => {
    const file = batchFile.file;
    
    try {
      // Update status to uploading
      setFiles(prev => prev.map(f => 
        f.id === batchFile.id ? { ...f, status: 'uploading' as const, progress: 20 } : f
      ));

      // Upload file
      const safeFileName = sanitizeFileName(file.name);
      const filePath = `contabilidade/${unitId}/${ano}/${mes}/batch/${Date.now()}_${safeFileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('accounting-documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Update status to processing OCR
      setFiles(prev => prev.map(f => 
        f.id === batchFile.id ? { ...f, status: 'processing' as const, progress: 50 } : f
      ));

      // Process OCR
      const ocrResult = await analyzeAccountingDocument(file, unitId);
      
      // Determine category from document type
      const detectedType = ocrResult.documentType || 'outro';
      const categoria = CATEGORY_MAP[detectedType] || 'das';

      // Insert document metadata
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
          ocr_status: ocrResult.confidence > 0.5 ? 'processado' : 'erro',
          ocr_data: {
            valor: ocrResult.totalValue,
            vencimento: ocrResult.dueDate,
            tipo_documento: ocrResult.documentType,
            confidence: ocrResult.confidence,
            codigo_barras: ocrResult.codigoBarras || null,
            linha_digitavel: ocrResult.linhaDigitavel || null,
            pix_key: ocrResult.pixKey || null,
            pix_tipo: ocrResult.pixTipo || null,
          },
        });

      if (insertError) throw insertError;

      return {
        ...batchFile,
        status: 'done',
        progress: 100,
        detectedType: detectedType.toUpperCase(),
        extractedValue: ocrResult.totalValue,
        extractedDueDate: ocrResult.dueDate,
        codigoBarras: ocrResult.codigoBarras || null,
        pixKey: ocrResult.pixKey || null,
        pixTipo: ocrResult.pixTipo || null,
      };
    } catch (error: any) {
      console.error('Batch file error:', error);
      return {
        ...batchFile,
        status: 'error',
        progress: 0,
        error: error.message || 'Erro ao processar',
      };
    }
  };

  const processAllFiles = async () => {
    if (files.length === 0) return;

    setIsProcessing(true);
    const waitingFiles = files.filter(f => f.status === 'waiting');

    // Process 2 files at a time to avoid rate limits
    const concurrency = 2;
    const chunks: BatchFile[][] = [];
    for (let i = 0; i < waitingFiles.length; i += concurrency) {
      chunks.push(waitingFiles.slice(i, i + concurrency));
    }

    for (const chunk of chunks) {
      const results = await Promise.all(chunk.map(processFile));
      setFiles(prev => prev.map(f => {
        const result = results.find(r => r.id === f.id);
        return result || f;
      }));
    }

    await queryClient.invalidateQueries({ queryKey: ['competence-documents', unitId, ano, mes] });
    onComplete?.();
    setIsProcessing(false);

    const successCount = files.filter(f => f.status === 'done').length;
    if (successCount > 0) {
      toast.success(`${successCount} documento(s) processado(s) com sucesso!`);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado!');
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const clearCompleted = () => {
    setFiles(prev => prev.filter(f => f.status !== 'done'));
  };

  const waitingCount = files.filter(f => f.status === 'waiting').length;
  const doneCount = files.filter(f => f.status === 'done').length;
  const errorCount = files.filter(f => f.status === 'error').length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FolderUp className="h-5 w-5 text-primary" />
          Upload em Lote
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Drop Zone */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={cn(
            "border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer",
            isDragOver 
              ? "border-primary bg-primary/5" 
              : "border-border hover:border-primary/50 hover:bg-muted/50"
          )}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            multiple
            onChange={(e) => e.target.files && addFiles(e.target.files)}
            className="hidden"
          />
          <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm font-medium">
            Arraste múltiplos documentos aqui
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            ou clique para selecionar (PDF, JPG, PNG)
          </p>
        </div>

        {/* Files Table */}
        {files.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                {waitingCount > 0 && (
                  <Badge variant="secondary">{waitingCount} aguardando</Badge>
                )}
                {doneCount > 0 && (
                  <Badge variant="default" className="bg-green-600">{doneCount} concluído(s)</Badge>
                )}
                {errorCount > 0 && (
                  <Badge variant="destructive">{errorCount} erro(s)</Badge>
                )}
              </div>
              {doneCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearCompleted}>
                  Limpar concluídos
                </Button>
              )}
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Arquivo</TableHead>
                    <TableHead className="w-20">Tipo</TableHead>
                    <TableHead className="w-28">Valor</TableHead>
                    <TableHead className="w-28">Vencimento</TableHead>
                    <TableHead className="w-36">Cód. Barras/PIX</TableHead>
                    <TableHead className="w-24">Status</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {files.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="truncate max-w-[200px]">{f.file.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {f.detectedType ? (
                          <Badge variant="outline">{f.detectedType}</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {f.extractedValue != null ? (
                          <span className="font-medium text-green-600">
                            R$ {f.extractedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {f.extractedDueDate ? (
                          <span className="flex items-center gap-1 text-sm">
                            <Clock className="h-3 w-3" />
                            {new Date(f.extractedDueDate).toLocaleDateString('pt-BR')}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {f.codigoBarras ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs gap-1"
                            onClick={() => copyToClipboard(f.codigoBarras!)}
                          >
                            <Barcode className="h-3 w-3" />
                            Copiar
                          </Button>
                        ) : f.pixKey ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs gap-1"
                            onClick={() => copyToClipboard(f.pixKey!)}
                          >
                            <Copy className="h-3 w-3" />
                            PIX
                          </Button>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {f.status === 'waiting' && (
                          <Badge variant="secondary" className="gap-1">
                            <Clock className="h-3 w-3" />
                            Aguardando
                          </Badge>
                        )}
                        {f.status === 'uploading' && (
                          <Badge variant="secondary" className="gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Enviando
                          </Badge>
                        )}
                        {f.status === 'processing' && (
                          <Badge variant="secondary" className="gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            OCR
                          </Badge>
                        )}
                        {f.status === 'done' && (
                          <Badge variant="default" className="gap-1 bg-green-600">
                            <CheckCircle2 className="h-3 w-3" />
                            OK
                          </Badge>
                        )}
                        {f.status === 'error' && (
                          <Badge variant="destructive" className="gap-1">
                            <AlertCircle className="h-3 w-3" />
                            Erro
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {f.status === 'waiting' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => removeFile(f.id)}
                          >
                            <XCircle className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Progress Bar */}
            {isProcessing && (
              <Progress 
                value={(doneCount / files.length) * 100} 
                className="h-2"
              />
            )}

            {/* Action Button */}
            {waitingCount > 0 && (
              <Button 
                onClick={processAllFiles} 
                disabled={isProcessing}
                className="w-full gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Processar {waitingCount} documento(s)
                  </>
                )}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
