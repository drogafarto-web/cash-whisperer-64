import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { convertPdfToImage, blobToBase64 } from '@/utils/pdfToImage';

// Tipos de documentos tributários (sempre despesa)
const TAX_DOCUMENT_TYPES = ['darf', 'gps', 'das', 'fgts', 'inss_guia'];

export interface AnalyzedDocResult {
  type: 'revenue' | 'expense' | 'unknown';
  documentType: 'nfse' | 'nf_produto' | 'boleto' | 'recibo' | 'extrato' | 'darf' | 'gps' | 'das' | 'fgts' | 'inss_guia' | 'outro';
  issuerCnpj: string | null;
  customerCnpj: string | null;
  issuerName: string | null;
  customerName: string | null;
  documentNumber: string | null;
  series: string | null;
  issueDate: string | null;
  dueDate: string | null;
  totalValue: number | null;
  netValue: number | null;
  taxes: {
    iss: number | null;
    inss: number | null;
    pis: number | null;
    cofins: number | null;
  };
  verificationCode: string | null;
  description: string | null;
  confidence: number;
  classificationReason: string;
  competenceYear: number | null;
  competenceMonth: number | null;
  // Novos campos para guias tributárias
  codigoBarras: string | null;
  linhaDigitavel: string | null;
  pixKey: string | null;
  pixTipo: 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria' | null;
  error?: string;
}

// Labels para tipos de documento
export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  nfse: 'NFS-e',
  nf_produto: 'NF Produto',
  boleto: 'Boleto',
  recibo: 'Recibo',
  extrato: 'Extrato',
  darf: 'DARF',
  gps: 'GPS',
  das: 'DAS',
  fgts: 'FGTS',
  inss_guia: 'INSS',
  outro: 'Outro',
};

// Verifica se é documento tributário
export function isTaxDocument(documentType: string): boolean {
  return TAX_DOCUMENT_TYPES.includes(documentType);
}

// Normaliza CNPJ para comparação
function normalizeCnpj(cnpj: string | null): string | null {
  if (!cnpj) return null;
  return cnpj.replace(/[^\d]/g, '');
}

// Verifica se arquivo é XML
function isXmlFile(file: File): boolean {
  return file.type === 'text/xml' || 
         file.type === 'application/xml' || 
         file.name.toLowerCase().endsWith('.xml');
}

// Analisa XML via edge function (parse estruturado, sem OCR)
async function analyzeAccountingXml(
  xmlContent: string,
  unitId: string
): Promise<AnalyzedDocResult> {
  console.log('Analyzing XML with structured parser...');
  
  const { data, error } = await supabase.functions.invoke('analyze-accounting-xml', {
    body: { xml: xmlContent, unitId },
  });

  if (error) {
    console.error('Error analyzing XML:', error);
    throw error;
  }

  return data as AnalyzedDocResult;
}

// Analisa documento via edge function (OCR com IA)
async function analyzeAccountingImage(
  file: File,
  unitId: string
): Promise<AnalyzedDocResult> {
  let base64: string;
  let mimeType: string;

  // Se for PDF, converter para imagem
  if (file.type === 'application/pdf') {
    console.log('Converting PDF to PNG for OCR...');
    const pngBlob = await convertPdfToImage(file, 2);
    base64 = await blobToBase64(pngBlob);
    mimeType = 'image/png';
  } else {
    // Já é imagem
    base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    mimeType = file.type;
  }

  const { data, error } = await supabase.functions.invoke('analyze-accounting-document', {
    body: { imageBase64: base64, mimeType, unitId },
  });

  if (error) {
    console.error('Error analyzing document:', error);
    throw error;
  }

  return data as AnalyzedDocResult;
}

// Função principal de análise - decide entre XML ou OCR
export async function analyzeAccountingDocument(
  file: File,
  unitId: string
): Promise<AnalyzedDocResult> {
  // Se for XML, usar parse estruturado (mais rápido e preciso)
  if (isXmlFile(file)) {
    const xmlContent = await file.text();
    return analyzeAccountingXml(xmlContent, unitId);
  }
  
  // Caso contrário, usar OCR com IA
  return analyzeAccountingImage(file, unitId);
}

// Verifica duplicidade de invoice
export async function checkDuplicateInvoice(
  issuerCnpj: string | null,
  documentNumber: string | null
): Promise<{ isDuplicate: boolean; existingId?: string }> {
  if (!issuerCnpj || !documentNumber) {
    return { isDuplicate: false };
  }

  const normalizedCnpj = normalizeCnpj(issuerCnpj);
  
  const { data } = await supabase
    .from('invoices')
    .select('id')
    .eq('issuer_cnpj', normalizedCnpj)
    .eq('document_number', documentNumber)
    .limit(1);

  if (data && data.length > 0) {
    return { isDuplicate: true, existingId: data[0].id };
  }

  return { isDuplicate: false };
}

// Verifica duplicidade de payable por CNPJ + document_number
export async function checkDuplicatePayable(
  issuerCnpj: string | null,
  documentNumber: string | null,
  valor?: number | null,
  vencimento?: string | null
): Promise<{ isDuplicate: boolean; existingId?: string }> {
  const normalizedCnpj = normalizeCnpj(issuerCnpj);
  
  // Verificação primária: CNPJ + document_number (mais precisa)
  if (normalizedCnpj && documentNumber) {
    const { data } = await supabase
      .from('payables')
      .select('id')
      .eq('beneficiario_cnpj', normalizedCnpj)
      .eq('document_number', documentNumber)
      .limit(1);

    if (data && data.length > 0) {
      return { isDuplicate: true, existingId: data[0].id };
    }
  }

  // Verificação secundária: CNPJ + valor + vencimento (fallback)
  if (normalizedCnpj && valor && vencimento) {
    const { data } = await supabase
      .from('payables')
      .select('id')
      .eq('beneficiario_cnpj', normalizedCnpj)
      .eq('valor', valor)
      .eq('vencimento', vencimento)
      .limit(1);

    if (data && data.length > 0) {
      return { isDuplicate: true, existingId: data[0].id };
    }
  }

  return { isDuplicate: false };
}

// Cria invoice (receita) a partir do OCR
export async function createInvoiceFromOcr(
  result: AnalyzedDocResult,
  unitId: string,
  filePath: string,
  fileName: string,
  competenceYear: number,
  competenceMonth: number
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    // Verificar duplicidade
    const duplicate = await checkDuplicateInvoice(result.issuerCnpj, result.documentNumber);
    if (duplicate.isDuplicate) {
      return { 
        success: false, 
        error: 'duplicate',
        id: duplicate.existingId 
      };
    }

    // Usar competência do OCR se disponível, senão usar a passada
    const year = result.competenceYear || competenceYear;
    const month = result.competenceMonth || competenceMonth;

    const invoiceData = {
      unit_id: unitId,
      document_number: result.documentNumber || 'SEM_NUMERO',
      customer_name: result.customerName || 'CLIENTE NÃO IDENTIFICADO',
      customer_cnpj: normalizeCnpj(result.customerCnpj),
      issuer_name: result.issuerName,
      issuer_cnpj: normalizeCnpj(result.issuerCnpj),
      issue_date: result.issueDate || new Date().toISOString().split('T')[0],
      service_value: result.totalValue || 0,
      net_value: result.netValue || result.totalValue || 0,
      iss_value: result.taxes?.iss,
      description: result.description,
      verification_code: result.verificationCode,
      competence_year: year,
      competence_month: month,
      file_path: filePath,
      file_name: fileName,
      status: 'PENDENTE',
    };

    const { data, error } = await supabase
      .from('invoices')
      .insert(invoiceData as any)
      .select('id')
      .single();

    if (error) {
      console.error('Error creating invoice:', error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data.id };
  } catch (error) {
    console.error('Error in createInvoiceFromOcr:', error);
    return { success: false, error: String(error) };
  }
}

// Cria payable (despesa) a partir do OCR
export async function createPayableFromOcr(
  result: AnalyzedDocResult,
  unitId: string,
  filePath: string,
  fileName: string,
  extras?: { description?: string; paymentMethod?: string }
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    // Verificar duplicidade com CNPJ + document_number + valor + vencimento
    const vencimento = result.dueDate || result.issueDate || new Date().toISOString().split('T')[0];
    const duplicate = await checkDuplicatePayable(
      result.issuerCnpj, 
      result.documentNumber,
      result.totalValue,
      vencimento
    );
    if (duplicate.isDuplicate) {
      return { 
        success: false, 
        error: 'duplicate',
        id: duplicate.existingId 
      };
    }

    // Determinar tipo de payable
    let tipo: 'boleto' | 'parcela' | 'avulso' | 'recibo' = 'avulso';
    if (result.documentType === 'boleto') {
      tipo = 'boleto';
    } else if (result.documentType === 'recibo') {
      tipo = 'recibo';
    }

    // Determinar beneficiário para guias tributárias
    let beneficiario = result.issuerName || 'FORNECEDOR NÃO IDENTIFICADO';
    if (isTaxDocument(result.documentType)) {
      const docLabel = DOCUMENT_TYPE_LABELS[result.documentType] || result.documentType.toUpperCase();
      beneficiario = `${docLabel} - Receita Federal`;
      if (result.documentType === 'gps') {
        beneficiario = 'GPS - Previdência Social';
      } else if (result.documentType === 'fgts') {
        beneficiario = 'FGTS - Caixa Econômica Federal';
      } else if (result.documentType === 'das') {
        beneficiario = 'DAS - Simples Nacional';
      }
    }

    const payableData: Record<string, any> = {
      unit_id: unitId,
      beneficiario,
      beneficiario_cnpj: normalizeCnpj(result.issuerCnpj),
      valor: result.totalValue || 0,
      vencimento,
      description: extras?.description || result.description || `Documento ${result.documentNumber || ''}`.trim(),
      document_number: result.documentNumber || null,
      tipo,
      status: 'PENDENTE',
      file_path: filePath,
      file_name: fileName,
      file_bucket: 'accounting-documents',
      ocr_confidence: typeof result.confidence === 'number' ? Number(result.confidence.toFixed(3)) : null,
      intended_payment_method: extras?.paymentMethod || null,
    };

    // Adicionar campos extras para guias tributárias
    if (result.codigoBarras) {
      payableData.codigo_barras = result.codigoBarras;
    }
    if (result.linhaDigitavel) {
      payableData.linha_digitavel = result.linhaDigitavel;
    }
    if (result.pixKey) {
      payableData.pix_key = result.pixKey;
      payableData.pix_tipo = result.pixTipo;
    }

    const { data, error } = await supabase
      .from('payables')
      .insert(payableData as any)
      .select('id')
      .single();

    if (error) {
      console.error('Error creating payable:', error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data.id };
  } catch (error) {
    console.error('Error in createPayableFromOcr:', error);
    return { success: false, error: String(error) };
  }
}

// Função principal que processa documento e cria registro apropriado
export async function processAccountingDocument(
  file: File,
  unitId: string,
  filePath: string,
  competenceYear: number,
  competenceMonth: number
): Promise<{
  result: AnalyzedDocResult;
  recordCreated: boolean;
  recordType?: 'invoice' | 'payable';
  recordId?: string;
  isDuplicate?: boolean;
  duplicateId?: string;
}> {
  // Analisar documento
  const result = await analyzeAccountingDocument(file, unitId);
  
  // Se for unknown, apenas retornar o resultado sem criar registro
  if (result.type === 'unknown') {
    return { 
      result, 
      recordCreated: false 
    };
  }

  // Criar registro apropriado
  if (result.type === 'revenue') {
    const createResult = await createInvoiceFromOcr(
      result, 
      unitId, 
      filePath, 
      file.name,
      competenceYear,
      competenceMonth
    );
    
    if (createResult.error === 'duplicate') {
      return {
        result,
        recordCreated: false,
        isDuplicate: true,
        duplicateId: createResult.id,
        recordType: 'invoice',
      };
    }
    
    return {
      result,
      recordCreated: createResult.success,
      recordType: 'invoice',
      recordId: createResult.id,
    };
  }

  if (result.type === 'expense') {
    const createResult = await createPayableFromOcr(result, unitId, filePath, file.name);
    
    if (createResult.error === 'duplicate') {
      return {
        result,
        recordCreated: false,
        isDuplicate: true,
        duplicateId: createResult.id,
        recordType: 'payable',
      };
    }
    
    return {
      result,
      recordCreated: createResult.success,
      recordType: 'payable',
      recordId: createResult.id,
    };
  }

  return { result, recordCreated: false };
}
