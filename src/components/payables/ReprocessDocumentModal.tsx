import { useState, useRef } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { 
  Upload, 
  FileText, 
  Calendar, 
  Banknote, 
  RefreshCw,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { TAX_DOCUMENT_LABELS, TaxDocumentType } from '@/types/payables';
import { createPayable } from '@/features/payables/api/payables.api';

interface TaxDocument {
  id: string;
  tipo: string;
  valor: number | null;
  descricao: string | null;
  created_at: string | null;
  file_name: string;
  file_path: string;
  ano: number;
  mes: number;
  unit_id: string | null;
  payable_id: string | null;
  payable_status: string | null;
}

interface ReprocessDocumentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: TaxDocument | null;
  onSuccess: () => void;
}

export function ReprocessDocumentModal({ 
  open, 
  onOpenChange, 
  document,
  onSuccess 
}: ReprocessDocumentModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [createPayableOnReprocess, setCreatePayableOnReprocess] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Arquivo muito grande (máx. 10MB)');
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Arquivo muito grande (máx. 10MB)');
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleReprocess = async () => {
    if (!document || !selectedFile) {
      toast.error('Selecione um arquivo para reprocessar');
      return;
    }

    setIsProcessing(true);

    try {
      // 1. Upload new file
      const timestamp = Date.now();
      const sanitizedName = selectedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `tax-documents/${document.unit_id}/${timestamp}_${sanitizedName}`;

      const { error: uploadError } = await supabase.storage
        .from('accounting-documents')
        .upload(filePath, selectedFile);

      if (uploadError) {
        throw new Error(`Erro no upload: ${uploadError.message}`);
      }

      // 2. Get public URL
      const { data: urlData } = supabase.storage
        .from('accounting-documents')
        .getPublicUrl(filePath);

      const publicUrl = urlData?.publicUrl;

      // 3. Update document with new file path
      const { error: updateDocError } = await supabase
        .from('accounting_lab_documents')
        .update({
          file_path: filePath,
          file_name: selectedFile.name,
          payable_status: createPayableOnReprocess ? 'pending' : 'skipped'
        })
        .eq('id', document.id);

      if (updateDocError) {
        throw new Error(`Erro ao atualizar documento: ${updateDocError.message}`);
      }

      // 4. Create payable if requested
      if (createPayableOnReprocess && document.valor && document.unit_id) {
        // Extract due date from description if available
        let dueDate: string | undefined;
        if (document.descricao) {
          const vencMatch = document.descricao.match(/Venc:\s*(\d{2}\/\d{2}\/\d{4})/);
          if (vencMatch) {
            const [day, month, year] = vencMatch[1].split('/');
            dueDate = `${year}-${month}-${day}`;
          }
        }

        const payableResult = await createPayable(
          {
            beneficiario: TAX_DOCUMENT_LABELS[document.tipo as TaxDocumentType] || document.tipo.toUpperCase(),
            valor: document.valor,
            vencimento: dueDate || new Date().toISOString().split('T')[0],
            description: `${TAX_DOCUMENT_LABELS[document.tipo as TaxDocumentType] || document.tipo.toUpperCase()} - ${document.mes}/${document.ano}`,
            tipo: 'boleto',
            unit_id: document.unit_id || undefined,
          },
          filePath,
          selectedFile.name
        );

        if (payableResult) {
          // Update document with payable reference
          await supabase
            .from('accounting_lab_documents')
            .update({
              payable_id: payableResult.id,
              payable_status: 'created'
            })
            .eq('id', document.id);

          toast.success('Documento reprocessado e conta a pagar criada!');
        } else {
          await supabase
            .from('accounting_lab_documents')
            .update({ payable_status: 'failed' })
            .eq('id', document.id);

          toast.warning('Documento atualizado, mas falha ao criar conta a pagar');
        }
      } else {
        toast.success('Documento reprocessado com sucesso!');
      }

      setSelectedFile(null);
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Error reprocessing document:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao reprocessar documento');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return '—';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  if (!document) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Reprocessar Documento
          </DialogTitle>
          <DialogDescription>
            Faça upload de um novo arquivo para este documento tributário
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Document Info */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Tipo</span>
              <Badge variant="outline">
                {TAX_DOCUMENT_LABELS[document.tipo as TaxDocumentType] || document.tipo}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Banknote className="h-3.5 w-3.5" /> Valor
              </span>
              <span className="font-mono font-medium">{formatCurrency(document.valor)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" /> Competência
              </span>
              <span>{document.mes}/{document.ano}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <FileText className="h-3.5 w-3.5" /> Arquivo Original
              </span>
              <span className="text-sm truncate max-w-[150px]">{document.file_name}</span>
            </div>
          </div>

          {/* Upload Zone */}
          <div
            className={`
              border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
              transition-colors
              ${selectedFile 
                ? 'border-primary bg-primary/5' 
                : 'border-muted-foreground/25 hover:border-primary/50'
              }
            `}
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={handleFileSelect}
              className="hidden"
            />
            
            {selectedFile ? (
              <div className="space-y-2">
                <FileText className="h-8 w-8 mx-auto text-primary" />
                <p className="text-sm font-medium">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </p>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFile(null);
                  }}
                >
                  Trocar arquivo
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Clique ou arraste o novo arquivo aqui
                </p>
                <p className="text-xs text-muted-foreground">
                  PDF, PNG ou JPG (máx. 10MB)
                </p>
              </div>
            )}
          </div>

          {/* Create Payable Option */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="createPayable"
              checked={createPayableOnReprocess}
              onCheckedChange={(checked) => setCreatePayableOnReprocess(!!checked)}
            />
            <Label htmlFor="createPayable" className="text-sm cursor-pointer">
              Criar conta a pagar automaticamente
            </Label>
          </div>

          {/* Warning if no value */}
          {!document.valor && createPayableOnReprocess && (
            <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 p-2 rounded">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>Documento sem valor definido. A conta a pagar não será criada.</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
            Cancelar
          </Button>
          <Button onClick={handleReprocess} disabled={isProcessing || !selectedFile}>
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Reprocessar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
