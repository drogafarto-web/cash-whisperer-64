import { useState, useCallback } from 'react';
import { Upload, FileText, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { useInvoiceOcr } from '@/hooks/useBilling';
import { Invoice } from '@/types/billing';

interface InvoiceUploadFormProps {
  onComplete: (invoice: Partial<Invoice>) => void;
  onCancel: () => void;
}

export default function InvoiceUploadForm({ onComplete, onCancel }: InvoiceUploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [progress, setProgress] = useState(0);
  
  const ocrMutation = useInvoiceOcr();

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && droppedFile.type === 'application/pdf') {
      setFile(droppedFile);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleProcess = async () => {
    if (!file) return;

    setProgress(20);
    
    try {
      const ocrResult = await ocrMutation.mutateAsync(file);
      setProgress(80);

      // Prepare invoice data from OCR result
      const invoiceData: Partial<Invoice> = {
        document_number: ocrResult.document_number || '',
        document_full_number: ocrResult.document_full_number,
        verification_code: ocrResult.verification_code,
        issue_date: ocrResult.issue_date || new Date().toISOString().split('T')[0],
        competence_year: ocrResult.competence_year || new Date().getFullYear(),
        competence_month: ocrResult.competence_month || (new Date().getMonth() + 1),
        service_value: ocrResult.service_value || 0,
        deductions: ocrResult.deductions || 0,
        iss_value: ocrResult.iss_value || 0,
        net_value: ocrResult.net_value || ocrResult.service_value || 0,
        issuer_name: ocrResult.issuer_name,
        issuer_cnpj: ocrResult.issuer_cnpj,
        customer_name: ocrResult.customer_name || '',
        customer_cnpj: ocrResult.customer_cnpj,
        customer_city: ocrResult.customer_city,
        description: ocrResult.description,
        service_code: ocrResult.service_code,
        cnae: ocrResult.cnae,
        file_name: file.name,
        status: 'ABERTA',
      };

      setProgress(100);
      onComplete(invoiceData);
    } catch (error) {
      console.error('OCR processing error:', error);
      // Even if OCR fails, allow manual entry
      onComplete({
        file_name: file.name,
        issue_date: new Date().toISOString().split('T')[0],
        competence_year: new Date().getFullYear(),
        competence_month: new Date().getMonth() + 1,
        service_value: 0,
        net_value: 0,
        customer_name: '',
        status: 'ABERTA',
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        className={`
          border-2 border-dashed rounded-lg p-8 text-center transition-colors
          ${dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
          ${file ? 'bg-muted/50' : ''}
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        {file ? (
          <div className="flex items-center justify-center gap-3">
            <FileText className="h-8 w-8 text-primary" />
            <div className="text-left">
              <p className="font-medium">{file.name}</p>
              <p className="text-sm text-muted-foreground">
                {(file.size / 1024).toFixed(1)} KB
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">
              Arraste um arquivo PDF aqui ou clique para selecionar
            </p>
            <input
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              className="hidden"
              id="pdf-upload"
            />
            <Button variant="outline" asChild>
              <label htmlFor="pdf-upload" className="cursor-pointer">
                Selecionar PDF
              </label>
            </Button>
          </div>
        )}
      </div>

      {/* Processing Progress */}
      {ocrMutation.isPending && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Processando PDF com IA...
          </div>
          <Progress value={progress} />
        </div>
      )}

      {/* Error Alert */}
      {ocrMutation.isError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Erro no processamento</AlertTitle>
          <AlertDescription>
            Não foi possível extrair os dados automaticamente. 
            Você pode preencher os campos manualmente.
          </AlertDescription>
        </Alert>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button 
          onClick={handleProcess} 
          disabled={!file || ocrMutation.isPending}
        >
          {ocrMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processando...
            </>
          ) : (
            'Processar PDF'
          )}
        </Button>
      </div>
    </div>
  );
}
