import { useState, useRef, useCallback } from 'react';
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
  PlayCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { sanitizeFileName } from '@/lib/sanitizeFileName';
import { useQueryClient } from '@tanstack/react-query';
import { TaxGuideResultCard } from './TaxGuideResultCard';
import { PayrollAnalysisCard } from './PayrollAnalysisCard';
import { BatchApplyResultModal, BatchApplyResult, BatchResultItem } from './BatchApplyResultModal';
import { TaxDuplicateModal } from './TaxDuplicateModal';
import { PayrollAssignModal, Colaborador, PayrollData } from './PayrollAssignModal';
import { AIErrorExplanation } from '@/components/ui/AIErrorExplanation';
import type { TaxGuideOcrResult, PayrollOcrResult } from '@/services/accountingValidationService';
import { 
  analyzeAccountingDocument, 
  AnalyzedDocResult,
  isTaxDocument,
  isPayrollDocument,
  createPayableFromOcr,
  checkDuplicatePayable,
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

interface DuplicateWarning {
  doc: UploadedDocument;
  matchType: string;
  existingId: string;
  existingData: {
    id: string;
    beneficiario: string | null;
    valor: number | null;
    vencimento: string | null;
    status: string | null;
    created_at: string | null;
  } | null;
}

interface AccountingSmartUploadProps {
  unitId: string;
  ano: number;
  mes: number;
  onTaxApply?: (taxType: TaxType, valor: number, vencimento: string | null) => void;
  onPayrollApply?: (data: { total_folha: number; encargos: number; prolabore: number; num_funcionarios: number }) => void;
  onPayableCreated?: (payableId: string) => void;
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

// Category IDs for payroll components (tax_group = 'PESSOAL', entra_fator_r = true)
const PAYROLL_CATEGORY_MAP: Record<string, string> = {
  salarios: 'e1bdfa89-c44a-4115-93f5-b20c4c4094df',       // Salários
  prolabore: '4cd1d4f5-e585-46aa-8306-c2162933f995',     // Pró-labore
  encargos: '073410f4-2c9c-44cc-abd8-1ac7e7b6d814',      // INSS Patronal
};

export function AccountingSmartUpload({
  unitId,
  ano,
  mes,
  onTaxApply,
  onPayrollApply,
  onPayableCreated,
}: AccountingSmartUploadProps) {
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [aiStatus, setAiStatus] = useState<AIStatus>('available');
  const [creatingPayableFor, setCreatingPayableFor] = useState<string | null>(null);
  const [isApplyingAll, setIsApplyingAll] = useState(false);
  const [batchResult, setBatchResult] = useState<BatchApplyResult | null>(null);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<DuplicateWarning | null>(null);
  const [forcingDuplicate, setForcingDuplicate] = useState(false);
  const [aiError, setAiError] = useState<{ message: string; context?: Record<string, any> } | null>(null);
  
  // Payroll assignment modal states
  const [showPayrollModal, setShowPayrollModal] = useState(false);
  const [pendingPayrollDoc, setPendingPayrollDoc] = useState<UploadedDocument | null>(null);
  const [payrollColaboradores, setPayrollColaboradores] = useState<Colaborador[]>([]);
  const [payrollModalLoading, setPayrollModalLoading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const queryClient = useQueryClient();

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
      
      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        
        // Provide specific error messages for common storage issues
        if (uploadError.message?.includes('not found') || uploadError.message?.includes('Bucket')) {
          throw new Error('Erro de configuração de storage. Contate o administrador.');
        }
        if (uploadError.message?.includes('mime') || uploadError.message?.includes('type')) {
          throw new Error('Tipo de arquivo não suportado. Use PDF, imagem ou XML.');
        }
        if (uploadError.message?.includes('size') || uploadError.message?.includes('large')) {
          throw new Error('Arquivo muito grande. O limite é 10MB.');
        }
        if (uploadError.message?.includes('auth') || uploadError.message?.includes('JWT')) {
          throw new Error('Sessão expirada. Faça login novamente.');
        }
        throw uploadError;
      }
      
      console.log('[processDocument] Upload success, setting filePath:', {
        docId: id,
        fileName: file.name,
        filePath,
        timestamp: Date.now()
      });
      updateDocument(id, { filePath });
      
      // 2. Analyze with unified AI service (same as Reception)
      console.log('[processDocument] Starting analysis:', { docId: id, filePath });
      updateDocument(id, { status: 'analyzing', filePath }); // Preservar filePath
      
      const result = await analyzeAccountingDocument(file, unitId);
      console.log('[processDocument] Analysis complete:', {
        docId: id,
        filePath,
        documentType: result.documentType
      });
      
      // 3. Determine document type and convert result
      const docType = result.documentType;
      
      if (isTaxDocument(docType)) {
        const taxResult = convertToTaxResult(result);
        if (taxResult) {
          console.log('[processDocument] Tax doc ready, preserving filePath:', { docId: id, filePath, taxType: taxResult.tipo_documento });
          updateDocument(id, { 
            status: 'ready', 
            type: 'tax',
            analysisResult: result,
            taxResult,
            filePath, // CORREÇÃO: Preservar filePath
          });
          updateAIStatus(); // AI is working
        } else {
          console.log('[processDocument] Tax doc manual (no taxResult), preserving filePath:', { docId: id, filePath });
          updateDocument(id, { 
            status: 'manual', 
            type: 'other',
            analysisResult: result,
            errorMessage: 'Tipo de guia não identificado. Preencha manualmente.',
            filePath, // CORREÇÃO: Preservar filePath
          });
        }
      } else if (isPayrollDocument(docType)) {
        const payrollResult = convertToPayrollResult(result);
        console.log('[processDocument] Payroll doc ready, preserving filePath:', { docId: id, filePath });
        updateDocument(id, { 
          status: 'ready', 
          type: 'payroll',
          analysisResult: result,
          payrollResult,
          filePath, // CORREÇÃO: Preservar filePath
        });
        updateAIStatus(); // AI is working
      } else {
        // Unknown document type - still show result but as manual
        console.log('[processDocument] Unknown doc type, preserving filePath:', { docId: id, filePath, docType });
        updateDocument(id, { 
          status: 'manual', 
          type: 'other',
          analysisResult: result,
          errorMessage: `Documento identificado como "${result.documentType}". Preencha os campos manualmente.`,
          filePath, // CORREÇÃO: Preservar filePath
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

  const handleTaxApply = async (doc: UploadedDocument, skipDuplicateCheck = false) => {
    if (!doc.taxResult || !onTaxApply) return;
    
    const taxType = doc.taxResult.tipo_documento as TaxType;
    if (!['das', 'darf', 'gps', 'inss', 'fgts', 'iss'].includes(taxType)) return;
    
    setCreatingPayableFor(doc.id);
    setAiError(null);
    
    // Debug: Log complete document state before processing
    console.log('[handleTaxApply] Full document state:', JSON.stringify({
      id: doc.id,
      fileName: doc.fileName,
      filePath: doc.filePath,
      status: doc.status,
      type: doc.type,
      hasAnalysisResult: !!doc.analysisResult,
      hasTaxResult: !!doc.taxResult,
      taxResultDetails: doc.taxResult ? {
        tipo_documento: doc.taxResult.tipo_documento,
        valor: doc.taxResult.valor,
        competencia: doc.taxResult.competencia,
      } : null,
    }, null, 2));
    
    try {
      // 0. CHECK FOR DUPLICATES FIRST (before saving anything)
      if (!skipDuplicateCheck && doc.analysisResult) {
        const duplicateResult = await checkDuplicatePayable(
          doc.analysisResult.issuerCnpj,
          doc.analysisResult.documentNumber,
          doc.analysisResult.totalValue,
          doc.analysisResult.dueDate,
          doc.analysisResult.codigoBarras,
          doc.analysisResult.linhaDigitavel
        );
        
        if (duplicateResult.isDuplicate && duplicateResult.existingId) {
          console.log('[handleTaxApply] Duplicate detected:', duplicateResult);
          
          // Fetch existing payable data for the modal
          const { data: existingPayable } = await supabase
            .from('payables')
            .select('id, beneficiario, valor, vencimento, status, created_at')
            .eq('id', duplicateResult.existingId)
            .single();
          
          // Show duplicate warning modal - BLOCK the process
          setDuplicateWarning({
            doc,
            matchType: duplicateResult.matchType || 'dados',
            existingId: duplicateResult.existingId,
            existingData: existingPayable,
          });
          setCreatingPayableFor(null);
          return; // STOP here - user must decide
        }
      }
      
      // 1. Insert into accounting_lab_documents (for visibility in tax documents list)
      const competencia = doc.taxResult?.competencia;
      const valorDoc = doc.analysisResult?.totalValue || doc.taxResult?.valor || 0;
      const vencimentoDoc = doc.analysisResult?.dueDate || doc.taxResult?.vencimento || 'N/A';
      
      // CHECK FOR DUPLICATE IN accounting_lab_documents FIRST
      const docAno = competencia?.ano || ano;
      const docMes = competencia?.mes || mes;
      
      const { data: existingLabDoc } = await supabase
        .from('accounting_lab_documents')
        .select('id, valor, created_at')
        .eq('unit_id', unitId)
        .eq('tipo', taxType)
        .eq('valor', valorDoc)
        .eq('mes', docMes)
        .eq('ano', docAno)
        .maybeSingle();
      
      if (existingLabDoc) {
        toast.warning(`Este ${taxType.toUpperCase()} (R$ ${valorDoc.toFixed(2)}) já foi cadastrado em ${docMes.toString().padStart(2, '0')}/${docAno}.`);
        updateDocument(doc.id, { status: 'error', errorMessage: 'Documento duplicado em accounting_lab_documents' });
        setCreatingPayableFor(null);
        return; // BLOCK insertion
      }
      
      let insertedDocId: string | null = null;
      try {
        const { data: insertedDoc } = await supabase.from('accounting_lab_documents').insert({
          unit_id: unitId,
          ano: competencia?.ano || ano,
          mes: competencia?.mes || mes,
          tipo: taxType,
          file_name: doc.fileName,
          file_path: doc.filePath || null,
          valor: valorDoc,
          descricao: `${taxType.toUpperCase()} - Venc: ${vencimentoDoc}`,
          created_by: user?.id,
          payable_status: doc.filePath && doc.analysisResult ? 'pending' : 'skipped',
        }).select('id').single();
        insertedDocId = insertedDoc?.id || null;
        console.log('[handleTaxApply] Tax document saved to accounting_lab_documents');
      } catch (insertError: any) {
        const errorMessage = insertError?.message || String(insertError);
        console.error('[handleTaxApply] Error inserting tax document:', {
          error: errorMessage,
          tipo: taxType,
          ano: docAno,
          mes: docMes,
        });
        
        // Show AI-powered error explanation
        setAiError({
          message: errorMessage,
          context: { 
            tipo: taxType, 
            ano: competencia?.ano || ano, 
            mes: competencia?.mes || mes,
            action: 'salvar_documento_tributario'
          },
        });
      }
      
      // 2. Try to create the payable (if possible)
      let payableCreated = false;
      
      // Check if we have all required data for payable creation
      if (!doc.analysisResult) {
        console.warn('[handleTaxApply] Missing analysisResult - payable will NOT be created');
        toast.warning('Dados de análise ausentes. Conta a pagar não será criada.');
      } else if (!doc.filePath) {
        console.warn('[handleTaxApply] Missing filePath - payable will NOT be created');
        toast.warning('Arquivo não foi salvo no storage. Conta a pagar não será criada.');
      }
      
      if (doc.analysisResult && doc.filePath) {
        const description = `Guia ${taxType.toUpperCase()} - ${mes.toString().padStart(2, '0')}/${ano}`;
        
        const result = await createPayableFromOcr(
          doc.analysisResult,
          unitId,
          doc.filePath,
          doc.fileName,
          { description }
        );
        
        if (result.success) {
          payableCreated = true;
          onPayableCreated?.(result.id!);
          // Update document with payable reference
          if (insertedDocId) {
            await supabase.from('accounting_lab_documents')
              .update({ payable_id: result.id, payable_status: 'created' })
              .eq('id', insertedDocId);
          }
        } else if (result.error === 'duplicate') {
          // Duplicate found - still apply values, just warn
          const matchLabels: Record<string, string> = {
            codigo_barras: 'código de barras',
            linha_digitavel: 'linha digitável',
            cnpj_document: 'CNPJ e número do documento',
            cnpj_valor_vencimento: 'CNPJ, valor e vencimento',
          };
          const matchLabel = result.matchType ? matchLabels[result.matchType] || result.matchType : 'dados';
          
          toast.warning(`Conta já existe (${matchLabel}). Valores aplicados no painel.`);
        } else {
          // Other error creating payable - log and update document status
          console.warn('Could not create payable:', result.error);
          if (insertedDocId) {
            await supabase.from('accounting_lab_documents')
              .update({ payable_status: 'failed' })
              .eq('id', insertedDocId);
          }
        }
      }
      
      // 2. Apply values to the accounting panel
      onTaxApply(taxType, doc.taxResult.valor || 0, doc.taxResult.vencimento);
      updateDocument(doc.id, { status: 'applied' });
      
      if (payableCreated) {
        toast.success(
          <div className="flex flex-col gap-1">
            <span>{taxType.toUpperCase()} aplicado e conta a pagar criada!</span>
            <a 
              href="/payables/tax-documents" 
              className="text-xs text-primary underline hover:no-underline"
            >
              Ver em Documentos Tributários →
            </a>
          </div>
        );
      } else if (!doc.analysisResult || !doc.filePath) {
        toast.success(`${taxType.toUpperCase()} aplicado com sucesso!`);
      }
    } catch (error: any) {
      console.error('Error in handleTaxApply:', error);
      // Even if payable creation failed, still apply values
      onTaxApply(taxType, doc.taxResult.valor || 0, doc.taxResult.vencimento);
      updateDocument(doc.id, { status: 'applied' });
      toast.success(`${taxType.toUpperCase()} aplicado. (Erro ao criar conta a pagar)`);
    } finally {
      setCreatingPayableFor(null);
    }
  };

  // Returns true if modal was opened (batch needs to wait)
  const handlePayrollApply = async (doc: UploadedDocument): Promise<boolean> => {
    if (!doc.payrollResult || !onPayrollApply) return false;
    
    const competencia = doc.payrollResult.competencia;
    const docAno = competencia?.ano || ano;
    const docMes = competencia?.mes || mes;
    
    try {
      // 1. Buscar funcionários da unidade com salário cadastrado
      const { data: funcionarios } = await supabase
        .from('partners')
        .select('id, name, expected_amount, default_category_id')
        .eq('unit_id', unitId)
        .eq('type', 'FUNCIONARIO')
        .eq('active', true);
      
      // 2. Se existirem colaboradores, abrir modal de vinculação
      if (funcionarios && funcionarios.length > 0) {
        setPayrollColaboradores(funcionarios.map(f => ({
          id: f.id,
          name: f.name,
          expected_amount: f.expected_amount,
          default_category_id: f.default_category_id,
        })));
        
        setPendingPayrollDoc(doc);
        setShowPayrollModal(true);
        return true; // Modal opened, batch should stop
      }
      
      // 3. Se não existirem colaboradores, criar payable genérico automaticamente
      await createGenericPayroll(doc);
      return false; // No modal, batch can continue
      
    } catch (err: any) {
      console.error('[handlePayrollApply] Exception:', err);
      toast.error('Erro ao processar folha de pagamento');
      return false;
    }
  };

  // Create generic payroll (when no colaboradores exist)
  const createGenericPayroll = async (doc: UploadedDocument) => {
    if (!doc.payrollResult || !onPayrollApply) return;
    
    const competencia = doc.payrollResult.competencia;
    const docAno = competencia?.ano || ano;
    const docMes = competencia?.mes || mes;
    const competenciaLabel = `${docMes.toString().padStart(2, '0')}/${docAno}`;
    const lastDayOfMonth = new Date(docAno, docMes, 0).toISOString().split('T')[0];
    
    let payablesCreated = 0;
    
    try {
      // Check for existing payroll document
      const { data: existingPayroll } = await supabase
        .from('accounting_lab_documents')
        .select('id')
        .eq('unit_id', unitId)
        .eq('tipo', 'folha_pagamento')
        .eq('mes', docMes)
        .eq('ano', docAno)
        .maybeSingle();
      
      // Save to accounting_lab_documents
      const labDocData = {
        unit_id: unitId,
        ano: docAno,
        mes: docMes,
        tipo: 'folha_pagamento',
        file_name: doc.fileName,
        file_path: doc.filePath || null,
        valor: doc.payrollResult.total_folha,
        descricao: `Folha de Pagamento - ${doc.payrollResult.num_funcionarios || '?'} funcionário(s) (genérico)`,
        created_by: user?.id,
        payable_status: 'pending',
      };
      
      if (existingPayroll) {
        await supabase.from('accounting_lab_documents').update(labDocData).eq('id', existingPayroll.id);
      } else {
        await supabase.from('accounting_lab_documents').insert(labDocData);
      }
      
      // Check existing payables
      const { data: existingPayables } = await supabase
        .from('payables')
        .select('id, category_id')
        .eq('unit_id', unitId)
        .gte('vencimento', `${docAno}-${docMes.toString().padStart(2, '0')}-01`)
        .lte('vencimento', lastDayOfMonth);
      
      const existingCategoryIds = new Set(existingPayables?.map(p => p.category_id) || []);
      
      // Create generic payable for total_folha
      if (!existingCategoryIds.has(PAYROLL_CATEGORY_MAP.salarios) && (doc.payrollResult.total_folha || 0) > 0) {
        const { error } = await supabase.from('payables').insert({
          beneficiario: 'Folha de Pagamento',
          valor: doc.payrollResult.total_folha || 0,
          vencimento: lastDayOfMonth,
          description: `Salários - ${competenciaLabel} (${doc.payrollResult.num_funcionarios || '?'} funcionários)`,
          tipo: 'titulo',
          unit_id: unitId,
          category_id: PAYROLL_CATEGORY_MAP.salarios,
          status: 'PENDENTE',
          file_path: doc.filePath || null,
          file_name: doc.fileName,
          created_by: user?.id,
          nf_vinculacao_status: 'nao_requer',
        });
        if (!error) payablesCreated++;
      }
      
      // Pró-labore
      if (doc.payrollResult.prolabore && doc.payrollResult.prolabore > 0 && !existingCategoryIds.has(PAYROLL_CATEGORY_MAP.prolabore)) {
        const { error } = await supabase.from('payables').insert({
          beneficiario: 'Pró-labore',
          valor: doc.payrollResult.prolabore,
          vencimento: lastDayOfMonth,
          description: `Pró-labore - ${competenciaLabel}`,
          tipo: 'titulo',
          unit_id: unitId,
          category_id: PAYROLL_CATEGORY_MAP.prolabore,
          status: 'PENDENTE',
          file_path: doc.filePath || null,
          created_by: user?.id,
          nf_vinculacao_status: 'nao_requer',
        });
        if (!error) payablesCreated++;
      }
      
      // Encargos
      if (doc.payrollResult.encargos && doc.payrollResult.encargos > 0 && !existingCategoryIds.has(PAYROLL_CATEGORY_MAP.encargos)) {
        const { error } = await supabase.from('payables').insert({
          beneficiario: 'Encargos Patronais',
          valor: doc.payrollResult.encargos,
          vencimento: lastDayOfMonth,
          description: `Encargos - ${competenciaLabel}`,
          tipo: 'titulo',
          unit_id: unitId,
          category_id: PAYROLL_CATEGORY_MAP.encargos,
          status: 'PENDENTE',
          file_path: doc.filePath || null,
          created_by: user?.id,
          nf_vinculacao_status: 'nao_requer',
        });
        if (!error) payablesCreated++;
      }
      
      // Apply values to form
      onPayrollApply({
        total_folha: doc.payrollResult.total_folha || 0,
        encargos: doc.payrollResult.encargos || 0,
        prolabore: doc.payrollResult.prolabore || 0,
        num_funcionarios: doc.payrollResult.num_funcionarios || 0,
      });
      updateDocument(doc.id, { status: 'applied' });
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['accounting-dashboard', ano, mes] });
      queryClient.invalidateQueries({ queryKey: ['payables'] });
      
      if (payablesCreated > 0) {
        toast.success(`Folha genérica criada para ${competenciaLabel}! ${payablesCreated} conta(s) a pagar.`);
      } else {
        toast.info(`Folha de ${competenciaLabel} já estava cadastrada.`);
      }
    } catch (err: any) {
      console.error('[createGenericPayroll] Exception:', err);
      toast.error('Erro ao criar folha genérica');
    }
  };

  // Handle payroll modal confirm (create payables per colaborador)
  const handlePayrollConfirm = async (selectedIds: string[]) => {
    if (!pendingPayrollDoc?.payrollResult || !onPayrollApply) return;
    
    setPayrollModalLoading(true);
    
    const doc = pendingPayrollDoc;
    const competencia = doc.payrollResult.competencia;
    const docAno = competencia?.ano || ano;
    const docMes = competencia?.mes || mes;
    const competenciaLabel = `${docMes.toString().padStart(2, '0')}/${docAno}`;
    const lastDayOfMonth = new Date(docAno, docMes, 0).toISOString().split('T')[0];
    
    let payablesCreated = 0;
    const errors: string[] = [];
    
    try {
      // 1. Save to accounting_lab_documents
      const { data: existingPayroll } = await supabase
        .from('accounting_lab_documents')
        .select('id')
        .eq('unit_id', unitId)
        .eq('tipo', 'folha_pagamento')
        .eq('mes', docMes)
        .eq('ano', docAno)
        .maybeSingle();
      
      const labDocData = {
        unit_id: unitId,
        ano: docAno,
        mes: docMes,
        tipo: 'folha_pagamento',
        file_name: doc.fileName,
        file_path: doc.filePath || null,
        valor: doc.payrollResult.total_folha,
        descricao: `Folha de Pagamento - ${selectedIds.length} colaborador(es)`,
        created_by: user?.id,
        payable_status: 'pending',
      };
      
      if (existingPayroll) {
        await supabase.from('accounting_lab_documents').update(labDocData).eq('id', existingPayroll.id);
      } else {
        await supabase.from('accounting_lab_documents').insert(labDocData);
      }
      
      // 2. Check existing payables to avoid duplicates
      const { data: existingPayables } = await supabase
        .from('payables')
        .select('id, category_id, beneficiario')
        .eq('unit_id', unitId)
        .gte('vencimento', `${docAno}-${docMes.toString().padStart(2, '0')}-01`)
        .lte('vencimento', lastDayOfMonth);
      
      const existingBeneficiarios = new Set(existingPayables?.map(p => p.beneficiario) || []);
      const existingCategoryIds = new Set(existingPayables?.map(p => p.category_id) || []);
      
      // 3. Create payable PER selected colaborador
      for (const collabId of selectedIds) {
        const collab = payrollColaboradores.find(c => c.id === collabId);
        if (!collab || !collab.expected_amount) continue;
        
        if (existingBeneficiarios.has(collab.name)) {
          console.log(`[handlePayrollConfirm] Payable already exists for ${collab.name}`);
          continue;
        }
        
        const { error: payableError } = await supabase
          .from('payables')
          .insert({
            beneficiario: collab.name,
            valor: collab.expected_amount,
            vencimento: lastDayOfMonth,
            description: `Salário ${collab.name} - ${competenciaLabel}`,
            tipo: 'titulo',
            unit_id: unitId,
            category_id: collab.default_category_id || PAYROLL_CATEGORY_MAP.salarios,
            status: 'PENDENTE',
            file_path: doc.filePath || null,
            file_name: doc.fileName,
            created_by: user?.id,
            nf_vinculacao_status: 'nao_requer',
          });
        
        if (payableError) {
          console.error(`[handlePayrollConfirm] Error for ${collab.name}:`, payableError);
          errors.push(collab.name);
        } else {
          payablesCreated++;
        }
      }
      
      // 4. Pró-labore (if in OCR result)
      if (doc.payrollResult.prolabore && doc.payrollResult.prolabore > 0 && !existingCategoryIds.has(PAYROLL_CATEGORY_MAP.prolabore)) {
        const { error } = await supabase.from('payables').insert({
          beneficiario: 'Pró-labore',
          valor: doc.payrollResult.prolabore,
          vencimento: lastDayOfMonth,
          description: `Pró-labore - ${competenciaLabel}`,
          tipo: 'titulo',
          unit_id: unitId,
          category_id: PAYROLL_CATEGORY_MAP.prolabore,
          status: 'PENDENTE',
          file_path: doc.filePath || null,
          created_by: user?.id,
          nf_vinculacao_status: 'nao_requer',
        });
        if (!error) payablesCreated++;
      }
      
      // 5. Encargos
      if (doc.payrollResult.encargos && doc.payrollResult.encargos > 0 && !existingCategoryIds.has(PAYROLL_CATEGORY_MAP.encargos)) {
        const { error } = await supabase.from('payables').insert({
          beneficiario: 'Encargos Patronais',
          valor: doc.payrollResult.encargos,
          vencimento: lastDayOfMonth,
          description: `Encargos - ${competenciaLabel}`,
          tipo: 'titulo',
          unit_id: unitId,
          category_id: PAYROLL_CATEGORY_MAP.encargos,
          status: 'PENDENTE',
          file_path: doc.filePath || null,
          created_by: user?.id,
          nf_vinculacao_status: 'nao_requer',
        });
        if (!error) payablesCreated++;
      }
      
      // 6. Update lab document status
      if (existingPayroll && payablesCreated > 0) {
        await supabase
          .from('accounting_lab_documents')
          .update({ payable_status: 'created' })
          .eq('id', existingPayroll.id);
      }
      
      // 7. Close modal and update UI
      setShowPayrollModal(false);
      setPendingPayrollDoc(null);
      updateDocument(doc.id, { status: 'applied' });
      
      // 8. Apply values to form
      onPayrollApply({
        total_folha: doc.payrollResult.total_folha || 0,
        encargos: doc.payrollResult.encargos || 0,
        prolabore: doc.payrollResult.prolabore || 0,
        num_funcionarios: selectedIds.length,
      });
      
      // 9. Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['accounting-dashboard', ano, mes] });
      queryClient.invalidateQueries({ queryKey: ['payables'] });
      
      // 10. Feedback
      if (errors.length > 0) {
        toast.error(`Folha aplicada com erros: ${errors.join(', ')}`);
      } else if (payablesCreated > 0) {
        toast.success(
          <div className="flex flex-col gap-1">
            <span>Folha aplicada para {competenciaLabel}!</span>
            <span className="text-xs text-muted-foreground">
              {payablesCreated} conta(s) a pagar criada(s) para {selectedIds.length} colaborador(es)
            </span>
          </div>
        );
      }
    } catch (err: any) {
      console.error('[handlePayrollConfirm] Exception:', err);
      toast.error('Erro ao vincular colaboradores');
    } finally {
      setPayrollModalLoading(false);
    }
  };

  // Handle payroll modal skip (create generic payable)
  const handlePayrollSkip = async () => {
    if (!pendingPayrollDoc) return;
    
    setPayrollModalLoading(true);
    try {
      await createGenericPayroll(pendingPayrollDoc);
      setShowPayrollModal(false);
      setPendingPayrollDoc(null);
    } finally {
      setPayrollModalLoading(false);
    }
  };

  const handleRemove = (id: string) => {
    setDocuments((prev) => prev.filter((doc) => doc.id !== id));
  };

  const handleCreatePayable = async (doc: UploadedDocument) => {
    if (!doc.analysisResult || !doc.filePath) {
      toast.error('Dados insuficientes para criar conta a pagar');
      return;
    }
    
    setCreatingPayableFor(doc.id);
    
    try {
      const taxType = doc.taxResult?.tipo_documento?.toUpperCase() || 'fiscal';
      const description = `Guia ${taxType} - ${mes.toString().padStart(2, '0')}/${ano}`;
      
      const result = await createPayableFromOcr(
        doc.analysisResult,
        unitId,
        doc.filePath,
        doc.fileName,
        { description }
      );
      
      // Insert into accounting_lab_documents first (for visibility)
      const docTipo = doc.taxResult?.tipo_documento || 'outro';
      const competencia = doc.taxResult?.competencia;
      
      try {
        await supabase.from('accounting_lab_documents').insert({
          unit_id: unitId,
          ano: competencia?.ano || ano,
          mes: competencia?.mes || mes,
          tipo: docTipo,
          file_name: doc.fileName,
          file_path: doc.filePath,
          valor: doc.analysisResult.totalValue,
          descricao: `${taxType} - Venc: ${doc.analysisResult.dueDate || 'N/A'}`,
          created_by: user?.id,
        });
      } catch (insertError) {
        console.error('[handleCreatePayable] Error inserting tax document:', insertError);
      }
      
      if (result.success) {
        toast.success(
          <div className="flex flex-col gap-1">
            <span>Conta a pagar criada com sucesso!</span>
            <a 
              href="/payables/tax-documents" 
              className="text-xs text-primary underline hover:no-underline"
            >
              Ver em Documentos Tributários →
            </a>
          </div>
        );
        updateDocument(doc.id, { status: 'applied' });
        onPayableCreated?.(result.id!);
      } else if (result.error === 'duplicate') {
        const matchLabels: Record<string, string> = {
          codigo_barras: 'código de barras',
          linha_digitavel: 'linha digitável',
          cnpj_document: 'CNPJ e número do documento',
          cnpj_valor_vencimento: 'CNPJ, valor e vencimento',
        };
        const matchLabel = result.matchType ? matchLabels[result.matchType] || result.matchType : 'dados';
        
        toast.warning(
          <div className="flex flex-col gap-1">
            <span>Já existe uma conta a pagar com o mesmo {matchLabel}.</span>
            {result.id && (
              <a 
                href={`/payables/boletos?highlight=${result.id}`} 
                className="text-xs text-primary underline hover:no-underline"
              >
                Abrir registro existente →
              </a>
            )}
          </div>
        );
      } else {
        toast.error('Erro ao criar conta a pagar: ' + result.error);
      }
    } catch (error: any) {
      console.error('Error creating payable:', error);
      // Check for unique constraint violation (duplicate in database)
      if (error?.code === '23505' || error?.message?.includes('unique') || error?.message?.includes('duplicate')) {
        toast.warning('Este documento já foi cadastrado anteriormente (código de barras/linha digitável duplicada).');
      } else {
        toast.error('Erro ao criar conta a pagar');
      }
    } finally {
      setCreatingPayableFor(null);
    }
  };

  // Handle batch apply all ready documents
  const handleApplyAll = async () => {
    const readyDocs = documents.filter((d) => d.status === 'ready');
    if (readyDocs.length === 0) return;
    
    setIsApplyingAll(true);
    const results: BatchResultItem[] = [];
    
    for (const doc of readyDocs) {
      try {
        if (doc.type === 'tax' && doc.taxResult) {
          const taxType = doc.taxResult.tipo_documento as TaxType;
          if (!['das', 'darf', 'gps', 'inss', 'fgts', 'iss'].includes(taxType)) continue;
          
          let status: BatchResultItem['status'] = 'success';
          let payableSkipped = false;
          
          // Debug: Log document state
          console.log('[handleApplyAll] Processing document:', {
            id: doc.id,
            fileName: doc.fileName,
            hasAnalysisResult: !!doc.analysisResult,
            hasFilePath: !!doc.filePath,
            filePath: doc.filePath,
          });
          
          // Check for missing data - show warning toast immediately
          if (!doc.analysisResult || !doc.filePath) {
            console.warn('[handleApplyAll] Missing data for payable:', {
              docId: doc.id,
              fileName: doc.fileName,
              hasAnalysisResult: !!doc.analysisResult,
              hasFilePath: !!doc.filePath,
            });
            payableSkipped = true;
            
            // Show immediate warning toast
            const tipoGuia = doc.taxResult?.tipo_documento?.toUpperCase() || 'DOCUMENTO';
            toast.warning(
              `${tipoGuia}: Arquivo não salvo corretamente. Valores aplicados apenas ao painel, conta a pagar não criada.`,
              { duration: 6000 }
            );
          }
          
          // ALWAYS insert into accounting_lab_documents first (for visibility)
          const competencia = doc.taxResult?.competencia;
          const valorDoc = doc.analysisResult?.totalValue || doc.taxResult?.valor || 0;
          const vencimentoDoc = doc.analysisResult?.dueDate || doc.taxResult?.vencimento || 'N/A';
          
          try {
            await supabase.from('accounting_lab_documents').insert({
              unit_id: unitId,
              ano: competencia?.ano || ano,
              mes: competencia?.mes || mes,
              tipo: taxType,
              file_name: doc.fileName,
              file_path: doc.filePath || null,
              valor: valorDoc,
              descricao: `${taxType.toUpperCase()} - Venc: ${vencimentoDoc}`,
              created_by: user?.id,
            });
          } catch (insertError) {
            console.error('[handleApplyAll] Error inserting tax document:', insertError);
          }
          
          // Try to create payable
          if (doc.analysisResult && doc.filePath) {
            const description = `Guia ${taxType.toUpperCase()} - ${mes.toString().padStart(2, '0')}/${ano}`;
            
            const result = await createPayableFromOcr(
              doc.analysisResult,
              unitId,
              doc.filePath,
              doc.fileName,
              { description }
            );
            
            if (result.success) {
              onPayableCreated?.(result.id!);
            } else if (result.error === 'duplicate') {
              status = 'duplicate';
            }
          } else if (payableSkipped) {
            // Payable was skipped due to missing data but values will still be applied
            status = 'success'; // Values applied, just no payable
            console.log('[handleApplyAll] Payable skipped, values will be applied to panel only');
          }
          
          // Apply to panel
          if (onTaxApply) {
            onTaxApply(taxType, doc.taxResult.valor || 0, doc.taxResult.vencimento);
          }
          updateDocument(doc.id, { status: 'applied' });
          
          results.push({
            type: taxType,
            valor: doc.taxResult.valor || 0,
            status,
            fileName: doc.fileName,
            payableSkipped,
          });
        } else if (doc.type === 'payroll' && doc.payrollResult && onPayrollApply) {
          // For payroll, call handlePayrollApply which will open the modal if colaboradores exist
          // Note: In batch mode, we'll process the first payroll document and stop if modal opens
          const modalOpened = await handlePayrollApply(doc);
          
          // If modal opened, stop batch processing - user needs to confirm colaborador assignment
          if (modalOpened) {
            toast.info('Folha de pagamento requer vinculação de colaboradores. Complete o processo no modal aberto.');
            results.push({
              type: 'folha',
              valor: doc.payrollResult.total_folha || 0,
              status: 'success',
              fileName: doc.fileName,
              payableSkipped: true,
            });
            break;
          }
          
          results.push({
            type: 'folha',
            valor: doc.payrollResult.total_folha || 0,
            status: 'success',
            fileName: doc.fileName,
          });
        }
      } catch (error: any) {
        console.error('Error in batch apply:', error);
        results.push({
          type: doc.taxResult?.tipo_documento || 'documento',
          valor: doc.taxResult?.valor || doc.payrollResult?.total_folha || 0,
          status: 'error',
          fileName: doc.fileName,
          errorMessage: error.message,
        });
      }
    }
    
    // Calculate summary
    const successItems = results.filter(r => r.status === 'success' && !r.payableSkipped);
    const skippedItems = results.filter(r => r.status === 'success' && r.payableSkipped);
    const duplicateItems = results.filter(r => r.status === 'duplicate');
    const errorItems = results.filter(r => r.status === 'error');
    
    // Log summary for debugging
    console.log('[handleApplyAll] Summary:', {
      total: results.length,
      payablesCreated: successItems.length,
      payablesSkipped: skippedItems.length,
      duplicates: duplicateItems.length,
      errors: errorItems.length,
    });
    
    setBatchResult({
      applied: results,
      totalApplied: results.filter(r => r.status !== 'error').reduce((sum, r) => sum + r.valor, 0),
      payablesCreated: successItems.length,
      payablesSkipped: skippedItems.length,
      duplicatesFound: duplicateItems.length,
      errorsCount: errorItems.length,
    });
    setShowBatchModal(true);
    setIsApplyingAll(false);
  };

  // Handle inline edit save
  const handleEditSave = (docId: string, updatedResult: TaxGuideOcrResult) => {
    updateDocument(docId, { 
      taxResult: updatedResult,
    });
    
    // Also update analysisResult values if present
    setDocuments((prev) =>
      prev.map((doc) => {
        if (doc.id !== docId || !doc.analysisResult) return doc;
        return {
          ...doc,
          analysisResult: {
            ...doc.analysisResult,
            totalValue: updatedResult.valor,
            dueDate: updatedResult.vencimento,
          },
        };
      })
    );
    toast.success('Valores atualizados');
  };

  // Handle duplicate warning - cancel
  const handleDuplicateCancel = () => {
    if (duplicateWarning) {
      updateDocument(duplicateWarning.doc.id, { status: 'ready' }); // Keep as ready
    }
    setDuplicateWarning(null);
  };

  // Handle duplicate warning - force continue anyway
  const handleDuplicateForceContinue = async () => {
    if (!duplicateWarning) return;
    
    setForcingDuplicate(true);
    try {
      // Call handleTaxApply again with skipDuplicateCheck=true
      await handleTaxApply(duplicateWarning.doc, true);
      setDuplicateWarning(null);
    } finally {
      setForcingDuplicate(false);
    }
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

      {/* Status Summary + Apply All Button */}
      {documents.length > 0 && (
        <div className="flex items-center justify-between gap-2 flex-wrap">
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
          
          {/* Apply All Button */}
          {readyCount >= 2 && (
            <Button 
              onClick={handleApplyAll}
              disabled={isApplyingAll || pendingCount > 0}
              className="gap-2"
            >
              {isApplyingAll ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <PlayCircle className="h-4 w-4" />
              )}
              Aplicar Todos ({readyCount})
            </Button>
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
                isApplying={creatingPayableFor === doc.id || isApplyingAll}
                onRemove={() => handleRemove(doc.id)}
                onEditSave={(updated) => handleEditSave(doc.id, updated)}
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
      
      {/* Batch Result Modal */}
      <BatchApplyResultModal
        open={showBatchModal}
        onOpenChange={setShowBatchModal}
        result={batchResult}
      />
      
      {/* Duplicate Warning Modal */}
      <TaxDuplicateModal
        open={!!duplicateWarning}
        onOpenChange={(open) => !open && handleDuplicateCancel()}
        documentName={duplicateWarning?.doc.fileName || ''}
        matchType={duplicateWarning?.matchType || ''}
        existingData={duplicateWarning?.existingData || null}
        onCancel={handleDuplicateCancel}
        onForceContinue={handleDuplicateForceContinue}
        isLoading={forcingDuplicate}
      />
      
      {/* Payroll Assignment Modal */}
      {pendingPayrollDoc?.payrollResult && (
        <PayrollAssignModal
          open={showPayrollModal}
          onOpenChange={(open) => {
            if (!open) {
              setShowPayrollModal(false);
              setPendingPayrollDoc(null);
            }
          }}
          colaboradores={payrollColaboradores}
          payrollData={{
            total_folha: pendingPayrollDoc.payrollResult.total_folha || 0,
            num_funcionarios: pendingPayrollDoc.payrollResult.num_funcionarios || null,
            competencia: `${(pendingPayrollDoc.payrollResult.competencia?.mes || mes).toString().padStart(2, '0')}/${pendingPayrollDoc.payrollResult.competencia?.ano || ano}`,
            fileName: pendingPayrollDoc.fileName,
            filePath: pendingPayrollDoc.filePath || null,
          }}
          onConfirm={handlePayrollConfirm}
          onSkip={handlePayrollSkip}
          isLoading={payrollModalLoading}
        />
      )}
      
      {/* AI Error Explanation */}
      {aiError && (
        <div className="fixed bottom-4 right-4 max-w-md z-50">
          <AIErrorExplanation
            error={aiError.message}
            context={aiError.context}
            action="upload_documento_tributario"
            onDismiss={() => setAiError(null)}
            useAI={true}
          />
        </div>
      )}
    </div>
  );
}
