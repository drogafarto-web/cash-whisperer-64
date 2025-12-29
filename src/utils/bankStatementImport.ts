import { Partner, Category } from '@/types/database';
import { supabase } from '@/integrations/supabase/client';
import { convertPdfToImage, blobToBase64 } from '@/utils/pdfToImage';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

export interface BankStatementRecord {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'ENTRADA' | 'SAIDA';
  fitId?: string;
  suggestedPartner?: Partner | null;
  suggestedCategory?: Category | null;
  matchConfidence: number;
  isSelected: boolean;
  isDuplicate: boolean;
  valueDivergence?: {
    expected: number;
    actual: number;
    difference: number;
  } | null;
}

export interface BankStatementParseResult {
  records: BankStatementRecord[];
  bankName?: string;
  accountNumber?: string;
  periodStart: string | null;
  periodEnd: string | null;
  totalRecords: number;
  matchedRecords: number;
}

export type ParseProgressCallback = (message: string, current: number, total: number) => void;

// Pattern matching for partner suggestion
const PARTNER_PATTERNS: Record<string, string[]> = {
  'maria lucia': ['MARIA LUCIA', 'MARIALUCIA', 'M LUCIA', 'ALUGUEL MARIA'],
  'lab shopping': ['LAB SHOPPING', 'LABSHOPPING', 'LAB SHOP'],
  'db diagnosticos': ['DB DIAGN', 'DB MOLEC', 'DBMOLEC', 'DB DIAGNOS'],
  'central de art': ['CENTRAL ART', 'CENTRAL DE ART', 'CENTRALART'],
  'unimed': ['UNIMED', 'UNIÃO MÉDICA'],
  'cassi': ['CASSI', 'CAIXA DE ASSIST'],
  'prefeitura': ['PREFEITURA', 'MUNICIPIO', 'PMRP', 'PMMERC', 'PMRIB', 'PMUBE', 'SECRETARIA SAUDE'],
  'vivo': ['VIVO', 'TELEFONICA'],
  'copasa': ['COPASA', 'SANEAMENTO'],
  'cemig': ['CEMIG', 'ENERGIA ELETRICA'],
  'contador': ['CONTADOR', 'CONTABILIDADE'],
};

export function generateRecordId(): string {
  return `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function parseOFX(content: string): BankStatementParseResult {
  const records: BankStatementRecord[] = [];
  let bankName: string | undefined;
  let accountNumber: string | undefined;
  let periodStart: string | null = null;
  let periodEnd: string | null = null;

  // Extract bank info
  const orgMatch = content.match(/<ORG>([^<]+)/);
  if (orgMatch) bankName = orgMatch[1].trim();

  const acctMatch = content.match(/<ACCTID>([^<]+)/);
  if (acctMatch) accountNumber = acctMatch[1].trim();

  // Extract date range
  const dtStartMatch = content.match(/<DTSTART>(\d{8})/);
  const dtEndMatch = content.match(/<DTEND>(\d{8})/);
  
  if (dtStartMatch) {
    periodStart = formatOFXDate(dtStartMatch[1]);
  }
  if (dtEndMatch) {
    periodEnd = formatOFXDate(dtEndMatch[1]);
  }

  // Parse transactions
  const stmtTrnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let match;

  while ((match = stmtTrnRegex.exec(content)) !== null) {
    const trnContent = match[1];
    
    const trnTypeMatch = trnContent.match(/<TRNTYPE>([^<]+)/);
    const dtPostedMatch = trnContent.match(/<DTPOSTED>(\d{8})/);
    const trnAmtMatch = trnContent.match(/<TRNAMT>([^<]+)/);
    const fitIdMatch = trnContent.match(/<FITID>([^<]+)/);
    const memoMatch = trnContent.match(/<MEMO>([^<]+)/);
    const nameMatch = trnContent.match(/<NAME>([^<]+)/);

    if (dtPostedMatch && trnAmtMatch) {
      const amount = parseFloat(trnAmtMatch[1].replace(',', '.'));
      const description = memoMatch?.[1]?.trim() || nameMatch?.[1]?.trim() || '';
      
      records.push({
        id: generateRecordId(),
        date: formatOFXDate(dtPostedMatch[1]),
        description,
        amount: Math.abs(amount),
        type: amount >= 0 ? 'ENTRADA' : 'SAIDA',
        fitId: fitIdMatch?.[1]?.trim(),
        suggestedPartner: null,
        suggestedCategory: null,
        matchConfidence: 0,
        isSelected: true,
        isDuplicate: false,
        valueDivergence: null,
      });
    }
  }

  // Sort by date descending
  records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return {
    records,
    bankName,
    accountNumber,
    periodStart,
    periodEnd,
    totalRecords: records.length,
    matchedRecords: 0,
  };
}

function formatOFXDate(dateStr: string): string {
  // OFX dates are in YYYYMMDD format
  const year = dateStr.substring(0, 4);
  const month = dateStr.substring(4, 6);
  const day = dateStr.substring(6, 8);
  return `${year}-${month}-${day}`;
}

export function parseCSV(content: string): BankStatementParseResult {
  const records: BankStatementRecord[] = [];
  const lines = content.split('\n').filter(line => line.trim());
  
  if (lines.length < 2) {
    return {
      records: [],
      periodStart: null,
      periodEnd: null,
      totalRecords: 0,
      matchedRecords: 0,
    };
  }

  // Detect delimiter
  const delimiter = lines[0].includes(';') ? ';' : ',';
  
  // Parse header
  const headers = lines[0].toLowerCase().split(delimiter).map(h => h.trim().replace(/"/g, ''));
  
  // Find column indices
  const dateIdx = headers.findIndex(h => h.includes('data') || h.includes('date'));
  const descIdx = headers.findIndex(h => h.includes('descr') || h.includes('memo') || h.includes('historic') || h.includes('lancamento') || h.includes('lançamento'));
  const detailsIdx = headers.findIndex(h => h.includes('detalhe') || h.includes('details') || h.includes('observ'));
  const valueIdx = headers.findIndex(h => h.includes('valor') || h.includes('amount') || h.includes('value'));
  const creditIdx = headers.findIndex(h => h.includes('credito') || h.includes('credit'));
  const debitIdx = headers.findIndex(h => h.includes('debito') || h.includes('debit'));

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i], delimiter);
    if (cols.length < 2) continue;

    let date = '';
    let description = '';
    let amount = 0;
    let type: 'ENTRADA' | 'SAIDA' = 'SAIDA';

    // Extract date
    if (dateIdx >= 0 && cols[dateIdx]) {
      date = normalizeDate(cols[dateIdx]);
    }

    // Extract description (combine main description with details if available)
    let mainDesc = '';
    let details = '';
    
    if (descIdx >= 0 && cols[descIdx]) {
      mainDesc = cols[descIdx].trim();
    }
    if (detailsIdx >= 0 && cols[detailsIdx]) {
      details = cols[detailsIdx].trim();
    }
    
    description = mainDesc && details 
      ? `${mainDesc}: ${details}` 
      : mainDesc || details || '';

    // Extract amount
    if (creditIdx >= 0 && debitIdx >= 0) {
      const credit = parseNumber(cols[creditIdx]);
      const debit = parseNumber(cols[debitIdx]);
      if (credit > 0) {
        amount = credit;
        type = 'ENTRADA';
      } else if (debit > 0) {
        amount = debit;
        type = 'SAIDA';
      }
    } else if (valueIdx >= 0) {
      const value = parseNumber(cols[valueIdx]);
      amount = Math.abs(value);
      type = value >= 0 ? 'ENTRADA' : 'SAIDA';
    }

    if (date && amount > 0) {
      records.push({
        id: generateRecordId(),
        date,
        description,
        amount,
        type,
        suggestedPartner: null,
        suggestedCategory: null,
        matchConfidence: 0,
        isSelected: true,
        isDuplicate: false,
        valueDivergence: null,
      });
    }
  }

  // Sort and calculate period
  records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return {
    records,
    periodStart: records.length > 0 ? records[records.length - 1].date : null,
    periodEnd: records.length > 0 ? records[0].date : null,
    totalRecords: records.length,
    matchedRecords: 0,
  };
}

function parseCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim().replace(/^"|"$/g, ''));
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim().replace(/^"|"$/g, ''));
  
  return result;
}

function normalizeDate(dateStr: string): string {
  const cleaned = dateStr.trim().replace(/"/g, '');
  
  // Try DD/MM/YYYY format
  const brMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (brMatch) {
    const [, day, month, year] = brMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // Try YYYY-MM-DD format
  const isoMatch = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return cleaned;
  }

  return cleaned;
}

function parseNumber(str: string): number {
  if (!str) return 0;
  const cleaned = str.trim().replace(/"/g, '').replace(/\s/g, '');
  // Handle Brazilian format (1.234,56) and US format (1,234.56)
  if (cleaned.includes(',') && cleaned.includes('.')) {
    if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
      // Brazilian: 1.234,56
      return parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
    } else {
      // US: 1,234.56
      return parseFloat(cleaned.replace(/,/g, ''));
    }
  } else if (cleaned.includes(',')) {
    // Assume decimal comma
    return parseFloat(cleaned.replace(',', '.'));
  }
  return parseFloat(cleaned) || 0;
}

export function suggestPartnerAndCategory(
  record: BankStatementRecord,
  partners: Partner[],
  categories: Category[]
): { partner: Partner | null; category: Category | null; confidence: number } {
  const normalizedDesc = record.description.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  // First, try to match against known patterns
  for (const [partnerKey, patterns] of Object.entries(PARTNER_PATTERNS)) {
    for (const pattern of patterns) {
      if (normalizedDesc.includes(pattern)) {
        // Find the partner in our list
        const partner = partners.find(p => 
          p.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(partnerKey) ||
          partnerKey.includes(p.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
        );
        
        if (partner) {
          // Get the category
          const category = partner.default_category_id 
            ? categories.find(c => c.id === partner.default_category_id) || null
            : null;
          
          return { partner, category, confidence: 90 };
        }
      }
    }
  }

  // Try direct partner name matching
  for (const partner of partners) {
    const partnerName = partner.name.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (normalizedDesc.includes(partnerName) || partnerName.split(' ').some(word => word.length > 3 && normalizedDesc.includes(word))) {
      const category = partner.default_category_id 
        ? categories.find(c => c.id === partner.default_category_id) || null
        : null;
      
      return { partner, category, confidence: 75 };
    }
  }

  // Try to at least suggest a category based on keywords
  const categoryKeywords: Record<string, string[]> = {
    'aluguel': ['ALUGUEL', 'LOCACAO'],
    'energia': ['CEMIG', 'ENERGIA', 'ELETRICA', 'CPFL'],
    'agua': ['COPASA', 'SABESP', 'AGUA', 'SANEAMENTO'],
    'telefone': ['VIVO', 'TIM', 'CLARO', 'OI', 'TELEFONE', 'TELEFONICA'],
    'internet': ['INTERNET', 'FIBRA', 'BANDA LARGA'],
    'laboratorio': ['LABORAT', 'EXAME', 'ANALISE'],
    'convenio': ['UNIMED', 'CASSI', 'BRADESCO SAUDE', 'SULAMERICA'],
  };

  for (const [categoryName, keywords] of Object.entries(categoryKeywords)) {
    for (const keyword of keywords) {
      if (normalizedDesc.includes(keyword)) {
        const category = categories.find(c => 
          c.name.toLowerCase().includes(categoryName) ||
          c.description?.toLowerCase().includes(categoryName)
        );
        
        if (category && category.type === record.type) {
          return { partner: null, category, confidence: 50 };
        }
      }
    }
  }

  return { partner: null, category: null, confidence: 0 };
}

export function enrichRecordsWithSuggestions(
  records: BankStatementRecord[],
  partners: Partner[],
  categories: Category[]
): BankStatementRecord[] {
  let matchedCount = 0;
  
  const enriched = records.map(record => {
    const { partner, category, confidence } = suggestPartnerAndCategory(record, partners, categories);
    
    if (partner) matchedCount++;
    
    // Check value divergence
    let valueDivergence = null;
    if (partner?.expected_amount && Math.abs(record.amount - partner.expected_amount) > 0.01) {
      valueDivergence = {
        expected: partner.expected_amount,
        actual: record.amount,
        difference: record.amount - partner.expected_amount,
      };
    }
    
    return {
      ...record,
      suggestedPartner: partner,
      suggestedCategory: category,
      matchConfidence: confidence,
      valueDivergence,
    };
  });

  return enriched;
}

export function detectFileType(file: File): 'ofx' | 'csv' | 'pdf' | 'unknown' {
  const extension = file.name.toLowerCase().split('.').pop();
  if (extension === 'ofx') return 'ofx';
  if (extension === 'csv') return 'csv';
  if (extension === 'pdf') return 'pdf';
  return 'unknown';
}

export async function parsePDF(
  file: File, 
  onProgress?: ParseProgressCallback
): Promise<BankStatementParseResult> {
  const records: BankStatementRecord[] = [];
  
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const numPages = pdf.numPages;
    
    onProgress?.('Preparando páginas...', 0, numPages);

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      onProgress?.(`Processando página ${pageNum} de ${numPages}...`, pageNum, numPages);
      
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2 });
      
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      
      const context = canvas.getContext('2d');
      if (!context) {
        console.error(`Failed to get canvas context for page ${pageNum}`);
        continue;
      }
      
      await page.render({
        canvasContext: context,
        viewport,
      }).promise;
      
      // Convert to base64
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => b ? resolve(b) : reject(new Error('Failed to convert to blob')),
          'image/png',
          0.95
        );
      });
      
      const base64 = await blobToBase64(blob);
      
      // Call OCR edge function
      const { data, error } = await supabase.functions.invoke('ocr-bank-statement', {
        body: { imageBase64: base64, pageNumber: pageNum },
      });
      
      if (error) {
        console.error(`Error processing page ${pageNum}:`, error);
        continue;
      }
      
      if (data?.transactions && Array.isArray(data.transactions)) {
        for (const t of data.transactions) {
          records.push({
            id: generateRecordId(),
            date: t.date,
            description: t.description,
            amount: t.amount,
            type: t.type,
            suggestedPartner: null,
            suggestedCategory: null,
            matchConfidence: 0,
            isSelected: true,
            isDuplicate: false,
            valueDivergence: null,
          });
        }
      }
    }
    
    onProgress?.('Finalizando...', numPages, numPages);
    
    // Sort by date descending
    records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    return {
      records,
      bankName: 'Extrato PDF',
      periodStart: records.length > 0 ? records[records.length - 1].date : null,
      periodEnd: records.length > 0 ? records[0].date : null,
      totalRecords: records.length,
      matchedRecords: 0,
    };
    
  } catch (error) {
    console.error('Error parsing PDF:', error);
    throw new Error('Erro ao processar PDF. Verifique se o arquivo é um extrato bancário válido.');
  }
}

export async function parseFile(
  file: File, 
  onProgress?: ParseProgressCallback
): Promise<BankStatementParseResult> {
  const fileType = detectFileType(file);
  
  if (fileType === 'ofx') {
    const content = await file.text();
    return parseOFX(content);
  } else if (fileType === 'csv') {
    const content = await file.text();
    return parseCSV(content);
  } else if (fileType === 'pdf') {
    return parsePDF(file, onProgress);
  }
  
  throw new Error('Formato de arquivo não suportado. Use OFX, CSV ou PDF.');
}
