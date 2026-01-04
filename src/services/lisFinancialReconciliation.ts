import { supabase } from "@/integrations/supabase/client";

export interface LisOrphan {
  id: string;
  lis_code: string;
  date: string;
  patient_name: string | null;
  payment_method: string;
  amount: number;
  gross_amount: number | null;
  closure_id: string;
}

export interface TransactionOrphan {
  id: string;
  date: string;
  amount: number;
  description: string | null;
  category_name: string | null;
  partner_name: string | null;
  type: string;
}

export interface DuplicateEntry {
  lis_code: string;
  occurrences: number;
  transaction_ids: string[];
  dates: string[];
  total_amount: number;
}

export interface MatchedPair {
  lis_code: string;
  lis_item_id: string;
  transaction_id: string;
  lis_amount: number;
  transaction_amount: number;
  lis_date: string;
  transaction_date: string;
}

export interface ReconciliationSummary {
  lisWithoutFinancial: LisOrphan[];
  financialWithoutLis: TransactionOrphan[];
  duplicates: DuplicateEntry[];
  matched: MatchedPair[];
  totals: {
    lisCount: number;
    lisAmount: number;
    transactionCount: number;
    transactionAmount: number;
    matchedCount: number;
    matchedAmount: number;
  };
}

/**
 * Fetches LIS closure items for a given date range and unit
 */
async function fetchLisItems(
  unitId: string,
  startDate: string,
  endDate: string
): Promise<LisOrphan[]> {
  const { data, error } = await supabase
    .from('lis_closure_items')
    .select('id, lis_code, date, patient_name, payment_method, amount, gross_amount, closure_id')
    .eq('unit_id', unitId)
    .gte('date', startDate)
    .lte('date', endDate)
    .in('payment_method', ['DINHEIRO', 'PIX', 'CARTAO_CREDITO', 'CARTAO_DEBITO'])
    .order('date', { ascending: true });

  if (error) {
    console.error('Error fetching LIS items:', error);
    return [];
  }

  return data || [];
}

/**
 * Fetches incoming transactions (ENTRADA) for reconciliation
 */
async function fetchIncomingTransactions(
  unitId: string,
  startDate: string,
  endDate: string
): Promise<Array<{ id: string; date: string; amount: number; description: string | null; lis_protocol_id: string | null; category: { name: string } | null; partner: { name: string } | null; type: string }>> {
  const { data, error } = await supabase
    .from('transactions')
    .select('id, date, amount, description, lis_protocol_id, type, category:categories(name), partner:partners(name)')
    .eq('unit_id', unitId)
    .eq('type', 'ENTRADA')
    .eq('status', 'APROVADO')
    .is('deleted_at', null)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true });

  if (error) {
    console.error('Error fetching transactions:', error);
    return [];
  }

  return data || [];
}

/**
 * Main reconciliation function
 */
export async function getReconciliationSummary(
  unitId: string,
  startDate: string,
  endDate: string
): Promise<ReconciliationSummary> {
  const [lisItems, transactions] = await Promise.all([
    fetchLisItems(unitId, startDate, endDate),
    fetchIncomingTransactions(unitId, startDate, endDate),
  ]);

  const lisWithoutFinancial: LisOrphan[] = [];
  const financialWithoutLis: TransactionOrphan[] = [];
  const duplicates: DuplicateEntry[] = [];
  const matched: MatchedPair[] = [];

  // Create a map of LIS codes from items
  const lisCodeMap = new Map<string, LisOrphan[]>();
  for (const item of lisItems) {
    const existing = lisCodeMap.get(item.lis_code) || [];
    existing.push(item);
    lisCodeMap.set(item.lis_code, existing);
  }

  // Create a map of transactions with lis_protocol_id
  const transactionLisMap = new Map<string, typeof transactions>();
  for (const tx of transactions) {
    if (tx.lis_protocol_id) {
      const existing = transactionLisMap.get(tx.lis_protocol_id) || [];
      existing.push(tx);
      transactionLisMap.set(tx.lis_protocol_id, existing);
    }
  }

  // Find matched pairs and orphans
  for (const [lisCode, items] of lisCodeMap) {
    const matchingTransactions = transactionLisMap.get(lisCode) || [];

    if (matchingTransactions.length === 0) {
      // LIS without financial record
      lisWithoutFinancial.push(...items);
    } else if (matchingTransactions.length === 1 && items.length === 1) {
      // Perfect match
      matched.push({
        lis_code: lisCode,
        lis_item_id: items[0].id,
        transaction_id: matchingTransactions[0].id,
        lis_amount: items[0].amount,
        transaction_amount: matchingTransactions[0].amount,
        lis_date: items[0].date,
        transaction_date: matchingTransactions[0].date,
      });
    } else {
      // Potential duplicates in transactions
      if (matchingTransactions.length > 1) {
        duplicates.push({
          lis_code: lisCode,
          occurrences: matchingTransactions.length,
          transaction_ids: matchingTransactions.map(tx => tx.id),
          dates: matchingTransactions.map(tx => tx.date),
          total_amount: matchingTransactions.reduce((sum, tx) => sum + tx.amount, 0),
        });
      }
    }
  }

  // Find transactions without LIS (not linked)
  for (const tx of transactions) {
    if (!tx.lis_protocol_id) {
      financialWithoutLis.push({
        id: tx.id,
        date: tx.date,
        amount: tx.amount,
        description: tx.description,
        category_name: tx.category?.name || null,
        partner_name: tx.partner?.name || null,
        type: tx.type,
      });
    }
  }

  // Calculate totals
  const lisAmount = lisItems.reduce((sum, item) => sum + item.amount, 0);
  const transactionAmount = transactions.reduce((sum, tx) => sum + tx.amount, 0);
  const matchedAmount = matched.reduce((sum, m) => sum + m.lis_amount, 0);

  return {
    lisWithoutFinancial,
    financialWithoutLis,
    duplicates,
    matched,
    totals: {
      lisCount: lisItems.length,
      lisAmount,
      transactionCount: transactions.length,
      transactionAmount,
      matchedCount: matched.length,
      matchedAmount,
    },
  };
}

/**
 * Link a transaction to a LIS code manually
 */
export async function linkTransactionToLis(
  transactionId: string,
  lisCode: string
): Promise<boolean> {
  const { error } = await supabase
    .from('transactions')
    .update({
      lis_protocol_id: lisCode,
      lis_source: 'MANUAL',
    })
    .eq('id', transactionId);

  if (error) {
    console.error('Error linking transaction to LIS:', error);
    return false;
  }

  return true;
}

/**
 * Log a reconciliation action
 */
export async function logReconciliation(
  lisCode: string,
  unitId: string,
  date: string,
  transactionId: string | null,
  lisItemId: string | null,
  status: 'PENDENTE' | 'CONCILIADO' | 'SEM_MATCH' | 'IGNORADO',
  userId: string,
  notes?: string
): Promise<boolean> {
  const { error } = await supabase
    .from('lis_reconciliation_log')
    .insert({
      lis_code: lisCode,
      unit_id: unitId,
      date,
      transaction_id: transactionId,
      lis_closure_item_id: lisItemId,
      status,
      notes,
      reconciled_by: userId,
      reconciled_at: new Date().toISOString(),
    });

  if (error) {
    console.error('Error logging reconciliation:', error);
    return false;
  }

  return true;
}
