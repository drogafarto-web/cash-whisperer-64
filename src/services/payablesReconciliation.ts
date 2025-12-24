import { Payable, Payable as PayableType, PayableMatchResult, PayableMatchType } from '@/types/payables';

interface BankStatementRecord {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'entrada' | 'saida';
}

/**
 * Find potential matches between payables and bank statement records
 */
export function findMatchesForPayables(
  payables: PayableType[],
  bankRecords: BankStatementRecord[]
): PayableMatchResult[] {
  const results: PayableMatchResult[] = [];

  for (const payable of payables) {
    const matches: PayableMatchResult[] = [];

    for (const record of bankRecords) {
      // Only match against outgoing transactions (payments)
      if (record.type !== 'saida') continue;

      const recordAmount = Math.abs(record.amount);
      const payableAmount = payable.valor;

      // Check for linha_digitavel match in description
      if (payable.linha_digitavel) {
        const normalizedLinha = normalizeLinhaDigitavel(payable.linha_digitavel);
        const normalizedDesc = normalizeLinhaDigitavel(record.description);
        
        if (normalizedDesc.includes(normalizedLinha.slice(0, 20))) {
          matches.push({
            payableId: payable.id,
            payable,
            transactionId: record.id,
            bankStatementDescription: record.description,
            matchType: 'linha_digitavel',
            confidence: 95,
            valueDiff: Math.abs(recordAmount - payableAmount),
            dateDiff: getDaysDifference(payable.vencimento, record.date),
          });
          continue;
        }
      }

      // Check for exact value match with close date
      const valueDiff = Math.abs(recordAmount - payableAmount);
      const dateDiff = getDaysDifference(payable.vencimento, record.date);

      if (valueDiff < 0.01 && dateDiff <= 3) {
        // Exact value match within 3 days
        matches.push({
          payableId: payable.id,
          payable,
          transactionId: record.id,
          bankStatementDescription: record.description,
          matchType: 'exact_value_date',
          confidence: dateDiff === 0 ? 90 : 85 - dateDiff * 5,
          valueDiff,
          dateDiff,
        });
        continue;
      }

      // Check for beneficiário name match
      if (payable.beneficiario) {
        const normalizedBeneficiario = normalizeName(payable.beneficiario);
        const normalizedDesc = normalizeName(record.description);

        if (normalizedDesc.includes(normalizedBeneficiario) || 
            normalizedBeneficiario.includes(normalizedDesc.slice(0, 10))) {
          // Name found in description, check if value is close
          const valueMatch = valueDiff / payableAmount < 0.05; // Within 5%
          
          if (valueMatch) {
            matches.push({
              payableId: payable.id,
              payable,
              transactionId: record.id,
              bankStatementDescription: record.description,
              matchType: 'beneficiario_name',
              confidence: 70 - Math.min(dateDiff, 10) * 2,
              valueDiff,
              dateDiff,
            });
          }
        }
      }
    }

    // Sort matches by confidence and add best match
    if (matches.length > 0) {
      matches.sort((a, b) => b.confidence - a.confidence);
      results.push(...matches.slice(0, 3)); // Keep top 3 matches per payable
    }
  }

  // Sort all results by confidence
  return results.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Get the best match for a single payable
 */
export function getBestMatchForPayable(
  payable: PayableType,
  bankRecords: BankStatementRecord[]
): PayableMatchResult | null {
  const matches = findMatchesForPayables([payable], bankRecords);
  return matches.length > 0 ? matches[0] : null;
}

/**
 * Group matches by payable
 */
export function groupMatchesByPayable(
  matches: PayableMatchResult[]
): Map<string, PayableMatchResult[]> {
  const grouped = new Map<string, PayableMatchResult[]>();
  
  for (const match of matches) {
    const existing = grouped.get(match.payableId) || [];
    existing.push(match);
    grouped.set(match.payableId, existing);
  }

  return grouped;
}

/**
 * Find unmatched payables (no good matches found)
 */
export function findUnmatchedPayables(
  payables: PayableType[],
  matches: PayableMatchResult[],
  minConfidence: number = 60
): PayableType[] {
  const matchedIds = new Set(
    matches.filter(m => m.confidence >= minConfidence).map(m => m.payableId)
  );
  
  return payables.filter(p => !matchedIds.has(p.id));
}

/**
 * Find unmatched bank records (not linked to any payable)
 */
export function findUnmatchedBankRecords(
  bankRecords: BankStatementRecord[],
  matches: PayableMatchResult[],
  minConfidence: number = 60
): BankStatementRecord[] {
  const matchedIds = new Set(
    matches
      .filter(m => m.confidence >= minConfidence && m.transactionId)
      .map(m => m.transactionId)
  );
  
  return bankRecords.filter(r => r.type === 'saida' && !matchedIds.has(r.id));
}

// Helper functions
function normalizeLinhaDigitavel(value: string): string {
  return value.replace(/[.\s-]/g, '').toLowerCase();
}

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9]/g, ''); // Keep only alphanumeric
}

function getDaysDifference(date1: string, date2: string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// Match type labels for UI
export const MATCH_TYPE_LABELS: Record<PayableMatchType, string> = {
  exact_value_date: 'Valor + Data',
  linha_digitavel: 'Linha Digitável',
  beneficiario_name: 'Nome Beneficiário',
  manual: 'Manual',
};

// Confidence thresholds
export const CONFIDENCE_THRESHOLDS = {
  HIGH: 85,
  MEDIUM: 70,
  LOW: 50,
};

export function getConfidenceLevel(confidence: number): 'high' | 'medium' | 'low' {
  if (confidence >= CONFIDENCE_THRESHOLDS.HIGH) return 'high';
  if (confidence >= CONFIDENCE_THRESHOLDS.MEDIUM) return 'medium';
  return 'low';
}

export function getConfidenceColor(confidence: number): string {
  const level = getConfidenceLevel(confidence);
  switch (level) {
    case 'high':
      return 'text-green-600';
    case 'medium':
      return 'text-yellow-600';
    case 'low':
      return 'text-red-600';
  }
}
