import { supabase } from '@/integrations/supabase/client';
import { DuplicateCheckResult, ExistingPayableData } from '@/types/duplicateCheck';
import { AnalyzedDocResult } from './accountingOcrService';

// Normaliza string removendo caracteres especiais e espaços
function normalizeString(str: string | null): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, '')
    .trim();
}

// Normaliza CNPJ para comparação
function normalizeCnpj(cnpj: string | null): string | null {
  if (!cnpj) return null;
  return cnpj.replace(/[^\d]/g, '');
}

// Normaliza código de barras/linha digitável
function normalizeBarcode(code: string | null): string | null {
  if (!code) return null;
  return code.replace(/[^\d]/g, '');
}

// Calcula similaridade entre dois nomes (0-1)
function calculateNameSimilarity(name1: string | null, name2: string | null): number {
  if (!name1 || !name2) return 0;
  
  const n1 = normalizeString(name1);
  const n2 = normalizeString(name2);
  
  if (n1 === n2) return 1;
  
  // Verifica se um contém o outro
  if (n1.includes(n2) || n2.includes(n1)) return 0.8;
  
  // Verifica palavras em comum
  const words1 = n1.split(/\s+/).filter(w => w.length > 2);
  const words2 = n2.split(/\s+/).filter(w => w.length > 2);
  
  if (words1.length === 0 || words2.length === 0) return 0;
  
  const commonWords = words1.filter(w => words2.includes(w));
  const similarity = (commonWords.length * 2) / (words1.length + words2.length);
  
  return similarity;
}

// Verifica se datas estão próximas (dentro de N dias)
function areDatesNear(date1: string | null, date2: string | null, maxDays: number = 5): boolean {
  if (!date1 || !date2) return false;
  
  try {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffTime = Math.abs(d2.getTime() - d1.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= maxDays;
  } catch {
    return false;
  }
}

// Verifica se valores são próximos (diferença de até 1%)
function areValuesNear(val1: number | null, val2: number | null, tolerance: number = 0.01): boolean {
  if (val1 === null || val2 === null) return false;
  if (val1 === 0 && val2 === 0) return true;
  if (val1 === 0 || val2 === 0) return false;
  
  const diff = Math.abs(val1 - val2);
  const maxVal = Math.max(val1, val2);
  return (diff / maxVal) <= tolerance;
}

// Busca payable por código de barras
async function findByCodigoBarras(codigoBarras: string): Promise<ExistingPayableData | null> {
  const normalized = normalizeBarcode(codigoBarras);
  if (!normalized) return null;
  
  const { data } = await supabase
    .from('payables')
    .select('id, beneficiario, valor, vencimento, status, document_number')
    .eq('codigo_barras', normalized)
    .limit(1);
  
  if (data && data.length > 0) {
    return data[0] as ExistingPayableData;
  }
  return null;
}

// Busca payable por linha digitável
async function findByLinhaDigitavel(linhaDigitavel: string): Promise<ExistingPayableData | null> {
  const normalized = normalizeBarcode(linhaDigitavel);
  if (!normalized) return null;
  
  const { data } = await supabase
    .from('payables')
    .select('id, beneficiario, valor, vencimento, status, document_number')
    .eq('linha_digitavel', normalized)
    .limit(1);
  
  if (data && data.length > 0) {
    return data[0] as ExistingPayableData;
  }
  return null;
}

// Busca por CNPJ + número do documento
async function findByCnpjAndDocNumber(
  cnpj: string | null,
  docNumber: string | null
): Promise<ExistingPayableData | null> {
  const normalizedCnpj = normalizeCnpj(cnpj);
  if (!normalizedCnpj || !docNumber) return null;
  
  const { data } = await supabase
    .from('payables')
    .select('id, beneficiario, valor, vencimento, status, document_number')
    .eq('beneficiario_cnpj', normalizedCnpj)
    .eq('document_number', docNumber)
    .limit(1);
  
  if (data && data.length > 0) {
    return data[0] as ExistingPayableData;
  }
  return null;
}

// Busca por CNPJ + valor + vencimento
async function findByCnpjValueAndDueDate(
  cnpj: string | null,
  valor: number | null,
  vencimento: string | null
): Promise<ExistingPayableData | null> {
  const normalizedCnpj = normalizeCnpj(cnpj);
  if (!normalizedCnpj || !valor || !vencimento) return null;
  
  const { data } = await supabase
    .from('payables')
    .select('id, beneficiario, valor, vencimento, status, document_number')
    .eq('beneficiario_cnpj', normalizedCnpj)
    .eq('valor', valor)
    .eq('vencimento', vencimento)
    .limit(1);
  
  if (data && data.length > 0) {
    return data[0] as ExistingPayableData;
  }
  return null;
}

// Busca por nome similar + valor próximo + data próxima
async function findSimilar(
  beneficiario: string | null,
  valor: number | null,
  vencimento: string | null
): Promise<ExistingPayableData | null> {
  if (!beneficiario || !valor || !vencimento) return null;
  
  // Busca candidatos com valor similar e data próxima
  const targetDate = new Date(vencimento);
  const startDate = new Date(targetDate);
  startDate.setDate(startDate.getDate() - 5);
  const endDate = new Date(targetDate);
  endDate.setDate(endDate.getDate() + 5);
  
  const minValue = valor * 0.99;
  const maxValue = valor * 1.01;
  
  const { data } = await supabase
    .from('payables')
    .select('id, beneficiario, valor, vencimento, status, document_number')
    .gte('valor', minValue)
    .lte('valor', maxValue)
    .gte('vencimento', startDate.toISOString().split('T')[0])
    .lte('vencimento', endDate.toISOString().split('T')[0])
    .limit(10);
  
  if (!data || data.length === 0) return null;
  
  // Filtra por similaridade de nome
  for (const item of data) {
    const similarity = calculateNameSimilarity(beneficiario, item.beneficiario);
    if (similarity >= 0.5) {
      return item as ExistingPayableData;
    }
  }
  
  return null;
}

/**
 * Verifica duplicidade de payable de forma abrangente
 * Retorna o nível de duplicidade encontrado com prioridade:
 * 1. Código de barras idêntico = BLOCKED
 * 2. Linha digitável idêntica = BLOCKED
 * 3. CNPJ + Nº Documento = HIGH
 * 4. CNPJ + Valor + Vencimento = MEDIUM
 * 5. Nome similar + Valor + Data próxima = LOW
 */
export async function checkPayableDuplicateComprehensive(
  result: AnalyzedDocResult
): Promise<DuplicateCheckResult> {
  // 1. Verificar código de barras (BLOQUEIO TOTAL)
  if (result.codigoBarras) {
    const existing = await findByCodigoBarras(result.codigoBarras);
    if (existing) {
      return {
        level: 'blocked',
        reason: 'Código de barras já cadastrado no sistema',
        existingId: existing.id,
        existingData: existing,
      };
    }
  }
  
  // 2. Verificar linha digitável (BLOQUEIO TOTAL)
  if (result.linhaDigitavel) {
    const existing = await findByLinhaDigitavel(result.linhaDigitavel);
    if (existing) {
      return {
        level: 'blocked',
        reason: 'Linha digitável já cadastrada no sistema',
        existingId: existing.id,
        existingData: existing,
      };
    }
  }
  
  // 3. Verificar CNPJ + Número do documento (ALTA CONFIANÇA)
  if (result.issuerCnpj && result.documentNumber) {
    const existing = await findByCnpjAndDocNumber(result.issuerCnpj, result.documentNumber);
    if (existing) {
      return {
        level: 'high',
        reason: 'CNPJ e número do documento idênticos a registro existente',
        existingId: existing.id,
        existingData: existing,
      };
    }
  }
  
  // 4. Verificar CNPJ + Valor + Vencimento (MÉDIA CONFIANÇA)
  const vencimento = result.dueDate || result.issueDate;
  if (result.issuerCnpj && result.totalValue && vencimento) {
    const existing = await findByCnpjValueAndDueDate(
      result.issuerCnpj,
      result.totalValue,
      vencimento
    );
    if (existing) {
      return {
        level: 'medium',
        reason: 'CNPJ, valor e vencimento idênticos a registro existente',
        existingId: existing.id,
        existingData: existing,
      };
    }
  }
  
  // 5. Verificar nome similar + valor + data próxima (BAIXA CONFIANÇA)
  const beneficiario = result.issuerName;
  if (beneficiario && result.totalValue && vencimento) {
    const existing = await findSimilar(beneficiario, result.totalValue, vencimento);
    if (existing) {
      return {
        level: 'low',
        reason: 'Encontrado registro com beneficiário, valor e data similares',
        existingId: existing.id,
        existingData: existing,
      };
    }
  }
  
  return { level: 'none' };
}

/**
 * Verifica duplicidade simples por código de barras ou linha digitável
 * Usado para verificação rápida em formulários
 */
export async function checkSimpleDuplicate(
  codigoBarras?: string | null,
  linhaDigitavel?: string | null
): Promise<DuplicateCheckResult> {
  if (codigoBarras) {
    const existing = await findByCodigoBarras(codigoBarras);
    if (existing) {
      return {
        level: 'blocked',
        reason: 'Código de barras já cadastrado',
        existingId: existing.id,
        existingData: existing,
      };
    }
  }
  
  if (linhaDigitavel) {
    const existing = await findByLinhaDigitavel(linhaDigitavel);
    if (existing) {
      return {
        level: 'blocked',
        reason: 'Linha digitável já cadastrada',
        existingId: existing.id,
        existingData: existing,
      };
    }
  }
  
  return { level: 'none' };
}
