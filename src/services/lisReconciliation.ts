import { supabase } from "@/integrations/supabase/client";

export interface ReconciliationResult {
  lisCode: string;
  itemId: string;
  status: 'CONCILIADO' | 'SEM_COMPROVANTE' | 'DUPLICIDADE';
  matchedTransactionId?: string;
  divergenceType?: 'VALOR' | 'DATA' | null;
  matchedAmount?: number;
  matchedDate?: string;
}

export interface LisClosureItem {
  id: string;
  lis_code: string;
  date: string;
  patient_name: string | null;
  payment_method: string;
  amount: number;
  gross_amount: number | null;
  status: string;
  comprovante_status: string;
}

/**
 * Tenta conciliar itens LIS com transações existentes no sistema
 * Critérios: código LIS na descrição/lis_protocol_id + valor + data (±tolerância)
 */
export async function reconcileLisItems(
  closureId: string,
  toleranceDays: number = 1
): Promise<ReconciliationResult[]> {
  // 1. Buscar itens do fechamento
  const { data: items, error: itemsError } = await supabase
    .from('lis_closure_items')
    .select('id, lis_code, date, patient_name, payment_method, amount, gross_amount, status, comprovante_status')
    .eq('closure_id', closureId);

  if (itemsError || !items) {
    console.error('Erro ao buscar itens do fechamento:', itemsError);
    return [];
  }

  const results: ReconciliationResult[] = [];

  for (const item of items) {
    // Buscar transações que possam corresponder
    const dateObj = new Date(item.date);
    const dateStart = new Date(dateObj);
    dateStart.setDate(dateStart.getDate() - toleranceDays);
    const dateEnd = new Date(dateObj);
    dateEnd.setDate(dateEnd.getDate() + toleranceDays);

    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('id, date, amount, description, lis_protocol_id')
      .or(`lis_protocol_id.eq.${item.lis_code},description.ilike.%[LIS ${item.lis_code}]%,description.ilike.%LIS:${item.lis_code}%`)
      .gte('date', dateStart.toISOString().split('T')[0])
      .lte('date', dateEnd.toISOString().split('T')[0])
      .is('deleted_at', null);

    if (txError) {
      console.error('Erro ao buscar transações:', txError);
      results.push({
        lisCode: item.lis_code,
        itemId: item.id,
        status: 'SEM_COMPROVANTE',
      });
      continue;
    }

    // Filtrar por valor exato
    const matchingTransactions = transactions?.filter(
      tx => Math.abs(tx.amount - item.amount) < 0.01
    ) || [];

    if (matchingTransactions.length === 0) {
      results.push({
        lisCode: item.lis_code,
        itemId: item.id,
        status: 'SEM_COMPROVANTE',
      });
    } else if (matchingTransactions.length === 1) {
      const tx = matchingTransactions[0];
      const divergenceType = tx.date !== item.date ? 'DATA' : null;
      
      results.push({
        lisCode: item.lis_code,
        itemId: item.id,
        status: 'CONCILIADO',
        matchedTransactionId: tx.id,
        matchedAmount: tx.amount,
        matchedDate: tx.date,
        divergenceType,
      });
    } else {
      // Múltiplas correspondências = possível duplicidade
      results.push({
        lisCode: item.lis_code,
        itemId: item.id,
        status: 'DUPLICIDADE',
      });
    }
  }

  return results;
}

/**
 * Atualiza o status de comprovante dos itens após conciliação
 */
export async function updateReconciliationStatus(
  results: ReconciliationResult[]
): Promise<void> {
  for (const result of results) {
    const updateData: Record<string, unknown> = {
      comprovante_status: result.status,
    };

    if (result.matchedTransactionId) {
      updateData.transaction_id = result.matchedTransactionId;
    }

    await supabase
      .from('lis_closure_items')
      .update(updateData)
      .eq('id', result.itemId);
  }
}

/**
 * Conta itens por status de comprovante
 */
export function countByComprovanteStatus(results: ReconciliationResult[]): {
  conciliado: number;
  semComprovante: number;
  duplicidade: number;
} {
  return {
    conciliado: results.filter(r => r.status === 'CONCILIADO').length,
    semComprovante: results.filter(r => r.status === 'SEM_COMPROVANTE').length,
    duplicidade: results.filter(r => r.status === 'DUPLICIDADE').length,
  };
}
