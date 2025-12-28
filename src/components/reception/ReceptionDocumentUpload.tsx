import { useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  Upload, 
  Loader2,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { AccountingOcrResultCard } from '@/components/accounting/AccountingOcrResultCard';
import { PaymentDataModal } from '@/components/payables/PaymentDataModal';
import { DocumentConfirmationModal } from './DocumentConfirmationModal';
import { 
  analyzeAccountingDocument, 
  createInvoiceFromOcr,
  createPayableFromOcr,
  checkDuplicateInvoice,
  checkDuplicatePayable,
  AnalyzedDocResult 
} from '@/services/accountingOcrService';
import { useNavigate } from 'react-router-dom';

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

interface PendingDocument {
  file: File;
  filePath: string;
  result: AnalyzedDocResult;
}

export function ReceptionDocumentUpload({ onBack, unitId }: ReceptionDocumentUploadProps) {
  const navigate = useNavigate();
  
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [ocrResults, setOcrResults] = useState<OcrResult[]>([]);
  
  // Pending document awaiting confirmation
  const [pendingDocument, setPendingDocument] = useState<PendingDocument | null>(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  
  // Payment data modal state
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedPayableId, setSelectedPayableId] = useState<string | null>(null);
  const [selectedPayableInfo, setSelectedPayableInfo] = useState<{ beneficiario?: string; valor?: number }>({});

  // Get current month/year for competence
  const now = new Date();
  const competenceYear = now.getFullYear();
  const competenceMonth = now.getMonth() + 1;
  
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length || !unitId) {
      if (!unitId) {
        toast.error('Selecione uma unidade para continuar');
      }
      return;
    }
    
    const file = e.target.files[0];
    setIsUploading(true);
    
    try {
      // Upload file to storage
      const filePath = `reception/${unitId}/${competenceYear}/${competenceMonth}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('accounting-documents')
        .upload(filePath, file);
      
      if (uploadError) {
        throw uploadError;
      }

      setIsUploading(false);
      setIsAnalyzing(true);
      
      toast.info('Analisando documento com IA...', {
        id: 'ocr-analyzing',
        duration: 15000,
      });

      // ONLY analyze - don't save yet
      const result = await analyzeAccountingDocument(file, unitId);

      toast.dismiss('ocr-analyzing');

      // Store pending document and show confirmation modal
      setPendingDocument({ file, filePath, result });
      setConfirmModalOpen(true);

    } catch (error) {
      toast.dismiss('ocr-analyzing');
      console.error('Upload/OCR error:', error);
      toast.error('Erro ao processar documento', {
        description: error instanceof Error ? error.message : 'Tente novamente',
      });
    } finally {
      setIsUploading(false);
      setIsAnalyzing(false);
      // Reset input
      e.target.value = '';
    }
  }, [unitId, competenceYear, competenceMonth]);

  const handleConfirmClassification = useCallback(async (confirmedType: 'revenue' | 'expense') => {
    if (!pendingDocument || !unitId) return;

    setIsConfirming(true);
    const { file, filePath, result } = pendingDocument;

    try {
      let recordCreated = false;
      let recordType: 'invoice' | 'payable' | undefined;
      let recordId: string | undefined;
      let isDuplicate = false;
      let duplicateId: string | undefined;

      if (confirmedType === 'revenue') {
        // Check duplicate for invoice
        const dupCheck = await checkDuplicateInvoice(result.issuerCnpj, result.documentNumber);
        if (dupCheck.isDuplicate) {
          isDuplicate = true;
          duplicateId = dupCheck.existingId;
          recordType = 'invoice';
        } else {
          // Create invoice
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
        // Check duplicate for payable
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
          // Create payable
          const createResult = await createPayableFromOcr(result, unitId, filePath, file.name);
          
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
        docId: crypto.randomUUID(),
        fileName: file.name,
        result: { ...result, type: confirmedType },
        recordCreated,
        recordType,
        recordId,
        isDuplicate,
        duplicateId,
      };

      setOcrResults(prev => [newOcrResult, ...prev]);

      // Show appropriate toast
      if (isDuplicate) {
        toast.warning('Documento já cadastrado', {
          description: 'Este documento já existe no sistema.',
        });
      } else if (recordCreated) {
        const typeLabel = recordType === 'invoice' ? 'Faturamento' : 'Despesas';
        toast.success(`Cadastrado em ${typeLabel}`, {
          description: confirmedType === 'revenue' ? 'Receita cadastrada.' : 'Despesa cadastrada.',
        });
      } else {
        toast.error('Erro ao salvar documento', {
          description: 'Tente novamente.',
        });
      }

    } catch (error) {
      console.error('Error saving document:', error);
      toast.error('Erro ao salvar documento', {
        description: error instanceof Error ? error.message : 'Tente novamente',
      });
    } finally {
      setIsConfirming(false);
      setConfirmModalOpen(false);
      setPendingDocument(null);
    }
  }, [pendingDocument, unitId, competenceYear, competenceMonth]);

  const handleCancelConfirmation = useCallback(() => {
    setConfirmModalOpen(false);
    setPendingDocument(null);
    toast.info('Documento descartado');
  }, []);

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

  const isProcessing = isUploading || isAnalyzing;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Button variant="ghost" onClick={onBack} className="gap-2">
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Button>

      {/* Header with OCR info */}
      <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <p className="text-lg font-semibold">Cadastrar Documentos</p>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          <span className="text-primary font-medium">IA Inteligente:</span> a IA identifica automaticamente se é Receita ou Despesa. Você confirma antes de salvar.
        </p>
      </div>

      {/* Single upload area - no tabs */}
      <Card className="border-dashed border-2">
        <CardContent className="p-8">
          <label className="flex flex-col items-center justify-center cursor-pointer">
            <input 
              type="file" 
              className="hidden" 
              onChange={handleFileUpload}
              accept=".pdf,.xml,.jpg,.jpeg,.png"
              disabled={isProcessing || !unitId}
            />
            <div className="p-4 rounded-full bg-muted mb-3">
              {isProcessing ? (
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
              ) : (
                <Sparkles className="h-10 w-10 text-primary" />
              )}
            </div>
            <p className="text-lg font-medium text-center">
              {isUploading && 'Enviando arquivo...'}
              {isAnalyzing && 'Analisando documento com IA...'}
              {!isProcessing && 'Clique para enviar documento'}
            </p>
            <p className="text-sm text-muted-foreground mt-2 text-center">
              Nota Fiscal, Boleto, Recibo ou Comprovante
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              PDF, XML, JPG ou PNG
            </p>
            {!unitId && (
              <Badge variant="destructive" className="mt-3">
                Selecione uma unidade primeiro
              </Badge>
            )}
          </label>
        </CardContent>
      </Card>

      {/* OCR Results */}
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
      {ocrResults.length === 0 && !isProcessing && (
        <div className="text-center py-8 text-muted-foreground">
          <p>Envie um documento para análise automática</p>
        </div>
      )}

      {/* Confirmation Modal */}
      {pendingDocument && (
        <DocumentConfirmationModal
          open={confirmModalOpen}
          onOpenChange={setConfirmModalOpen}
          result={pendingDocument.result}
          fileName={pendingDocument.file.name}
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
