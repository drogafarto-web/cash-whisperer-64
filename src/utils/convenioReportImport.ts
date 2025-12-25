import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { parse, isValid } from 'date-fns';

export interface ConvenioReportRow {
  exam_date: Date;
  lis_code: string;
  patient_name: string;
  company_name: string | null;
  exam_list: string | null;
  amount: number;
  row_index: number;
}

export interface ConvenioReportFile {
  filename: string;
  provider_name: string;
  is_particular: boolean;
  period_start: Date | null;
  period_end: Date | null;
  rows: ConvenioReportRow[];
}

export interface ConvenioImportResult {
  files: ConvenioReportFile[];
  total_records: number;
  providers_count: number;
  period_start: Date | null;
  period_end: Date | null;
}

/**
 * Extrai o nome do convênio do nome do arquivo
 * Exemplo: "PREF. MUNICIPAL DE MERCES.xls" -> "PREF. MUNICIPAL DE MERCES"
 */
function extractProviderName(filename: string): string {
  // Remove extensão
  const nameWithoutExt = filename.replace(/\.(xls|xlsx)$/i, '');
  return nameWithoutExt.trim();
}

/**
 * Verifica se é relatório de particulares
 */
function isParticular(providerName: string): boolean {
  const lowerName = providerName.toLowerCase();
  return lowerName.includes('particular') || lowerName === 'particulares';
}

/**
 * Parseia data no formato brasileiro (DD/MM/YYYY)
 */
function parseBrazilianDate(dateStr: string | number | Date): Date | null {
  if (!dateStr) return null;
  
  // Se já é Date
  if (dateStr instanceof Date) {
    return isValid(dateStr) ? dateStr : null;
  }
  
  // Se é número (Excel serial date)
  if (typeof dateStr === 'number') {
    const date = XLSX.SSF.parse_date_code(dateStr);
    if (date) {
      return new Date(date.y, date.m - 1, date.d);
    }
    return null;
  }
  
  // Se é string
  const str = String(dateStr).trim();
  
  // Tenta formato DD/MM/YYYY
  const parsed = parse(str, 'dd/MM/yyyy', new Date());
  if (isValid(parsed)) return parsed;
  
  // Tenta formato ISO
  const isoDate = new Date(str);
  if (isValid(isoDate)) return isoDate;
  
  return null;
}

/**
 * Parseia valor monetário brasileiro (1.234,56 ou 1234.56)
 */
function parseMonetaryValue(value: string | number): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  
  const str = String(value).trim();
  
  // Remove "R$" e espaços
  let cleaned = str.replace(/R\$\s*/g, '').trim();
  
  // Se tem vírgula como decimal (formato brasileiro)
  if (cleaned.includes(',')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  }
  
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Extrai período do cabeçalho do relatório
 * Procura por padrão como "25/11/2025 a 25/12/2025"
 */
function extractPeriodFromHeader(worksheet: XLSX.WorkSheet): { start: Date | null; end: Date | null } {
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:Z20');
  
  // Procura nas primeiras 10 linhas
  for (let row = range.s.r; row <= Math.min(range.e.r, 10); row++) {
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cell = worksheet[XLSX.utils.encode_cell({ r: row, c: col })];
      if (cell && cell.v) {
        const cellValue = String(cell.v);
        // Procura padrão de período: DD/MM/YYYY a DD/MM/YYYY
        const periodMatch = cellValue.match(/(\d{2}\/\d{2}\/\d{4})\s*a\s*(\d{2}\/\d{2}\/\d{4})/);
        if (periodMatch) {
          return {
            start: parseBrazilianDate(periodMatch[1]),
            end: parseBrazilianDate(periodMatch[2]),
          };
        }
      }
    }
  }
  
  return { start: null, end: null };
}

/**
 * Encontra a linha de cabeçalho da tabela de dados
 * Procura por colunas como "Data", "Codigo", "Nome do paciente", "Valor"
 */
function findDataTableHeader(worksheet: XLSX.WorkSheet): number {
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:Z100');
  
  for (let row = range.s.r; row <= Math.min(range.e.r, 30); row++) {
    let hasData = false;
    let hasCodigo = false;
    let hasNome = false;
    let hasValor = false;
    
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cell = worksheet[XLSX.utils.encode_cell({ r: row, c: col })];
      if (cell && cell.v) {
        const value = String(cell.v).toLowerCase().trim();
        if (value === 'data' || value.includes('data')) hasData = true;
        if (value === 'codigo' || value === 'código') hasCodigo = true;
        if (value.includes('paciente') || value.includes('nome')) hasNome = true;
        if (value === 'valor' || value.includes('valor')) hasValor = true;
      }
    }
    
    // Se encontrou pelo menos 3 colunas esperadas, é provavelmente o cabeçalho
    if ((hasData && hasCodigo) || (hasData && hasValor) || (hasCodigo && hasNome)) {
      return row;
    }
  }
  
  return -1;
}

/**
 * Mapeia colunas do cabeçalho para índices
 */
interface ColumnMapping {
  data: number;
  codigo: number;
  nome: number;
  empresa: number;
  exames: number;
  valor: number;
}

function mapColumns(worksheet: XLSX.WorkSheet, headerRow: number): ColumnMapping {
  const mapping: ColumnMapping = {
    data: -1,
    codigo: -1,
    nome: -1,
    empresa: -1,
    exames: -1,
    valor: -1,
  };
  
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:Z100');
  
  for (let col = range.s.c; col <= range.e.c; col++) {
    const cell = worksheet[XLSX.utils.encode_cell({ r: headerRow, c: col })];
    if (cell && cell.v) {
      const value = String(cell.v).toLowerCase().trim();
      
      if (value === 'data' || value.includes('data')) {
        mapping.data = col;
      } else if (value === 'codigo' || value === 'código') {
        mapping.codigo = col;
      } else if (value.includes('paciente') || (value.includes('nome') && !value.includes('empresa'))) {
        mapping.nome = col;
      } else if (value.includes('empresa')) {
        mapping.empresa = col;
      } else if (value.includes('exame')) {
        mapping.exames = col;
      } else if (value === 'valor' || value.includes('valor')) {
        mapping.valor = col;
      }
    }
  }
  
  return mapping;
}

/**
 * Extrai linhas de dados da tabela
 */
function extractDataRows(
  worksheet: XLSX.WorkSheet,
  headerRow: number,
  columnMapping: ColumnMapping
): ConvenioReportRow[] {
  const rows: ConvenioReportRow[] = [];
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:Z1000');
  
  let rowIndex = 0;
  
  for (let row = headerRow + 1; row <= range.e.r; row++) {
    // Verifica se a linha tem dados válidos
    const dataCell = worksheet[XLSX.utils.encode_cell({ r: row, c: columnMapping.data })];
    const codigoCell = worksheet[XLSX.utils.encode_cell({ r: row, c: columnMapping.codigo })];
    const valorCell = worksheet[XLSX.utils.encode_cell({ r: row, c: columnMapping.valor })];
    
    // Se não tem data ou código, pula
    if (!dataCell?.v && !codigoCell?.v) continue;
    
    // Parseia data
    const examDate = parseBrazilianDate(dataCell?.v);
    if (!examDate) continue;
    
    // Pega código LIS
    const lisCode = String(codigoCell?.v || '').trim();
    if (!lisCode) continue;
    
    // Pega nome do paciente
    const nomeCell = worksheet[XLSX.utils.encode_cell({ r: row, c: columnMapping.nome })];
    const patientName = String(nomeCell?.v || '').trim();
    
    // Pega empresa (opcional)
    const empresaCell = columnMapping.empresa >= 0 
      ? worksheet[XLSX.utils.encode_cell({ r: row, c: columnMapping.empresa })]
      : null;
    const companyName = empresaCell?.v ? String(empresaCell.v).trim() : null;
    
    // Pega exames (opcional)
    const examesCell = columnMapping.exames >= 0
      ? worksheet[XLSX.utils.encode_cell({ r: row, c: columnMapping.exames })]
      : null;
    const examList = examesCell?.v ? String(examesCell.v).trim() : null;
    
    // Pega valor
    const amount = parseMonetaryValue(valorCell?.v);
    
    rowIndex++;
    
    rows.push({
      exam_date: examDate,
      lis_code: lisCode,
      patient_name: patientName,
      company_name: companyName,
      exam_list: examList,
      amount,
      row_index: rowIndex,
    });
  }
  
  return rows;
}

/**
 * Parseia um arquivo XLS de relatório por convênio
 */
function parseConvenioReport(filename: string, data: ArrayBuffer): ConvenioReportFile | null {
  try {
    const workbook = XLSX.read(data, { type: 'array' });
    
    // Usa a primeira planilha
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    if (!worksheet) {
      console.warn(`No worksheet found in ${filename}`);
      return null;
    }
    
    const providerName = extractProviderName(filename);
    const { start: periodStart, end: periodEnd } = extractPeriodFromHeader(worksheet);
    
    // Encontra cabeçalho da tabela de dados
    const headerRow = findDataTableHeader(worksheet);
    if (headerRow < 0) {
      console.warn(`No data table header found in ${filename}`);
      return null;
    }
    
    // Mapeia colunas
    const columnMapping = mapColumns(worksheet, headerRow);
    
    // Verifica se encontrou colunas essenciais
    if (columnMapping.data < 0 || columnMapping.codigo < 0 || columnMapping.valor < 0) {
      console.warn(`Missing essential columns in ${filename}`);
      return null;
    }
    
    // Extrai linhas de dados
    const rows = extractDataRows(worksheet, headerRow, columnMapping);
    
    return {
      filename,
      provider_name: providerName,
      is_particular: isParticular(providerName),
      period_start: periodStart,
      period_end: periodEnd,
      rows,
    };
  } catch (error) {
    console.error(`Error parsing ${filename}:`, error);
    return null;
  }
}

/**
 * Importa ZIP com múltiplos relatórios XLS de convênios
 */
export async function importConvenioReportsZip(file: File): Promise<ConvenioImportResult> {
  const zip = new JSZip();
  const content = await zip.loadAsync(file);
  
  const files: ConvenioReportFile[] = [];
  let totalRecords = 0;
  let overallPeriodStart: Date | null = null;
  let overallPeriodEnd: Date | null = null;
  
  // Itera sobre arquivos no ZIP
  for (const [path, zipEntry] of Object.entries(content.files)) {
    // Ignora diretórios e arquivos não-XLS
    if (zipEntry.dir) continue;
    
    const filename = path.split('/').pop() || path;
    
    // Ignora PDFs e arquivos que começam com .
    if (filename.startsWith('.')) continue;
    if (!filename.match(/\.(xls|xlsx)$/i)) continue;
    
    try {
      const data = await zipEntry.async('arraybuffer');
      const parsed = parseConvenioReport(filename, data);
      
      if (parsed && parsed.rows.length > 0) {
        files.push(parsed);
        totalRecords += parsed.rows.length;
        
        // Atualiza período geral
        if (parsed.period_start) {
          if (!overallPeriodStart || parsed.period_start < overallPeriodStart) {
            overallPeriodStart = parsed.period_start;
          }
        }
        if (parsed.period_end) {
          if (!overallPeriodEnd || parsed.period_end > overallPeriodEnd) {
            overallPeriodEnd = parsed.period_end;
          }
        }
      }
    } catch (error) {
      console.error(`Error processing ${filename}:`, error);
    }
  }
  
  return {
    files,
    total_records: totalRecords,
    providers_count: files.length,
    period_start: overallPeriodStart,
    period_end: overallPeriodEnd,
  };
}

/**
 * Função para preview rápido do conteúdo do ZIP
 */
export async function previewConvenioReportsZip(file: File): Promise<{ 
  xlsFiles: string[]; 
  pdfFiles: string[];
  otherFiles: string[];
}> {
  const zip = new JSZip();
  const content = await zip.loadAsync(file);
  
  const xlsFiles: string[] = [];
  const pdfFiles: string[] = [];
  const otherFiles: string[] = [];
  
  for (const [path, zipEntry] of Object.entries(content.files)) {
    if (zipEntry.dir) continue;
    
    const filename = path.split('/').pop() || path;
    if (filename.startsWith('.')) continue;
    
    if (filename.match(/\.(xls|xlsx)$/i)) {
      xlsFiles.push(filename);
    } else if (filename.match(/\.pdf$/i)) {
      pdfFiles.push(filename);
    } else {
      otherFiles.push(filename);
    }
  }
  
  return { xlsFiles, pdfFiles, otherFiles };
}
