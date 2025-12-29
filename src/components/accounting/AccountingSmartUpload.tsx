import { useState, useRef, useCallback, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Upload,
  FileText,
  Sparkles,
  Loader2,
  X,
  FolderUp,
  AlertTriangle,
  RefreshCw,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { sanitizeFileName } from '@/lib/sanitizeFileName';
import { TaxGuideResultCard } from './TaxGuideResultCard';
import { PayrollAnalysisCard } from './PayrollAnalysisCard';
import type { TaxGuideOcrResult, PayrollOcrResult } from '@/services/accountingValidationService';
import { 
  analyzeAccountingDocument, 
  AnalyzedDocResult,
  isTaxDocument,
  isPayrollDocument,
} from '@/services/accountingOcrService';

type TaxType = 'das' | 'darf' | 'gps' | 'inss' | 'fgts' | 'iss';

type AIStatus = 'available' | 'limited' | 'unavailable' | 'checking';
type ErrorCode = 'RATE_LIMIT' | 'NO_CREDITS' | 'GENERIC';

interface UploadedDocument {
  id: string;
  file: File;
  fileName: string;
  filePath?: string;
  status: 'queued' | 'uploading' | 'analyzing' | 'ready' | 'applied' | 'error' | 'manual';
  type: 'tax' | 'payroll' | 'other';
  analysisResult?: AnalyzedDocResult;
  taxResult?: TaxGuideOcrResult;
  payrollResult?: PayrollOcrResult;
  errorMessage?: string;
  errorCode?: ErrorCode;
}

interface AccountingSmartUploadProps {
  unitId: string;
  ano: number;
  mes: number;
  onTaxApply?: (taxType: TaxType, valor: number, vencimento: string | null) => void;
  onPayrollApply?: (data: { total_folha: number; encargos: number; prolabore: number; num_funcionarios: number }) => void;
}

// Map document types to TaxType
const DOC_TYPE_TO_TAX_TYPE: Record<string, TaxType> = {
  das: 'das',
  darf: 'darf',
  gps: 'gps',
  inss_guia: 'inss',
  inss: 'inss',
  fgts: 'fgts',
  iss: 'iss',
};

export function AccountingSmartUpload({
  unitId,
  ano,
  mes,
  onTaxApply,
  onPayrollApply,
}: AccountingSmartUploadProps) {
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [aiStatus, setAiStatus] = useState<AIStatus>('available');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  // Track AI status based on recent errors
  const updateAIStatus = useCallback((errorCode?: ErrorCode) => {
    if (!errorCode) {
      setAiStatus('available');
    } else if (errorCode === 'RATE_LIMIT') {
      setAiStatus('limited');
    } else if (errorCode === 'NO_CREDITS') {
      setAiStatus('unavailable');
    }
  }, []);

  const updateDocument = useCallback((id: string, updates: Partial<UploadedDocument>) => {
    setDocuments((prev) =>
      prev.map((doc) => (doc.id === id ? { ...doc, ...updates } : doc))
    );
  }, []);

  // Convert AnalyzedDocResult to TaxGuideOcrResult for display
  const convertToTaxResult = (result: AnalyzedDocResult): TaxGuideOcrResult | null => {
    const taxType = DOC_TYPE_TO_TAX_TYPE[result.documentType];
    if (!taxType) return null;

    return {
      tipo_documento: taxType,
      valor: result.totalValue,
      vencimento: result.dueDate,
      codigo_barras: result.codigoBarras,
      linha_digitavel: result.linhaDigitavel,
      competencia: result.competenceMonth && result.competenceYear 
        ? { ano: result.competenceYear, mes: result.competenceMonth } 
        : null,
      cnpj_contribuinte: result.issuerCnpj,
      beneficiario: result.issuerName,
      sugestao: result.attendantSuggestion,
      alertas: [],
      confidence: result.confidence,
    };
  };

  // Convert AnalyzedDocResult to PayrollOcrResult for display
  const convertToPayrollResult = (result: AnalyzedDocResult): PayrollOcrResult => {
    return {
      total_folha: result.totalValue || 0,
      encargos: result.taxes?.inss || 0,
      prolabore: null,
      num_funcionarios: null,
      competencia: result.competenceMonth && result.competenceYear 
        ? { ano: result.competenceYear, mes: result.competenceMonth }
        : null,
      sugestao: result.attendantSuggestion,
      alertas: [],
      confidence: result.confidence,
    };
  };

  const processDocument = async (doc: UploadedDocument) => {
    const { id, file } = doc;
    
    try {
      // 1. Upload to storage
      updateDocument(id, { status: 'uploading' });
      
      const safeFileName = sanitizeFileName(file.name);
      const filePath = `contabilidade/${unitId}/${ano}/${mes}/smart-upload/${Date.now()}_${safeFileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('accounting-documents')
        .upload(filePath, file);
      
      if (uploadError) throw uploadError;
      
      updateDocument(id, { filePath });
      
      // 2. Analyze with unified AI service (same as Reception)
      updateDocument(id, { status: 'analyzing' });
      
      const result = await analyzeAccountingDocument(file, unitId);
      
      // 3. Determine document type and convert result
      const docType = result.documentType;
      
      if (isTaxDocument(docType)) {
        const taxResult = convertToTaxResult(result);
        if (taxResult) {
          updateDocument(id, { 
            status: 'ready', 
            type: 'tax',
            analysisResult: result,
            taxResult,
          });
          updateAIStatus(); // AI is working
        } else {
          updateDocument(id, { 
            status: 'manual', 
            type: 'other',
            analysisResult: result,
            errorMessage: 'Tipo de guia não identificado. Preencha manualmente.',
          });
        }
      } else if (isPayrollDocument(docType)) {
        const payrollResult = convertToPayrollResult(result);
        updateDocument(id, { 
          status: 'ready', 
          type: 'payroll',
          analysisResult: result,
          payrollResult,
        });
        updateAIStatus(); // AI is working
      } else {
        // Unknown document type - still show result but as manual
        updateDocument(id, { 
          status: 'manual', 
          type: 'other',
          analysisResult: result,
          errorMessage: `Documento identificado como "${result.documentType}". Preencha os campos manualmente.`,
        });
      }
    } catch (error: any) {
      console.error('Processing error:', error);
      
      const errorCode = detectErrorCode(error);
      updateAIStatus(errorCode);
      handleAIError(id, errorCode, 'tax', error.message);
    }
  };

  const detectErrorCode = (error: any): ErrorCode => {
    const message = (error?.message || '').toLowerCase();
    const status = error?.status || error?.code;
    
    if (status === 429 || message.includes('429') || message.includes('rate limit')) {
      return 'RATE_LIMIT';
    }
    if (status === 402 || message.includes('402') || message.includes('credits') || message.includes('payment')) {
      return 'NO_CREDITS';
    }
    
    return 'GENERIC';
  };

  const handleAIError = (id: string, errorCode: ErrorCode, docType: 'tax' | 'payroll', message?: string) => {
    let errorMessage: string;
    let status: UploadedDocument['status'] = 'error';
    
    switch (errorCode) {
      case 'RATE_LIMIT':
        errorMessage = 'Limite de requisições excedido. Tente novamente em alguns minutos ou preencha manualmente.';
        toast.warning('Limite de IA atingido. Você pode tentar novamente em breve.');
        break;
      case 'NO_CREDITS':
        errorMessage = 'IA indisponível. Arquivo anexado - preencha os dados manualmente.';
        status = 'manual';
        toast.info('IA indisponível. O arquivo foi anexado, preencha os campos manualmente.');
        break;
      default:
        errorMessage = message || 'Erro ao analisar documento. Tente novamente ou preencha manualmente.';
        toast.error('Erro na análise. O arquivo foi anexado.');
    }
    
    updateDocument(id, { 
      status, 
      type: docType,
      errorMessage,
      errorCode,
    });
  };

  const retryDocument = async (doc: UploadedDocument) => {
    updateDocument(doc.id, { status: 'queued', errorMessage: undefined, errorCode: undefined });
    await processDocument(doc);
  };

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/xml', 'application/xml'];
    
    const validFiles = fileArray.filter((file) => {
      const isAllowed = allowedTypes.includes(file.type) || file.name.toLowerCase().endsWith('.xml');
      if (!isAllowed) {
        toast.error(`${file.name}: tipo não suportado`);
        return false;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name}: arquivo muito grande (máx 10MB)`);
        return false;
      }
      return true;
    });
    
    if (validFiles.length === 0) return;
    
    // Add documents to queue
    const newDocs: UploadedDocument[] = validFiles.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      fileName: file.name,
      status: 'queued' as const,
      type: 'tax' as const,
    }));
    
    setDocuments((prev) => [...prev, ...newDocs]);
    
    // Process documents sequentially
    for (const doc of newDocs) {
      await processDocument(doc);
    }
  }, [unitId, ano, mes]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
    e.target.value = '';
  }, [handleFiles]);

  const handleTaxApply = (doc: UploadedDocument) => {
    if (!doc.taxResult || !onTaxApply) return;
    
    const taxType = doc.taxResult.tipo_documento as TaxType;
    if (['das', 'darf', 'gps', 'inss', 'fgts', 'iss'].includes(taxType)) {
      onTaxApply(taxType, doc.taxResult.valor || 0, doc.taxResult.vencimento);
      updateDocument(doc.id, { status: 'applied' });
      toast.success(`${taxType.toUpperCase()} aplicado com sucesso!`);
    }
  };

  const handlePayrollApply = (doc: UploadedDocument) => {
    if (!doc.payrollResult || !onPayrollApply) return;
    
    onPayrollApply({
      total_folha: doc.payrollResult.total_folha || 0,
      encargos: doc.payrollResult.encargos || 0,
      prolabore: doc.payrollResult.prolabore || 0,
      num_funcionarios: doc.payrollResult.num_funcionarios || 0,
    });
    updateDocument(doc.id, { status: 'applied' });
    toast.success('Dados da folha aplicados com sucesso!');
  };

  const handleRemove = (id: string) => {
    setDocuments((prev) => prev.filter((doc) => doc.id !== id));
  };

  const pendingCount = documents.filter((d) => 
    ['queued', 'uploading', 'analyzing'].includes(d.status)
  ).length;

  const readyCount = documents.filter((d) => d.status === 'ready').length;
  const manualCount = documents.filter((d) => d.status === 'manual').length;

  // AI Status indicator component
  const AIStatusIndicator = () => {
    const statusConfig = {
      available: {
        icon: <Zap className="h-3 w-3" />,
        label: 'IA Disponível',
        className: 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700',
      },
      limited: {
        icon: <Wifi className="h-3 w-3" />,
        label: 'IA Limitada',
        className: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700',
      },
      unavailable: {
        icon: <WifiOff className="h-3 w-3" />,
        label: 'IA Indisponível',
        className: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700',
      },
      checking: {
        icon: <Loader2 className="h-3 w-3 animate-spin" />,
        label: 'Verificando...',
        className: 'bg-muted text-muted-foreground',
      },
    };

    const config = statusConfig[aiStatus];

    return (
      <Badge variant="outline" className={`gap-1 text-xs ${config.className}`}>
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <Card
        className={`border-2 border-dashed transition-colors cursor-pointer ${
          isDragOver 
            ? 'border-primary bg-primary/5' 
            : 'border-border hover:border-primary/50'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
      >
        <CardContent className="p-6">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp,.xml"
            multiple
            onChange={handleInputChange}
            className="hidden"
          />
          
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex items-center justify-between w-full">
              <div /> {/* Spacer */}
              <div className={`p-3 rounded-full ${isDragOver ? 'bg-primary/20' : 'bg-muted'}`}>
                <FolderUp className={`h-6 w-6 ${isDragOver ? 'text-primary' : 'text-muted-foreground'}`} />
              </div>
              <AIStatusIndicator />
            </div>
            
            <div>
              <p className="font-medium">
                Arraste guias tributárias ou folha de pagamento aqui
              </p>
              <p className="text-sm text-muted-foreground">
                DAS, DARF, GPS, FGTS, INSS, ISS, Folha de Pagamento, XML
              </p>
            </div>
            
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              <span>A IA identifica automaticamente e preenche os campos</span>
            </div>
            
            <Button variant="outline" size="sm" className="gap-2" onClick={(e) => e.stopPropagation()}>
              <Upload className="h-4 w-4" />
              Selecionar Arquivos
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Status Summary */}
      {documents.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {pendingCount > 0 && (
            <Badge variant="secondary" className="gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              {pendingCount} processando
            </Badge>
          )}
          {readyCount > 0 && (
            <Badge variant="outline" className="gap-1 border-green-500 text-green-600">
              {readyCount} pronto(s) para aplicar
            </Badge>
          )}
          {manualCount > 0 && (
            <Badge variant="outline" className="gap-1 border-amber-500 text-amber-600">
              <AlertTriangle className="h-3 w-3" />
              {manualCount} anexado(s) - preencher manual
            </Badge>
          )}
        </div>
      )}

      {/* Document Cards */}
      <div className="space-y-3">
        {documents.map((doc) => (
          <div key={doc.id}>
            {/* Error or Manual State */}
            {(doc.status === 'error' || doc.status === 'manual') ? (
              <Card className={`${doc.status === 'manual' ? 'border-amber-200 bg-amber-50 dark:bg-amber-900/20' : 'border-red-200 bg-red-50 dark:bg-red-900/20'}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <FileText className={`h-5 w-5 mt-0.5 ${doc.status === 'manual' ? 'text-amber-500' : 'text-red-500'}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium truncate ${doc.status === 'manual' ? 'text-amber-700 dark:text-amber-300' : 'text-red-700 dark:text-red-300'}`}>
                        {doc.fileName}
                      </p>
                      <p className={`text-sm ${doc.status === 'manual' ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                        {doc.errorMessage}
                      </p>
                      {doc.filePath && (
                        <p className="text-xs text-muted-foreground mt-1">
                          ✓ Arquivo anexado
                        </p>
                      )}
                      {doc.analysisResult?.attendantSuggestion && (
                        <p className="text-xs text-muted-foreground mt-1 italic">
                          💡 {doc.analysisResult.attendantSuggestion}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {doc.errorCode === 'RATE_LIMIT' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => retryDocument(doc)}
                          className="h-8 w-8 p-0"
                          title="Tentar novamente"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemove(doc.id)}
                        className="h-8 w-8 p-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : doc.type === 'payroll' && doc.payrollResult ? (
              <PayrollAnalysisCard
                result={doc.payrollResult}
                fileName={doc.fileName}
                status={doc.status as 'processing' | 'ready' | 'applied' | 'error'}
                onApply={() => handlePayrollApply(doc)}
                onRemove={() => handleRemove(doc.id)}
              />
            ) : doc.taxResult ? (
              <TaxGuideResultCard
                result={doc.taxResult}
                fileName={doc.fileName}
                status={doc.status as 'processing' | 'ready' | 'applied' | 'error'}
                onApply={() => handleTaxApply(doc)}
                onRemove={() => handleRemove(doc.id)}
              />
            ) : (
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <div>
                    <p className="font-medium">{doc.fileName}</p>
                    <p className="text-sm text-muted-foreground">
                      {doc.status === 'queued' && 'Na fila...'}
                      {doc.status === 'uploading' && 'Enviando...'}
                      {doc.status === 'analyzing' && 'Analisando com IA...'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
