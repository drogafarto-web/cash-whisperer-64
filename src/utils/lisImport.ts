import * as XLSX from 'xlsx';
import { PaymentMethod } from '@/types/database';

export type DiscountLevel = 'none' | 'medium' | 'high';

export interface LisRecord {
  data: string;
  unidade: string;
  unidadeCodigo: string;
  codigo: string;
  paciente: string;
  convenio: string;
  valorBruto: number; // Total R$
  valorDesconto: number; // Desc. R$
  valorAcrescimo: number; // Acres. R$
  valorPago: number; // Pago R$
  percentualDesconto: number;
  discountLevel: DiscountLevel;
  formaPagamento: string;
  formaPagamentoOriginal: string;
  atendente: string;
  isParticular: boolean;
  paymentMethod: PaymentMethod;
  unitId: string | null;
  error: string | null;
  isDuplicate: boolean;
  duplicateReason: string | null;
  // Campos de justificativa
  discountReason?: string;
  discountApprovedBy?: string;
  discountApprovedAt?: string;
  discountApprovalChannel?: string;
  // Taxa de cartão
  cardFeePercent: number;
  cardFeeValue: number;
  valorLiquido: number;
  // Flag para itens sem pagamento
  isNaoPago: boolean;
}

export type LisReportType = 
  | 'movimento-diario-detalhado' 
  | 'movimento-diario-resumido'
  | 'atendimentos'
  | 'financeiro'
  | 'desconhecido';

export interface ReportTypeDetection {
  type: LisReportType;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  isSupported: boolean;
}

export interface ParseResult {
  records: LisRecord[];
  periodStart: string | null;
  periodEnd: string | null;
  totalRecords: number;
  validRecords: number;
  invalidRecords: number;
  duplicateRecords: number;
  // Tipo de relatório detectado
  reportType?: ReportTypeDetection;
  // Diagnóstico
  diagnostics?: {
    sheetUsed: string;
    headerRowIndex: number;
    startRow: number;
    rowsScanned: number;
    rowsSkippedInvalidDate: number;
    rowsSkippedBySkipRow: number;
    rowsSkippedTooFewColumns: number;
    // Novos campos para debug
    rawPreview?: string[][];
    sheetsAttempted?: string[];
  };
}

export interface CardFeeConfig {
  id: string;
  name: string;
  fee_percent: number;
}

// Mapeamento de códigos de unidade do LIS para IDs do sistema
const unitCodeMapping: Record<string, string> = {
  'CTL': '0e8ad4c3-a018-42ef-8941-9cd7e3e1611d', // Rio Pomba
  'MRC': 'b5cabb43-1963-41bf-8b28-6d821d30df7d', // Mercês
  'GUA': '62cddf50-ce5e-432f-b207-7523d9bc6d0e', // Guarani
  'SIL': '7772233b-0f05-4b0f-9f52-67ed854df1eb', // Silveirânia
};

const unitNameMapping: Record<string, string> = {
  'CTL': 'Rio Pomba',
  'MRC': 'Mercês',
  'GUA': 'Guarani',
  'SIL': 'Silveirânia',
};

// Mapeamento de formas de pagamento do LIS para o sistema
// CRÍTICO: NUNCA usar fallback que assume forma de pagamento
const paymentMethodMapping: Record<string, PaymentMethod> = {
  // Dinheiro
  'Dinheiro': 'DINHEIRO',
  'DINHEIRO': 'DINHEIRO',
  'dinheiro': 'DINHEIRO',
  // PIX
  'Pix': 'PIX',
  'PIX': 'PIX',
  'pix': 'PIX',
  // Cartão
  'Cartão de crédito': 'CARTAO',
  'Cartão de débito': 'CARTAO',
  'Cartao de credito': 'CARTAO',
  'Cartao de debito': 'CARTAO',
  'C. credito': 'CARTAO',
  'C. debito': 'CARTAO',
  'C. Credito': 'CARTAO',
  'C. Debito': 'CARTAO',
  'Cartao': 'CARTAO',
  'Cartão': 'CARTAO',
  'CARTAO': 'CARTAO',
  'cartao': 'CARTAO',
  'Credito': 'CARTAO',
  'Debito': 'CARTAO',
  'credito': 'CARTAO',
  'debito': 'CARTAO',
  // Boleto / Transferência
  'Boleto': 'BOLETO',
  'BOLETO': 'BOLETO',
  'boleto': 'BOLETO',
  'Transferência': 'TRANSFERENCIA',
  'Transferencia': 'TRANSFERENCIA',
  'TRANSFERENCIA': 'TRANSFERENCIA',
  'TED': 'TRANSFERENCIA',
  'DOC': 'TRANSFERENCIA',
  // Convênio (não gera caixa)
  'Convênio': 'CONVENIO',
  'Convenio': 'CONVENIO',
  'CONVENIO': 'CONVENIO',
  'convenio': 'CONVENIO',
  // Não informado / Não pago - NUNCA assumir como outra forma
  'Não informado': 'NAO_PAGO',
  'N. informado': 'NAO_PAGO',
  'Nao informado': 'NAO_PAGO',
  'N/A': 'NAO_PAGO',
  'N.A.': 'NAO_PAGO',
  '': 'NAO_PAGO',
};

function parseDate(value: unknown): string | null {
  if (!value) return null;
  
  // Handle Date object (from cellDates: true)
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  // Handle Excel serial number (days since 1899-12-30)
  if (typeof value === 'number') {
    // Excel serial date: number of days since 1899-12-30
    // Excel has a bug where it thinks 1900 is a leap year, so we adjust
    const excelEpoch = new Date(1899, 11, 30); // Dec 30, 1899
    const date = new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000);
    if (!isNaN(date.getTime()) && date.getFullYear() > 1900 && date.getFullYear() < 2100) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    return null;
  }
  
  // Handle string in dd/mm/yyyy format
  if (typeof value === 'string') {
    const dateStr = value.trim();
    const match = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (match) {
      const day = match[1].padStart(2, '0');
      const month = match[2].padStart(2, '0');
      let year = match[3];
      if (year.length === 2) {
        year = '20' + year;
      }
      return `${year}-${month}-${day}`;
    }
  }
  
  return null;
}

function parseAmount(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/R\$\s*/g, '').replace(/\./g, '').replace(',', '.').trim();
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function extractUnitCode(codigo: string): string {
  if (!codigo) return '';
  
  const parts = codigo.split('-');
  if (parts.length > 1) {
    return parts[0].toUpperCase();
  }
  
  const match = codigo.match(/^([A-Z]{2,3})/i);
  if (match) {
    return match[1].toUpperCase();
  }
  
  return '';
}

function isSkipRow(row: unknown[]): boolean {
  const firstCell = String(row[0] || '').toLowerCase().trim();
  
  // Skip truly empty rows
  if (firstCell === '') return true;
  
  const skipPatterns = [
    'total:',
    'boleto:',
    'soma:',
    'subtotal',
    'data cad',
    'cadastro',
    'código',
    'codigo',
    'movimento',
    'convenio:',
    'unidade:',
    'local:',
    'periodo',
    'relatorio',
  ];
  
  return skipPatterns.some(pattern => firstCell.startsWith(pattern));
}

function calculateDiscountLevel(percent: number): DiscountLevel {
  if (percent > 0.30) return 'high';
  if (percent > 0.10) return 'medium';
  return 'none';
}

function getCardFeeForPayment(
  formaPagamento: string,
  cardFees: CardFeeConfig[]
): { feePercent: number; feeName: string } {
  const formaPagLower = formaPagamento.toLowerCase();
  
  if (formaPagLower.includes('crédito')) {
    const config = cardFees.find(c => c.name.toLowerCase().includes('crédito'));
    return { feePercent: config?.fee_percent || 2.99, feeName: 'crédito' };
  }
  if (formaPagLower.includes('débito')) {
    const config = cardFees.find(c => c.name.toLowerCase().includes('débito'));
    return { feePercent: config?.fee_percent || 1.99, feeName: 'débito' };
  }
  
  return { feePercent: 0, feeName: '' };
}

function processRow(
  row: unknown[],
  cardFees: CardFeeConfig[]
): LisRecord | null {
  // Estrutura CSV:
  // [0] Cadastro (Data), [1] Unidade, [2] Código, [3] Paciente, [4] Convênio,
  // [5] Total R$, [6] Desc. R$, [7] Acres. R$, [8] Pago R$, [9] Form. Pag., [10] Atendente, [11] A Pag. R$
  
  // Parse date first - supports string, Date object, and Excel serial number
  const parsedDate = parseDate(row[0]);
  if (!parsedDate) return null;
  
  const unidade = String(row[1] || '').trim();
  const codigo = String(row[2] || '').trim();
  const paciente = String(row[3] || '').trim();
  const convenio = String(row[4] || '').trim();
  const valorBruto = parseAmount(row[5]); // Total R$
  const valorDesconto = parseAmount(row[6]); // Desc. R$
  const valorAcrescimo = parseAmount(row[7]); // Acres. R$
  const valorPago = parseAmount(row[8]); // Pago R$
  const formaPag = String(row[9] || '').trim();
  const atendente = String(row[10] || '').trim();
  
  // Extrair código da unidade
  let unidadeCodigo = unidade.toUpperCase();
  if (!unitCodeMapping[unidadeCodigo]) {
    unidadeCodigo = extractUnitCode(codigo);
  }
  if (!unitCodeMapping[unidadeCodigo] && unidade) {
    if (unidade.toLowerCase().includes('rio pomba') || unidade.toLowerCase().includes('central')) {
      unidadeCodigo = 'CTL';
    } else if (unidade.toLowerCase().includes('mercês') || unidade.toLowerCase().includes('merces')) {
      unidadeCodigo = 'MRC';
    } else if (unidade.toLowerCase().includes('guarani')) {
      unidadeCodigo = 'GUA';
    } else if (unidade.toLowerCase().includes('silveirânia') || unidade.toLowerCase().includes('silveirania')) {
      unidadeCodigo = 'SIL';
    }
  }
  
  const unitId = unitCodeMapping[unidadeCodigo] || null;
  const unitName = unitNameMapping[unidadeCodigo] || unidade || unidadeCodigo;
  
  const isParticular = convenio.toLowerCase().includes('particular');
  
  // Mapear forma de pagamento
  let paymentMethod = paymentMethodMapping[formaPag];
  if (!paymentMethod) {
    const formaPagLower = formaPag.toLowerCase();
    if (formaPagLower.includes('dinheiro')) {
      paymentMethod = 'DINHEIRO';
    } else if (formaPagLower.includes('pix')) {
      paymentMethod = 'PIX';
    } else if (formaPagLower.includes('cart') || formaPagLower.includes('crédito') || formaPagLower.includes('débito')) {
      paymentMethod = 'CARTAO';
    } else if (formaPagLower.includes('boleto')) {
      paymentMethod = 'BOLETO';
    } else if (formaPagLower.includes('transf') || formaPagLower.includes('ted') || formaPagLower.includes('doc')) {
      paymentMethod = 'TRANSFERENCIA';
    } else if (formaPagLower.includes('conv') || formaPagLower.includes('plano') || formaPagLower.includes('saude')) {
      paymentMethod = 'CONVENIO';
    } else {
      // CRÍTICO: NUNCA assumir forma de pagamento - sempre marcar como NAO_PAGO
      // O atendente deve resolver manualmente via modal de resolução
      paymentMethod = 'NAO_PAGO';
    }
  }
  
  // Determinar se é item não pago (valorPago = 0 ou forma de pagamento não informada)
  const isNaoPago = valorPago === 0 || paymentMethod === 'NAO_PAGO';
  
  // Se valorPago é 0 mas tinha forma de pagamento, forçar NAO_PAGO
  if (isNaoPago && paymentMethod !== 'NAO_PAGO') {
    paymentMethod = 'NAO_PAGO';
  }
  
  // Calcular percentual de desconto
  // Fórmula: desconto / (bruto + desconto - acréscimo), onde bruto já é o valor sem desconto original
  // Se valorBruto = 0 e tem desconto, usar outra fórmula
  let percentualDesconto = 0;
  const base = valorBruto + valorDesconto;
  if (base > 0) {
    percentualDesconto = valorDesconto / base;
  }
  
  const discountLevel = calculateDiscountLevel(percentualDesconto);
  
  // Calcular taxa de cartão
  let cardFeePercent = 0;
  let cardFeeValue = 0;
  let valorLiquido = valorPago;
  
  if (paymentMethod === 'CARTAO') {
    const { feePercent } = getCardFeeForPayment(formaPag, cardFees);
    cardFeePercent = feePercent;
    cardFeeValue = valorPago * (cardFeePercent / 100);
    valorLiquido = valorPago - cardFeeValue;
  }
  
  // Verificar erros
  let error: string | null = null;
  if (!unitId) {
    error = `Unidade não mapeada: ${unidadeCodigo || unidade}`;
  }
  
  return {
    data: parsedDate,
    unidade: unitName,
    unidadeCodigo,
    codigo,
    paciente,
    convenio,
    valorBruto,
    valorDesconto,
    valorAcrescimo,
    valorPago,
    percentualDesconto,
    discountLevel,
    formaPagamento: paymentMethod === 'CARTAO' ? formaPag : formaPag,
    formaPagamentoOriginal: formaPag,
    atendente,
    isParticular,
    paymentMethod,
    unitId,
    error,
    isDuplicate: false,
    duplicateReason: null,
    cardFeePercent,
    cardFeeValue,
    valorLiquido,
    isNaoPago,
  };
}

export function parseLisCsv(
  content: string,
  cardFees: CardFeeConfig[] = []
): ParseResult {
  const lines = content.split('\n');
  const records: LisRecord[] = [];
  let periodStart: string | null = null;
  let periodEnd: string | null = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // CSV com delimitador ;
    const row = line.split(';');
    if (row.length < 5) continue;
    if (isSkipRow(row)) continue;
    
    const record = processRow(row, cardFees);
    if (!record) continue;
    
    if (record.data) {
      if (!periodStart || record.data < periodStart) periodStart = record.data;
      if (!periodEnd || record.data > periodEnd) periodEnd = record.data;
    }
    
    records.push(record);
  }
  
  const validRecords = records.filter(r => !r.error && !r.isDuplicate);
  
  return {
    records,
    periodStart,
    periodEnd,
    totalRecords: records.length,
    validRecords: validRecords.length,
    invalidRecords: records.filter(r => r.error).length,
    duplicateRecords: 0,
  };
}

// Helper to check if a value looks like a valid date - MORE PERMISSIVE
function isValidDateCell(cell: unknown): boolean {
  if (cell instanceof Date) return true;
  // Excel serial: expand range to cover 1990-2050 (33000-55000)
  if (typeof cell === 'number' && cell > 33000 && cell < 55000) return true;
  if (typeof cell === 'string') {
    const trimmed = cell.trim();
    // Accept dates with or without time: "08/12/2025" or "08/12/2025 00:00:00"
    if (/\d{1,2}\/\d{1,2}\/\d{2,4}/.test(trimmed)) return true;
    // Also accept yyyy-mm-dd format
    if (/\d{4}-\d{1,2}-\d{1,2}/.test(trimmed)) return true;
  }
  return false;
}

// Parse a single sheet and return result
function parseSheet(
  data: unknown[][],
  sheetName: string,
  cardFees: CardFeeConfig[]
): ParseResult {
  const records: LisRecord[] = [];
  let periodStart: string | null = null;
  let periodEnd: string | null = null;
  
  // Diagnostics counters
  let rowsSkippedInvalidDate = 0;
  let rowsSkippedBySkipRow = 0;
  let rowsSkippedTooFewColumns = 0;
  
  // Encontrar linha de cabeçalho - try header text first
  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(20, data.length); i++) {
    const row = data[i];
    if (row && Array.isArray(row)) {
      const rowStr = row.map(c => String(c || '').toLowerCase()).join(' ');
      // Check for header keywords (handle encoding issues with partial match)
      if (rowStr.includes('cadastro') || rowStr.includes('data cad') || 
          rowStr.includes('digo') || rowStr.includes('paciente') ||
          rowStr.includes('unidade') || rowStr.includes('convênio') || rowStr.includes('convenio')) {
        headerRowIndex = i;
        break;
      }
    }
  }
  
  // Fallback: find first row with a valid date in the first column
  if (headerRowIndex === -1) {
    for (let i = 0; i < Math.min(30, data.length); i++) {
      const row = data[i];
      if (row && Array.isArray(row) && row.length > 5) {
        const firstCell = row[0];
        if (isValidDateCell(firstCell)) {
          // This is a data row, header should be the previous row
          headerRowIndex = Math.max(0, i - 1);
          break;
        }
      }
    }
  }
  
  const startRow = headerRowIndex >= 0 ? headerRowIndex + 1 : 0;
  const rowsScanned = data.length - startRow;
  
  for (let i = startRow; i < data.length; i++) {
    const row = data[i];
    if (!row || !Array.isArray(row) || row.length < 5) {
      rowsSkippedTooFewColumns++;
      continue;
    }
    if (isSkipRow(row)) {
      rowsSkippedBySkipRow++;
      continue;
    }
    
    // Extra check: skip if first cell is not a valid date
    const firstCell = row[0];
    if (!isValidDateCell(firstCell)) {
      rowsSkippedInvalidDate++;
      continue;
    }
    
    const record = processRow(row, cardFees);
    if (!record) continue;
    
    if (record.data) {
      if (!periodStart || record.data < periodStart) periodStart = record.data;
      if (!periodEnd || record.data > periodEnd) periodEnd = record.data;
    }
    
    records.push(record);
  }
  
  const validRecords = records.filter(r => !r.error && !r.isDuplicate);
  
  return {
    records,
    periodStart,
    periodEnd,
    totalRecords: records.length,
    validRecords: validRecords.length,
    invalidRecords: records.filter(r => r.error).length,
    duplicateRecords: 0,
    diagnostics: {
      sheetUsed: sheetName,
      headerRowIndex,
      startRow,
      rowsScanned,
      rowsSkippedInvalidDate,
      rowsSkippedBySkipRow,
      rowsSkippedTooFewColumns,
    },
  };
}

// Detect the type of LIS report based on content
function detectLisReportType(data: unknown[][]): ReportTypeDetection {
  // Analyze first 20 rows to detect report type
  const textContent = data.slice(0, 20).map(row => 
    (row as unknown[]).map(cell => String(cell ?? '').toLowerCase()).join(' ')
  ).join(' ');
  
  // Get header row (usually between row 3-10)
  let headerRow: string[] = [];
  for (let i = 0; i < Math.min(15, data.length); i++) {
    const row = data[i];
    if (row && Array.isArray(row)) {
      const rowStr = row.map(c => String(c || '').toLowerCase());
      if (rowStr.some(c => c.includes('cadastro') || c.includes('paciente') || c.includes('codigo') || c.includes('código'))) {
        headerRow = rowStr;
        break;
      }
    }
  }
  
  const headerStr = headerRow.join(' ');
  
  // Check for "Movimento Diário Detalhado" - our supported format
  const hasMovimentoDiario = textContent.includes('movimento') && textContent.includes('diário') || 
                              textContent.includes('movimento') && textContent.includes('diario');
  const hasDetalhado = textContent.includes('detalhado');
  const hasPaciente = headerStr.includes('paciente');
  const hasCodigo = headerStr.includes('codigo') || headerStr.includes('código');
  const hasValorPago = headerStr.includes('pago') || headerStr.includes('total');
  const hasFormaPag = headerStr.includes('form') || headerStr.includes('pagamento');
  
  // Pattern 1: Movimento Diário Detalhado (supported)
  if ((hasMovimentoDiario || hasDetalhado) && hasPaciente && (hasCodigo || hasValorPago)) {
    return {
      type: 'movimento-diario-detalhado',
      confidence: hasDetalhado ? 'high' : 'medium',
      reason: 'Movimento Diário Detalhado',
      isSupported: true,
    };
  }
  
  // Pattern 2: Has patient/code columns without "detalhado" in title
  if (hasPaciente && hasCodigo && hasValorPago) {
    return {
      type: 'movimento-diario-detalhado',
      confidence: 'medium',
      reason: 'Movimento Diário (estrutura compatível)',
      isSupported: true,
    };
  }
  
  // Pattern 3: Movimento Diário Resumido (not supported)
  if (hasMovimentoDiario && !hasPaciente && !hasCodigo) {
    return {
      type: 'movimento-diario-resumido',
      confidence: 'medium',
      reason: 'Movimento Diário Resumido (sem detalhes por paciente)',
      isSupported: false,
    };
  }
  
  // Pattern 4: Relatório de Atendimentos
  if (textContent.includes('atendimento') && !hasValorPago) {
    return {
      type: 'atendimentos',
      confidence: 'medium',
      reason: 'Relatório de Atendimentos (sem dados financeiros)',
      isSupported: false,
    };
  }
  
  // Pattern 5: Relatório Financeiro
  if ((textContent.includes('financeiro') || textContent.includes('faturamento')) && !hasPaciente) {
    return {
      type: 'financeiro',
      confidence: 'medium',
      reason: 'Relatório Financeiro (sem dados de atendimento)',
      isSupported: false,
    };
  }
  
  // Unknown format
  return {
    type: 'desconhecido',
    confidence: 'low',
    reason: 'Formato não reconhecido',
    isSupported: false,
  };
}

export function parseLisXls(
  buffer: ArrayBuffer,
  cardFees: CardFeeConfig[] = []
): ParseResult {
  // Use cellDates: true to get Date objects instead of serial numbers when possible
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  
  // Capture raw preview from first sheet (for debugging)
  const firstSheetName = workbook.SheetNames[0];
  const firstSheet = workbook.Sheets[firstSheetName];
  const firstSheetData: unknown[][] = XLSX.utils.sheet_to_json(firstSheet, { 
    header: 1, 
    raw: false,
    defval: '' 
  });
  
  // Raw preview: first 5 rows, first 10 columns
  const rawPreview: string[][] = firstSheetData.slice(0, 5).map(row => 
    (row as unknown[]).slice(0, 10).map(cell => String(cell ?? ''))
  );
  
  // Detect report type
  const reportType = detectLisReportType(firstSheetData);
  
  console.log(`[LIS Parser] Report type detected: ${reportType.type} (${reportType.confidence}) - ${reportType.reason}`);
  
  // If report type is not supported, return early with diagnostic info
  if (!reportType.isSupported) {
    return {
      records: [],
      periodStart: null,
      periodEnd: null,
      totalRecords: 0,
      validRecords: 0,
      invalidRecords: 0,
      duplicateRecords: 0,
      reportType,
      diagnostics: {
        sheetUsed: firstSheetName,
        headerRowIndex: -1,
        startRow: 0,
        rowsScanned: firstSheetData.length,
        rowsSkippedInvalidDate: 0,
        rowsSkippedBySkipRow: 0,
        rowsSkippedTooFewColumns: 0,
        rawPreview,
        sheetsAttempted: workbook.SheetNames,
      },
    };
  }
  
  // Try each sheet until we find one with valid records
  let bestResult: ParseResult | null = null;
  
  console.log(`[LIS Parser] Workbook has ${workbook.SheetNames.length} sheets: ${workbook.SheetNames.join(', ')}`);
  
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const data: unknown[][] = XLSX.utils.sheet_to_json(sheet, { 
      header: 1, 
      raw: false,
      defval: '' 
    });
    
    console.log(`[LIS Parser] Trying sheet "${sheetName}" with ${data.length} rows`);
    
    const result = parseSheet(data, sheetName, cardFees);
    
    // If we found valid records, use this sheet
    if (result.records.length > 0) {
      console.log(`[LIS Parser] Found ${result.records.length} records in sheet "${sheetName}"`);
      bestResult = result;
      break;
    }
    
    // Keep best result (for diagnostics even if no records)
    if (!bestResult || (result.diagnostics?.rowsScanned || 0) > (bestResult.diagnostics?.rowsScanned || 0)) {
      bestResult = result;
    }
  }
  
  // Fallback to empty result if nothing found
  if (!bestResult) {
    bestResult = {
      records: [],
      periodStart: null,
      periodEnd: null,
      totalRecords: 0,
      validRecords: 0,
      invalidRecords: 0,
      duplicateRecords: 0,
      diagnostics: {
        sheetUsed: firstSheetName,
        headerRowIndex: -1,
        startRow: 0,
        rowsScanned: 0,
        rowsSkippedInvalidDate: 0,
        rowsSkippedBySkipRow: 0,
        rowsSkippedTooFewColumns: 0,
      },
    };
  }
  
  // Add reportType, rawPreview and sheetsAttempted to diagnostics
  return {
    ...bestResult,
    reportType,
    diagnostics: {
      ...bestResult.diagnostics!,
      rawPreview,
      sheetsAttempted: workbook.SheetNames,
    },
  };
}

export function extractLisCodeFromDescription(description: string): string | null {
  const match = description.match(/\[LIS\s+([^\]]+)\]/);
  return match ? match[1] : null;
}

export function getPaymentMethodIcon(method: PaymentMethod): string {
  switch (method) {
    case 'DINHEIRO': return '💵';
    case 'CARTAO': return '💳';
    case 'PIX': return '📲';
    case 'BOLETO': return '📄';
    case 'TRANSFERENCIA': return '🏦';
    case 'NAO_PAGO': return '❌';
    default: return '💰';
  }
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function formatPercent(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}
