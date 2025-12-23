import { supabase } from '@/integrations/supabase/client';
import { BillingSummary } from '@/types/billing';

export async function fetchBillingSummary(
  year: number,
  month: number,
  unitId?: string
): Promise<BillingSummary> {
  // Buscar total de notas fiscais
  let invoicesQuery = supabase
    .from('invoices')
    .select('net_value, customer_name, payer_id')
    .eq('competence_year', year)
    .eq('competence_month', month)
    .neq('status', 'CANCELADA');

  if (unitId) {
    invoicesQuery = invoicesQuery.eq('unit_id', unitId);
  }

  const { data: invoices, error: invoicesError } = await invoicesQuery;
  if (invoicesError) throw invoicesError;

  // Buscar total de caixa (transações do LIS)
  let transactionsQuery = supabase
    .from('transactions')
    .select('amount, payment_method')
    .eq('type', 'ENTRADA')
    .eq('status', 'APROVADO')
    .eq('competencia_ano', year)
    .eq('competencia_mes', month)
    .not('lis_protocol_id', 'is', null);

  if (unitId) {
    transactionsQuery = transactionsQuery.eq('unit_id', unitId);
  }

  const { data: transactions, error: transactionsError } = await transactionsQuery;
  if (transactionsError) throw transactionsError;

  // Calcular totais
  const caixaByMethod = {
    dinheiro: 0,
    pix: 0,
    cartao: 0,
  };

  let caixaTotal = 0;
  (transactions || []).forEach((t) => {
    caixaTotal += Number(t.amount);
    if (t.payment_method === 'DINHEIRO') caixaByMethod.dinheiro += Number(t.amount);
    else if (t.payment_method === 'PIX') caixaByMethod.pix += Number(t.amount);
    else if (t.payment_method === 'CARTAO') caixaByMethod.cartao += Number(t.amount);
  });

  const invoicesByPayerMap = new Map<string, number>();
  let invoicesTotal = 0;
  (invoices || []).forEach((inv) => {
    invoicesTotal += Number(inv.net_value);
    const payerName = inv.customer_name || 'Sem identificação';
    invoicesByPayerMap.set(
      payerName,
      (invoicesByPayerMap.get(payerName) || 0) + Number(inv.net_value)
    );
  });

  const invoicesByPayer = Array.from(invoicesByPayerMap.entries())
    .map(([payerName, total]) => ({ payerName, total }))
    .sort((a, b) => b.total - a.total);

  return {
    month,
    year,
    caixaTotal,
    invoicesTotal,
    grandTotal: caixaTotal + invoicesTotal,
    caixaByMethod,
    invoicesByPayer,
  };
}
