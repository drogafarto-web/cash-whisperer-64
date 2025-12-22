import * as XLSX from 'xlsx';
import { PaymentMethod } from '@/types/database';

export interface LisRecord {
  data: string;
  unidade: string;
  unidadeCodigo: string;
  codigo: string;
  paciente: string;
  convenio: string;
  valorPago: number;
  formaPagamento: string;
  atendente: string;
  isParticular: boolean;
  paymentMethod: PaymentMethod;
  unitId: string | null;
  error: string | null;
  isDuplicate: boolean;
  duplicateReason: string | null;
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
  
  // Tentar formato DD/MM/YYYY ou DD/MM/YY
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
    // Remove R$, pontos de milhar e substitui vírgula por ponto
    const cleaned = value.replace(/R\$\s*/g, '').replace(/\./g, '').replace(',', '.').trim();
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function extractUnitCode(codigo: string): string {
  // O código geralmente é algo como "CTL-12345" ou apenas "12345"
  if (!codigo) return '';
  
  const parts = codigo.split('-');
  if (parts.length > 1) {
    return parts[0].toUpperCase();
  }
  
  // Se não tem hífen, pode ter o código no início (ex: CTL12345)
  const match = codigo.match(/^([A-Z]{2,3})/i);
  if (match) {
    return match[1].toUpperCase();
  }
  
  return '';
}

function isSkipRow(row: unknown[]): boolean {
  const firstCell = String(row[0] || '').toLowerCase().trim();
  
  // Linhas de total ou cabeçalho
  const skipPatterns = [
    'total:',
    'boleto:',
    'soma:',
    'subtotal',
    'data cad',
    'código',
    '',
  ];
  
  return skipPatterns.some(pattern => firstCell.startsWith(pattern));
}

export function parseLisXls(buffer: ArrayBuffer): ParseResult {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  
  // Converter para array de arrays
  const data: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  
  const records: LisRecord[] = [];
  let periodStart: string | null = null;
  let periodEnd: string | null = null;
  
  // Encontrar a linha de cabeçalho (geralmente contém "Data Cad" ou "Código")
  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(20, data.length); i++) {
    const row = data[i];
    if (row && Array.isArray(row)) {
      const rowStr = row.map(c => String(c || '').toLowerCase()).join(' ');
      if (rowStr.includes('data cad') || rowStr.includes('código') || rowStr.includes('paciente')) {
        headerRowIndex = i;
        break;
      }
    }
  }
  
  if (headerRowIndex === -1) {
    // Tentar encontrar pelo padrão de dados (datas no formato DD/MM/YY)
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
  
  // Processar as linhas de dados (após o cabeçalho)
  const startRow = headerRowIndex + 1;
  
  for (let i = startRow; i < data.length; i++) {
    const row = data[i];
    if (!row || !Array.isArray(row) || row.length < 5) continue;
    if (isSkipRow(row)) continue;
    
    // Estrutura esperada baseada no arquivo analisado:
    // [0] Data Cad, [1] Unidade, [2] Código, [3] Paciente, [4] Convênio, 
    // [5] Pedido R$, [6] Desc R$, [7] Pago R$, [8] Form. Pag., [9] Atendente
    
    const dataCad = String(row[0] || '').trim();
    const unidade = String(row[1] || '').trim();
    const codigo = String(row[2] || '').trim();
    const paciente = String(row[3] || '').trim();
    const convenio = String(row[4] || '').trim();
    const valorPago = parseAmount(row[7]); // Coluna "Pago R$"
    const formaPag = String(row[8] || '').trim();
    const atendente = String(row[9] || '').trim();
    
    // Ignorar linhas sem data válida ou sem código
    const parsedDate = parseDate(dataCad);
    if (!parsedDate) continue;
    
    // Extrair código da unidade do código do atendimento ou da coluna Unidade
    let unidadeCodigo = extractUnitCode(codigo);
    if (!unidadeCodigo && unidade) {
      // Tentar mapear pelo nome da unidade
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
    
    // Verificar se é particular
    const isParticular = convenio.toLowerCase().includes('particular');
    
    // Mapear forma de pagamento
    let paymentMethod = paymentMethodMapping[formaPag];
    if (!paymentMethod) {
      // Tentar mapeamento parcial
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
        paymentMethod = 'PIX'; // Default
      }
    }
    
    // Verificar erros
    let error: string | null = null;
    if (!unitId) {
      error = `Unidade não mapeada: ${unidadeCodigo || unidade}`;
    } else if (valorPago <= 0) {
      error = 'Valor pago é zero ou negativo';
    }
    
    // Atualizar período
    if (parsedDate) {
      if (!periodStart || parsedDate < periodStart) {
        periodStart = parsedDate;
      }
      if (!periodEnd || parsedDate > periodEnd) {
        periodEnd = parsedDate;
      }
    }
    
    records.push({
      data: parsedDate,
      unidade: unitName,
      unidadeCodigo,
      codigo,
      paciente,
      convenio,
      valorPago,
      formaPagamento: formaPag,
      atendente,
      isParticular,
      paymentMethod,
      unitId,
      error,
      isDuplicate: false,
      duplicateReason: null,
    });
  }
  
  const validRecords = records.filter(r => !r.error && r.valorPago > 0 && !r.isDuplicate);
  
  return {
    records,
    periodStart,
    periodEnd,
    totalRecords: records.length,
    validRecords: validRecords.length,
    invalidRecords: records.filter(r => r.error || r.valorPago <= 0).length,
    duplicateRecords: records.filter(r => r.isDuplicate).length,
  };
}

// Extrai o código LIS de uma descrição de transação
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
