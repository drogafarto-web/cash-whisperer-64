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
}

export interface ParseResult {
  records: LisRecord[];
  periodStart: string | null;
  periodEnd: string | null;
  totalRecords: number;
  validRecords: number;
  invalidRecords: number;
  duplicateRecords: number;
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
const paymentMethodMapping: Record<string, PaymentMethod> = {
  'Dinheiro': 'DINHEIRO',
  'Pix': 'PIX',
  'Cartão de crédito': 'CARTAO',
  'Cartão de débito': 'CARTAO',
  'C. credito': 'CARTAO',
  'C. debito': 'CARTAO',
  'Boleto': 'BOLETO',
  'Não informado': 'PIX',
  'N. informado': 'PIX',
  '': 'PIX',
};

function parseDate(dateStr: string): string | null {
  if (!dateStr) return null;
  
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
  
  const skipPatterns = [
    'total:',
    'boleto:',
    'soma:',
    'subtotal',
    'data cad',
    'cadastro',
    'código',
    'movimento',
    'convenio:',
    'unidade:',
    'local:',
    'periodo',
    'relatorio',
    '',
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
  
  const dataCad = String(row[0] || '').trim();
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
  
  const parsedDate = parseDate(dataCad);
  if (!parsedDate) return null;
  
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
    } else {
      paymentMethod = 'PIX';
    }
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

export function parseLisXls(
  buffer: ArrayBuffer,
  cardFees: CardFeeConfig[] = []
): ParseResult {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  
  const data: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  
  const records: LisRecord[] = [];
  let periodStart: string | null = null;
  let periodEnd: string | null = null;
  
  // Encontrar linha de cabeçalho
  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(20, data.length); i++) {
    const row = data[i];
    if (row && Array.isArray(row)) {
      const rowStr = row.map(c => String(c || '').toLowerCase()).join(' ');
      if (rowStr.includes('cadastro') || rowStr.includes('data cad') || rowStr.includes('código') || rowStr.includes('paciente')) {
        headerRowIndex = i;
        break;
      }
    }
  }
  
  if (headerRowIndex === -1) {
    for (let i = 0; i < Math.min(20, data.length); i++) {
      const row = data[i];
      if (row && Array.isArray(row) && row.length > 5) {
        const firstCell = String(row[0] || '');
        if (firstCell.match(/^\d{1,2}\/\d{1,2}\/\d{2,4}/)) {
          headerRowIndex = i - 1;
          break;
        }
      }
    }
  }
  
  const startRow = headerRowIndex + 1;
  
  for (let i = startRow; i < data.length; i++) {
    const row = data[i];
    if (!row || !Array.isArray(row) || row.length < 5) continue;
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
