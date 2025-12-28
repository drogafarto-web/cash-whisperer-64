import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  FileText, 
  Receipt, 
  Upload, 
  Loader2,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AccountingOcrResultCard } from '@/components/accounting/AccountingOcrResultCard';
import { PaymentDataModal } from '@/components/payables/PaymentDataModal';
import { processAccountingDocument, AnalyzedDocResult } from '@/services/accountingOcrService';
import { useNavigate } from 'react-router-dom';

interface ReceptionDocumentUploadProps {
  onBack: () => void;
  unitId: string | null;
}

type DocumentType = 'nf' | 'despesa';

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

export function ReceptionDocumentUpload({ onBack, unitId }: ReceptionDocumentUploadProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [activeTab, setActiveTab] = useState<DocumentType>('nf');
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [ocrResults, setOcrResults] = useState<OcrResult[]>([]);
  
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

      // Process with OCR
      const ocrResult = await processAccountingDocument(
        file,
        unitId,
        filePath,
        competenceYear,
        competenceMonth
      );

      toast.dismiss('ocr-analyzing');

      // Create OCR result entry
      const newOcrResult: OcrResult = {
        docId: crypto.randomUUID(),
        fileName: file.name,
        result: ocrResult.result,
        recordCreated: ocrResult.recordCreated,
        recordType: ocrResult.recordType,
        recordId: ocrResult.recordId,
        isDuplicate: ocrResult.isDuplicate,
        duplicateId: ocrResult.duplicateId,
      };

      setOcrResults(prev => [newOcrResult, ...prev]);

      // Show appropriate toast
      if (ocrResult.isDuplicate) {
        toast.warning('Documento já cadastrado', {
          description: 'Este documento já existe no sistema.',
        });
      } else if (ocrResult.recordCreated) {
        const typeLabel = ocrResult.recordType === 'invoice' ? 'Faturamento' : 'Despesas';
        toast.success(`Cadastrado em ${typeLabel}`, {
          description: `${ocrResult.result.type === 'revenue' ? 'Receita' : 'Despesa'} identificada automaticamente.`,
        });
      } else if (ocrResult.result.type === 'unknown') {
        toast.info('Classificação manual necessária', {
          description: 'Não foi possível identificar automaticamente se é receita ou despesa.',
        });
      }

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
          <span className="text-primary font-medium">OCR Inteligente:</span> documentos são analisados automaticamente e cadastrados como Receita ou Despesa
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b pb-2">
        <Button 
          variant={activeTab === 'nf' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('nf')}
          className="gap-2"
        >
          <FileText className="h-4 w-4" />
          Notas para Clientes (Receitas)
        </Button>
        <Button 
          variant={activeTab === 'despesa' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('despesa')}
          className="gap-2"
        >
          <Receipt className="h-4 w-4" />
          Notas de Fornecedores (Despesas)
        </Button>
      </div>

      {/* Upload area */}
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
              {!isProcessing && activeTab === 'nf' && 'Clique para adicionar Nota Fiscal / Recibo'}
              {!isProcessing && activeTab === 'despesa' && 'Clique para adicionar Nota de Fornecedor / Boleto'}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              PDF, XML, JPG ou PNG • Análise automática com IA
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
            Documentos Analisados ({ocrResults.length})
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
          <p>Envie um documento para iniciar a análise automática</p>
        </div>
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
