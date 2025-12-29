import { useState, useCallback, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  ArrowLeft, 
  Upload, 
  Loader2,
  Sparkles,
  FileText,
  Check,
  X,
  AlertCircle,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { AccountingOcrResultCard } from '@/components/accounting/AccountingOcrResultCard';
import { PaymentDataModal } from '@/components/payables/PaymentDataModal';
import { DocumentConfirmationModal, PaymentMethodType } from './DocumentConfirmationModal';
import { 
  analyzeAccountingDocument, 
  createInvoiceFromOcr,
  createPayableFromOcr,
  checkDuplicateInvoice,
  checkDuplicatePayable,
  AnalyzedDocResult 
} from '@/services/accountingOcrService';
import { useNavigate } from 'react-router-dom';
import { sanitizeFileName } from '@/lib/sanitizeFileName';
import { cn } from '@/lib/utils';

interface ReceptionDocumentUploadProps {
  onBack: () => void;
  unitId: string | null;
}

interface OcrResult {
  docId: string;
  fileName: string;
  result: AnalyzedDocResult;
  recordCreated: boolean;
  recordType?: 'invoice' | 'payable';
  recordId?: string;
  isDuplicate?: boolean;
  duplicateId?: string;
}

type QueueStatus = 'queued' | 'uploading' | 'analyzing' | 'ready' | 'confirmed' | 'error';

interface QueuedDocument {
  id: string;
  file: File;
  filePath?: string;
  status: QueueStatus;
  result?: AnalyzedDocResult;
  error?: string;
}

const MAX_CONCURRENT = 2;

export function ReceptionDocumentUpload({ onBack, unitId }: ReceptionDocumentUploadProps) {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [documentQueue, setDocumentQueue] = useState<QueuedDocument[]>([]);
  const [ocrResults, setOcrResults] = useState<OcrResult[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  
  // Modal state for individual confirmation
  const [confirmingDoc, setConfirmingDoc] = useState<QueuedDocument | null>(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  
  // Payment data modal state
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedPayableId, setSelectedPayableId] = useState<string | null>(null);
  const [selectedPayableInfo, setSelectedPayableInfo] = useState<{ beneficiario?: string; valor?: number }>({});

  // Get current month/year for competence
  const now = new Date();
  const competenceYear = now.getFullYear();
  const competenceMonth = now.getMonth() + 1;

  // Process queue - run when queue changes (MUST be before conditional returns)
  useEffect(() => {
    if (!unitId) return; // Guard inside effect
    
    const processQueue = async () => {
      const processing = documentQueue.filter(d => d.status === 'uploading' || d.status === 'analyzing');
      const queued = documentQueue.filter(d => d.status === 'queued');
      
      // Start processing up to MAX_CONCURRENT
      const slotsAvailable = MAX_CONCURRENT - processing.length;
      const toProcess = queued.slice(0, slotsAvailable);
      
      for (const doc of toProcess) {
        processDocument(doc);
      }
    };
    
    processQueue();
  }, [documentQueue, unitId]);

  // Se não há unitId, mostrar mensagem de erro (AFTER all hooks)
  if (!unitId) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Button variant="ghost" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        
        <Card className="max-w-md w-full mx-auto">
          <CardContent className="pt-8 pb-8 text-center space-y-6">
            <div className="mx-auto w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-foreground">
                Nenhuma Unidade Selecionada
              </h2>
              <p className="text-muted-foreground">
                Você precisa estar vinculado a uma unidade para processar documentos.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const processDocument = async (doc: QueuedDocument) => {
    if (!unitId) return;
    
    // Update to uploading
    setDocumentQueue(prev => prev.map(d => 
      d.id === doc.id ? { ...d, status: 'uploading' as QueueStatus } : d
    ));

    try {
      // Upload file
      const safeFileName = sanitizeFileName(doc.file.name);
      const filePath = `reception/${unitId}/${competenceYear}/${competenceMonth}/${Date.now()}_${safeFileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('accounting-documents')
        .upload(filePath, doc.file);
      
      if (uploadError) throw uploadError;

      // Update to analyzing
      setDocumentQueue(prev => prev.map(d => 
        d.id === doc.id ? { ...d, status: 'analyzing' as QueueStatus, filePath } : d
      ));

      // Analyze with AI
      const result = await analyzeAccountingDocument(doc.file, unitId);

      // Update to ready
      setDocumentQueue(prev => prev.map(d => 
        d.id === doc.id ? { ...d, status: 'ready' as QueueStatus, result } : d
      ));

    } catch (error) {
      console.error('Error processing document:', error);
      
      // Determinar mensagem de erro mais amigável
      let errorMessage = 'Erro desconhecido ao processar documento';
      if (error instanceof Error) {
        if (error.message.includes('Rate limit') || error.message.includes('429')) {
          errorMessage = 'Limite de requisições atingido. Tente novamente em alguns segundos.';
        } else if (error.message.includes('timeout') || error.message.includes('Timeout')) {
          errorMessage = 'Tempo esgotado. O documento pode ser muito grande ou complexo.';
        } else if (error.message.includes('Invalid') || error.message.includes('401')) {
          errorMessage = 'Erro de autenticação com o serviço de IA. Contate o suporte.';
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          errorMessage = 'Erro de conexão. Verifique sua internet e tente novamente.';
        } else {
          errorMessage = error.message;
        }
      }
      
      setDocumentQueue(prev => prev.map(d => 
        d.id === doc.id ? { 
          ...d, 
          status: 'error' as QueueStatus, 
          error: errorMessage 
        } : d
      ));
      
      toast.error('Erro ao processar documento', {
        description: errorMessage,
      });
    }
  };

  const addFilesToQueue = useCallback((files: FileList | File[]) => {
    if (!unitId) {
      toast.error('Selecione uma unidade para continuar');
      return;
    }

    const fileArray = Array.from(files);
    const validFiles = fileArray.filter(f => {
      const ext = f.name.toLowerCase().split('.').pop();
      return ['pdf', 'xml', 'jpg', 'jpeg', 'png'].includes(ext || '');
    });

    if (validFiles.length === 0) {
      toast.error('Nenhum arquivo válido', {
        description: 'Use PDF, XML, JPG ou PNG',
      });
      return;
    }

    if (validFiles.length !== fileArray.length) {
      toast.warning(`${fileArray.length - validFiles.length} arquivo(s) ignorado(s)`, {
        description: 'Apenas PDF, XML, JPG e PNG são aceitos',
      });
    }

    const newDocs: QueuedDocument[] = validFiles.map(file => ({
      id: crypto.randomUUID(),
      file,
      status: 'queued' as QueueStatus,
    }));

    setDocumentQueue(prev => [...prev, ...newDocs]);
    toast.success(`${validFiles.length} arquivo(s) adicionado(s) à fila`);
  }, [unitId]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      addFilesToQueue(e.target.files);
      e.target.value = '';
    }
  }, [addFilesToQueue]);

  const handleUploadAreaClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files?.length) {
      addFilesToQueue(e.dataTransfer.files);
    }
  }, [addFilesToQueue]);

  const handleConfirmClick = (doc: QueuedDocument) => {
    setConfirmingDoc(doc);
    setConfirmModalOpen(true);
  };

  const handleConfirmClassification = useCallback(async (
    confirmedType: 'revenue' | 'expense',
    extras?: { description?: string; paymentMethod?: PaymentMethodType; needsReconciliation?: boolean }
  ) => {
    if (!confirmingDoc || !unitId || !confirmingDoc.result || !confirmingDoc.filePath) return;

    setIsConfirming(true);
    const { file, filePath, result } = confirmingDoc;

    try {
      let recordCreated = false;
      let recordType: 'invoice' | 'payable' | undefined;
      let recordId: string | undefined;
      let isDuplicate = false;
      let duplicateId: string | undefined;

      if (confirmedType === 'revenue') {
        const dupCheck = await checkDuplicateInvoice(result.issuerCnpj, result.documentNumber);
        if (dupCheck.isDuplicate) {
          isDuplicate = true;
          duplicateId = dupCheck.existingId;
          recordType = 'invoice';
        } else {
          const createResult = await createInvoiceFromOcr(
            result, 
            unitId, 
            filePath, 
            file.name,
            competenceYear,
            competenceMonth
          );
          
          if (createResult.error === 'duplicate') {
            isDuplicate = true;
            duplicateId = createResult.id;
            recordType = 'invoice';
          } else if (createResult.success) {
            recordCreated = true;
            recordType = 'invoice';
            recordId = createResult.id;
          }
        }
      } else {
        const vencimento = result.dueDate || result.issueDate || new Date().toISOString().split('T')[0];
        const dupCheck = await checkDuplicatePayable(
          result.issuerCnpj, 
          result.documentNumber,
          result.totalValue,
          vencimento
        );
        
        if (dupCheck.isDuplicate) {
          isDuplicate = true;
          duplicateId = dupCheck.existingId;
          recordType = 'payable';
        } else {
          const createResult = await createPayableFromOcr(result, unitId, filePath, file.name, extras);
          
          if (createResult.error === 'duplicate') {
            isDuplicate = true;
            duplicateId = createResult.id;
            recordType = 'payable';
          } else if (createResult.success) {
            recordCreated = true;
            recordType = 'payable';
            recordId = createResult.id;
          }
        }
      }

      // Create OCR result entry
      const newOcrResult: OcrResult = {
        docId: confirmingDoc.id,
        fileName: file.name,
        result: { ...result, type: confirmedType },
        recordCreated,
        recordType,
        recordId,
        isDuplicate,
        duplicateId,
      };

      setOcrResults(prev => [newOcrResult, ...prev]);

      // Remove from queue
      setDocumentQueue(prev => prev.filter(d => d.id !== confirmingDoc.id));

      // Show toast
      if (isDuplicate) {
        toast.warning('Documento já cadastrado');
      } else if (recordCreated) {
        toast.success(`Cadastrado como ${confirmedType === 'revenue' ? 'Receita' : 'Despesa'}`);
      } else {
        toast.error('Erro ao salvar documento');
      }

    } catch (error) {
      console.error('Error saving document:', error);
      toast.error('Erro ao salvar documento');
    } finally {
      setIsConfirming(false);
      setConfirmModalOpen(false);
      setConfirmingDoc(null);
    }
  }, [confirmingDoc, unitId, competenceYear, competenceMonth]);

  const handleCancelConfirmation = useCallback(() => {
    setConfirmModalOpen(false);
    setConfirmingDoc(null);
  }, []);

  const handleConfirmAllReady = useCallback(async () => {
    const readyDocs = documentQueue.filter(d => d.status === 'ready' && d.result);
    
    for (const doc of readyDocs) {
      if (!doc.result || !doc.filePath || !unitId) continue;
      
      const confirmedType = doc.result.type;
      
      try {
        let recordCreated = false;
        let recordType: 'invoice' | 'payable' | undefined;
        let recordId: string | undefined;
        let isDuplicate = false;
        let duplicateId: string | undefined;

        if (confirmedType === 'revenue') {
          const dupCheck = await checkDuplicateInvoice(doc.result.issuerCnpj, doc.result.documentNumber);
          if (dupCheck.isDuplicate) {
            isDuplicate = true;
            duplicateId = dupCheck.existingId;
            recordType = 'invoice';
          } else {
            const createResult = await createInvoiceFromOcr(
              doc.result, 
              unitId, 
              doc.filePath, 
              doc.file.name,
              competenceYear,
              competenceMonth
            );
            if (createResult.success) {
              recordCreated = true;
              recordType = 'invoice';
              recordId = createResult.id;
            }
          }
        } else {
          const vencimento = doc.result.dueDate || doc.result.issueDate || new Date().toISOString().split('T')[0];
          const dupCheck = await checkDuplicatePayable(doc.result.issuerCnpj, doc.result.documentNumber, doc.result.totalValue, vencimento);
          if (dupCheck.isDuplicate) {
            isDuplicate = true;
            duplicateId = dupCheck.existingId;
            recordType = 'payable';
          } else {
            const createResult = await createPayableFromOcr(doc.result, unitId, doc.filePath, doc.file.name);
            if (createResult.success) {
              recordCreated = true;
              recordType = 'payable';
              recordId = createResult.id;
            }
          }
        }

        const newOcrResult: OcrResult = {
          docId: doc.id,
          fileName: doc.file.name,
          result: doc.result,
          recordCreated,
          recordType,
          recordId,
          isDuplicate,
          duplicateId,
        };

        setOcrResults(prev => [newOcrResult, ...prev]);
      } catch (error) {
        console.error('Error in batch confirm:', error);
      }
    }

    // Remove all confirmed from queue
    setDocumentQueue(prev => prev.filter(d => d.status !== 'ready'));
    toast.success(`${readyDocs.length} documento(s) confirmado(s)`);
  }, [documentQueue, unitId, competenceYear, competenceMonth]);

  const handleDiscardAll = useCallback(() => {
    setDocumentQueue([]);
    toast.info('Fila limpa');
  }, []);

  const handleRemoveFromQueue = (id: string) => {
    setDocumentQueue(prev => prev.filter(d => d.id !== id));
  };

  const handleViewRecord = (type: 'invoice' | 'payable', id: string) => {
    if (type === 'invoice') {
      navigate('/billing/invoices');
    } else {
      navigate('/payables/boletos');
    }
  };

  const handleAddPaymentData = (payableId: string) => {
    const ocrResult = ocrResults.find(r => r.recordId === payableId);
    setSelectedPayableId(payableId);
    setSelectedPayableInfo({
      beneficiario: ocrResult?.result.issuerName || undefined,
      valor: ocrResult?.result.netValue || ocrResult?.result.totalValue || undefined,
    });
    setPaymentModalOpen(true);
  };

  const getStatusIcon = (status: QueueStatus) => {
    switch (status) {
      case 'queued': return <Clock className="h-4 w-4 text-muted-foreground" />;
      case 'uploading': return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'analyzing': return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      case 'ready': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'confirmed': return <Check className="h-4 w-4 text-green-600" />;
      case 'error': return <AlertCircle className="h-4 w-4 text-destructive" />;
    }
  };

  const getStatusLabel = (status: QueueStatus) => {
    switch (status) {
      case 'queued': return 'Na fila';
      case 'uploading': return 'Enviando...';
      case 'analyzing': return 'Analisando...';
      case 'ready': return 'Pronto';
      case 'confirmed': return 'Confirmado';
      case 'error': return 'Erro';
    }
  };

  const readyCount = documentQueue.filter(d => d.status === 'ready').length;
  const processingCount = documentQueue.filter(d => d.status === 'uploading' || d.status === 'analyzing').length;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Button variant="ghost" onClick={onBack} className="gap-2">
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Button>

      {/* Header */}
      <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <p className="text-lg font-semibold">Lançar Documentos e Pagamentos</p>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          <span className="text-primary font-medium">IA Inteligente:</span> envie múltiplos arquivos de uma vez. A IA classifica cada um automaticamente.
        </p>
      </div>

      {/* Drag & Drop Upload Area */}
      <Card 
        className={cn(
          "border-dashed border-2 transition-colors",
          isDragging && "border-primary bg-primary/5"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <CardContent className="p-8" onClick={handleUploadAreaClick}>
          <div className="flex flex-col items-center justify-center cursor-pointer">
            <input 
              key={`file-input-${documentQueue.length}`}
              ref={fileInputRef}
              type="file" 
              className="hidden" 
              onChange={handleFileChange}
              accept=".pdf,.xml,.jpg,.jpeg,.png"
              multiple
              disabled={!unitId}
            />
            <div className={cn(
              "p-4 rounded-full mb-3 transition-colors",
              isDragging ? "bg-primary/20" : "bg-muted"
            )}>
              {processingCount > 0 ? (
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
              ) : (
                <Upload className="h-10 w-10 text-primary" />
              )}
            </div>
            <p className="text-lg font-medium text-center">
              {isDragging ? 'Solte os arquivos aqui' : 'Arraste arquivos ou clique para selecionar'}
            </p>
            <p className="text-sm text-muted-foreground mt-2 text-center">
              Nota Fiscal, Boleto, Recibo ou Comprovante
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              PDF, XML, JPG ou PNG • Múltiplos arquivos permitidos
            </p>
            {!unitId && (
              <Badge variant="destructive" className="mt-3">
                Selecione uma unidade primeiro
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Processing Queue */}
      {documentQueue.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Fila de Processamento ({documentQueue.length})
            </h3>
            {processingCount > 0 && (
              <Badge variant="secondary" className="animate-pulse">
                Processando {processingCount}...
              </Badge>
            )}
          </div>

          <div className="space-y-2">
            {documentQueue.map((doc) => (
              <div 
                key={doc.id}
                className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border"
              >
                {getStatusIcon(doc.status)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{doc.file.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">
                      {getStatusLabel(doc.status)}
                    </span>
                    {doc.status === 'ready' && doc.result && (
                      <Badge variant={doc.result.type === 'revenue' ? 'default' : 'secondary'} className="text-xs">
                        {doc.result.type === 'revenue' ? 'Receita' : 'Despesa'}
                      </Badge>
                    )}
                    {doc.status === 'error' && doc.error && (
                      <span className="text-xs text-destructive">{doc.error}</span>
                    )}
                  </div>
                </div>
                
                {doc.status === 'ready' && (
                  <Button 
                    size="sm" 
                    onClick={() => handleConfirmClick(doc)}
                  >
                    Confirmar
                  </Button>
                )}
                
                {(doc.status === 'queued' || doc.status === 'error') && (
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => handleRemoveFromQueue(doc.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          {/* Batch actions */}
          {readyCount > 0 && (
            <div className="flex gap-2 pt-2">
              <Button onClick={handleConfirmAllReady} className="gap-2">
                <Check className="h-4 w-4" />
                Confirmar Todos ({readyCount})
              </Button>
              <Button variant="outline" onClick={handleDiscardAll}>
                Descartar Todos
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Confirmed Results */}
      {ocrResults.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Documentos Cadastrados ({ocrResults.length})
          </h3>
          {ocrResults.map((ocr) => (
            <AccountingOcrResultCard
              key={ocr.docId}
              result={ocr.result}
              fileName={ocr.fileName}
              recordCreated={ocr.recordCreated}
              recordType={ocr.recordType}
              recordId={ocr.recordId}
              isDuplicate={ocr.isDuplicate}
              duplicateId={ocr.duplicateId}
              onViewRecord={handleViewRecord}
              onAddPaymentData={handleAddPaymentData}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {ocrResults.length === 0 && documentQueue.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p>Envie documentos para análise automática</p>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmingDoc && confirmingDoc.result && (
        <DocumentConfirmationModal
          open={confirmModalOpen}
          onOpenChange={setConfirmModalOpen}
          result={confirmingDoc.result}
          fileName={confirmingDoc.file.name}
          onConfirm={handleConfirmClassification}
          onCancel={handleCancelConfirmation}
          isConfirming={isConfirming}
        />
      )}

      {/* Payment Data Modal */}
      {selectedPayableId && (
        <PaymentDataModal
          open={paymentModalOpen}
          onOpenChange={setPaymentModalOpen}
          payableId={selectedPayableId}
          payableBeneficiario={selectedPayableInfo.beneficiario}
          payableValor={selectedPayableInfo.valor}
        />
      )}
    </div>
  );
}
