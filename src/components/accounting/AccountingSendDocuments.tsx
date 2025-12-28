import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ArrowLeft, 
  FileText, 
  FileUp, 
  Upload, 
  Trash2, 
  Send,
  Loader2,
  File,
  Sparkles,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { 
  useLabSubmission, 
  useLabDocuments, 
  useLabSubmissionMutation,
  useUploadLabDocument,
  useDeleteLabDocument,
  useSubmitToAccounting,
} from '@/hooks/useAccountingCompetence';
import { AccountingOcrResultCard } from './AccountingOcrResultCard';
import { PaymentDataModal } from '@/components/payables/PaymentDataModal';
import { DocumentConfirmationModal } from '@/components/reception/DocumentConfirmationModal';
import { 
  analyzeAccountingDocument, 
  createInvoiceFromOcr, 
  createPayableFromOcr,
  checkDuplicateInvoice,
  checkDuplicatePayable,
  AnalyzedDocResult 
} from '@/services/accountingOcrService';
import { useNavigate } from 'react-router-dom';

interface AccountingSendDocumentsProps {
  unitId: string | null;
  unitName: string;
  competence: Date;
  onBack: () => void;
}

type DocumentType = 'documento' | 'extrato_bancario';

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
  docId: string;
  result: AnalyzedDocResult;
}

export function AccountingSendDocuments({ unitId, unitName, competence, onBack }: AccountingSendDocumentsProps) {
  const navigate = useNavigate();
  const ano = competence.getFullYear();
  const mes = competence.getMonth() + 1;
  
  const [activeTab, setActiveTab] = useState<DocumentType>('documento');
  const [observacoes, setObservacoes] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [ocrResults, setOcrResults] = useState<OcrResult[]>([]);
  
  // Confirmation modal state
  const [pendingDocument, setPendingDocument] = useState<PendingDocument | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  
  // Payment data modal state
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedPayableId, setSelectedPayableId] = useState<string | null>(null);
  const [selectedPayableInfo, setSelectedPayableInfo] = useState<{ beneficiario?: string; valor?: number }>({});
  
  const { data: submission, isLoading: loadingSubmission } = useLabSubmission(unitId, ano, mes);
  const { data: documents = [], isLoading: loadingDocs } = useLabDocuments(submission?.id || null);
  
  const submissionMutation = useLabSubmissionMutation();
  const uploadMutation = useUploadLabDocument();
  const deleteMutation = useDeleteLabDocument();
  const submitMutation = useSubmitToAccounting();
  
  const competenceLabel = format(competence, "MMMM 'de' yyyy", { locale: ptBR });
  
  // Filter documents - "documento" shows both nf and despesa types
  const filteredDocs = activeTab === 'documento' 
    ? documents.filter(d => d.tipo === 'nf' || d.tipo === 'despesa')
    : documents.filter(d => d.tipo === 'extrato_bancario');

  // Documento tab supports OCR
  const supportsOcr = activeTab === 'documento';
  
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length || !unitId) return;
    
    const file = e.target.files[0];
    
    // Ensure we have a submission first
    let submissionId = submission?.id;
    
    if (!submissionId) {
      try {
        const newSubmission = await submissionMutation.mutateAsync({
          unit_id: unitId,
          ano,
          mes,
          status: 'rascunho',
        });
        submissionId = newSubmission.id;
      } catch (error) {
        toast.error('Erro ao criar envio');
        return;
      }
    }
    
    // Upload the file first (with temporary type, will be updated after confirmation)
    const uploadResult = await uploadMutation.mutateAsync({
      file,
      submission_id: submissionId,
      unit_id: unitId,
      ano,
      mes,
      tipo: supportsOcr ? 'nf' : 'extrato_bancario', // Temporary, may change after confirmation
    });

    // If supports OCR, analyze and show confirmation modal
    if (supportsOcr && uploadResult?.id) {
      setIsAnalyzing(true);
      
      try {
        toast.info('Analisando documento com IA...', {
          id: 'ocr-analyzing',
          duration: 10000,
        });

        const analysisResult = await analyzeAccountingDocument(file, unitId);
        
        toast.dismiss('ocr-analyzing');

        // Store pending document and show confirmation modal
        setPendingDocument({
          file,
          filePath: uploadResult.file_path || '',
          docId: uploadResult.id,
          result: analysisResult,
        });

      } catch (error) {
        toast.dismiss('ocr-analyzing');
        console.error('OCR error:', error);
        toast.error('Erro na análise', {
          description: 'O arquivo foi salvo, mas não foi possível analisar automaticamente.',
        });
      } finally {
        setIsAnalyzing(false);
      }
    }
    
    // Reset input
    e.target.value = '';
  }, [unitId, ano, mes, submission?.id, submissionMutation, uploadMutation, supportsOcr]);

  const handleConfirmClassification = async (selectedType: 'revenue' | 'expense') => {
    if (!pendingDocument || !unitId) return;
    
    setIsConfirming(true);
    
    try {
      const { file, filePath, docId, result } = pendingDocument;
      
      // Update the result type if user changed it
      const finalResult = { ...result, type: selectedType };
      
      let recordCreated = false;
      let recordType: 'invoice' | 'payable' | undefined;
      let recordId: string | undefined;
      let isDuplicate = false;
      let duplicateId: string | undefined;
      
      if (selectedType === 'revenue') {
        // Check for duplicate invoice
        const dupCheck = await checkDuplicateInvoice(
          finalResult.issuerCnpj,
          finalResult.documentNumber
        );
        
        if (dupCheck.isDuplicate) {
          isDuplicate = true;
          duplicateId = dupCheck.existingId;
        } else {
          // Create invoice
          const invoiceResult = await createInvoiceFromOcr(
            finalResult,
            unitId,
            filePath,
            file.name,
            ano,
            mes
          );
          
          if (invoiceResult.success) {
            recordCreated = true;
            recordType = 'invoice';
            recordId = invoiceResult.id;
          }
        }
      } else {
        // Check for duplicate payable
        const dupCheck = await checkDuplicatePayable(
          finalResult.issuerCnpj,
          finalResult.documentNumber,
          finalResult.netValue || finalResult.totalValue,
          finalResult.dueDate
        );
        
        if (dupCheck.isDuplicate) {
          isDuplicate = true;
          duplicateId = dupCheck.existingId;
        } else {
          // Create payable
          const payableResult = await createPayableFromOcr(
            finalResult,
            unitId,
            filePath,
            file.name
          );
          
          if (payableResult.success) {
            recordCreated = true;
            recordType = 'payable';
            recordId = payableResult.id;
          }
        }
      }
      
      // Add to OCR results list
      const newOcrResult: OcrResult = {
        docId,
        fileName: file.name,
        result: finalResult,
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
          description: `${selectedType === 'revenue' ? 'Receita' : 'Despesa'} registrada com sucesso.`,
        });
      }
      
      // Close modal
      setPendingDocument(null);
      
    } catch (error) {
      console.error('Error confirming classification:', error);
      toast.error('Erro ao salvar documento');
    } finally {
      setIsConfirming(false);
    }
  };

  const handleCancelClassification = () => {
    // User cancelled - document file is already uploaded but no record created
    if (pendingDocument) {
      toast.info('Classificação cancelada', {
        description: 'O arquivo foi mantido, mas nenhum registro foi criado.',
      });
    }
    setPendingDocument(null);
  };

  const handleDelete = async (doc: typeof documents[0]) => {
    if (!doc.id || !submission?.id) return;
    
    await deleteMutation.mutateAsync({
      id: doc.id,
      file_path: doc.file_path,
      submission_id: submission.id,
    });

    // Remove from OCR results if exists
    setOcrResults(prev => prev.filter(r => r.docId !== doc.id));
  };

  const handleSubmit = async () => {
    if (!submission?.id || !unitId) {
      toast.error('Nenhum documento para enviar');
      return;
    }
    
    if (documents.length === 0) {
      toast.error('Adicione pelo menos um documento antes de enviar');
      return;
    }
    
    // Update observações if changed
    if (observacoes !== submission.observacoes) {
      await submissionMutation.mutateAsync({
        unit_id: unitId,
        ano,
        mes,
        observacoes,
      });
    }
    
    await submitMutation.mutateAsync({
      submission_id: submission.id,
      unit_id: unitId,
      ano,
      mes,
    });
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

  const isReadOnly = submission?.status === 'enviado' || submission?.status === 'recebido';

  // Count documents for tabs
  const documentCount = documents.filter(d => d.tipo === 'nf' || d.tipo === 'despesa').length;
  const extratoCount = documents.filter(d => d.tipo === 'extrato_bancario').length;

  if (loadingSubmission) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        {submission && (
          <Badge variant={submission.status === 'enviado' ? 'default' : 'outline'}>
            {submission.status === 'enviado' ? 'Enviado' : submission.status === 'recebido' ? 'Recebido' : 'Rascunho'}
          </Badge>
        )}
      </div>

      <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <p className="text-sm text-muted-foreground">Enviar para Contabilidade</p>
        </div>
        <p className="text-xl font-semibold capitalize">{competenceLabel} — {unitName}</p>
        <p className="text-xs text-muted-foreground mt-1">
          <span className="text-primary font-medium">IA Inteligente:</span> documentos são analisados e você confirma se é Receita ou Despesa antes de salvar
        </p>
      </div>

      {/* Tabs - Simplified: Documentos (OCR) and Extrato */}
      <div className="flex gap-2 border-b pb-2">
        <Button 
          variant={activeTab === 'documento' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('documento')}
          className="gap-2"
        >
          <FileText className="h-4 w-4" />
          Documentos ({documentCount})
        </Button>
        <Button 
          variant={activeTab === 'extrato_bancario' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('extrato_bancario')}
          className="gap-2"
        >
          <FileUp className="h-4 w-4" />
          Extrato Bancário ({extratoCount})
        </Button>
      </div>

      {/* Upload area */}
      {!isReadOnly && (
        <Card className="border-dashed">
          <CardContent className="p-6">
            <label className="flex flex-col items-center justify-center cursor-pointer">
              <input 
                type="file" 
                className="hidden" 
                onChange={handleFileUpload}
                accept=".pdf,.xml,.jpg,.jpeg,.png"
                disabled={uploadMutation.isPending || isAnalyzing}
              />
              <div className="p-4 rounded-full bg-muted mb-3">
                {uploadMutation.isPending || isAnalyzing ? (
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                ) : supportsOcr ? (
                  <Sparkles className="h-8 w-8 text-primary" />
                ) : (
                  <Upload className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <p className="text-sm font-medium">
                {isAnalyzing ? 'Analisando documento com IA...' : (
                  supportsOcr 
                    ? 'Clique para adicionar Documento' 
                    : 'Clique para adicionar Extrato Bancário'
                )}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {supportsOcr ? (
                  'PDF, XML, JPG ou PNG • A IA identifica se é Receita ou Despesa'
                ) : (
                  'PDF, XML, JPG ou PNG'
                )}
              </p>
            </label>
          </CardContent>
        </Card>
      )}

      {/* OCR Results */}
      {ocrResults.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Documentos Analisados
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

      {/* Documents list */}
      {loadingDocs ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : filteredDocs.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            Documentos Enviados
          </h3>
          {filteredDocs.map((doc) => (
            <Card key={doc.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-muted rounded">
                    <File className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{doc.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {doc.file_size ? `${(doc.file_size / 1024).toFixed(1)} KB` : '—'}
                      {doc.valor ? ` • ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(doc.valor)}` : ''}
                    </p>
                  </div>
                </div>
                {!isReadOnly && (
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => handleDelete(doc)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <p>Nenhum documento adicionado</p>
        </div>
      )}

      {/* Observações */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Observações</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea 
            placeholder="Observações para a contabilidade (opcional)"
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            disabled={isReadOnly}
            rows={3}
          />
        </CardContent>
      </Card>

      {/* Submit button */}
      {!isReadOnly && (
        <div className="flex justify-center pt-4">
          <Button 
            size="lg" 
            onClick={handleSubmit}
            disabled={submitMutation.isPending || documents.length === 0}
            className="gap-2"
          >
            {submitMutation.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
            Confirmar Envio para Contabilidade
          </Button>
        </div>
      )}

      {isReadOnly && submission?.enviado_em && (
        <div className="text-center text-sm text-muted-foreground">
          Enviado em {format(new Date(submission.enviado_em), "dd/MM/yyyy 'às' HH:mm")}
        </div>
      )}

      {/* Document Confirmation Modal */}
      {pendingDocument && (
        <DocumentConfirmationModal
          open={!!pendingDocument}
          onOpenChange={(open) => !open && handleCancelClassification()}
          result={pendingDocument.result}
          fileName={pendingDocument.file.name}
          onConfirm={handleConfirmClassification}
          onCancel={handleCancelClassification}
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
