import { supabase } from '@/integrations/supabase/client';

export interface BankRecord {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'entrada' | 'saida';
}

/**
 * Fetch outgoing transactions that are not yet reconciled with any payable
 */
export async function fetchUnreconciledOutgoingTransactions(unitId?: string): Promise<BankRecord[]> {
  // First, get all payable matched transaction IDs
  const { data: payablesWithMatch } = await supabase
    .from('payables')
    .select('matched_transaction_id')
    .not('matched_transaction_id', 'is', null);

  const matchedTransactionIds = (payablesWithMatch || [])
    .map(p => p.matched_transaction_id)
    .filter(Boolean) as string[];

  // Build query for outgoing transactions
  let query = supabase
    .from('transactions')
    .select('id, date, description, amount, type')
    .eq('type', 'SAIDA')
    .eq('status', 'APROVADO')
    .order('date', { ascending: false })
    .limit(100);

  if (unitId) {
    query = query.eq('unit_id', unitId);
  }

  // Exclude already matched transactions
  if (matchedTransactionIds.length > 0) {
    query = query.not('id', 'in', `(${matchedTransactionIds.join(',')})`);
  }

  const { data, error } = await query;

  if (error) throw error;

  // Transform to BankRecord format
  return (data || []).map(t => ({
    id: t.id,
    date: t.date,
    description: t.description || 'Sem descrição',
    amount: Math.abs(t.amount),
    type: 'saida' as const,
  }));
}

/**
 * Fetch summary data for payables dashboard
 */
export async function fetchPayablesDashboardSummary(unitId?: string) {
  const today = new Date().toISOString().split('T')[0];
  const in7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const in15Days = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  let baseQuery = supabase.from('payables').select('*');

  if (unitId) {
    baseQuery = baseQuery.eq('unit_id', unitId);
  }

  // Fetch all pending/overdue payables
  const { data: allPayables, error } = await baseQuery
    .in('status', ['pendente', 'vencido'])
    .order('vencimento', { ascending: true });

  if (error) throw error;

  const payables = allPayables || [];

  // Calculate summaries
  const overdue = payables.filter(p => p.vencimento < today);
  const next7Days = payables.filter(p => p.vencimento >= today && p.vencimento <= in7Days);
  const next15Days = payables.filter(p => p.vencimento >= today && p.vencimento <= in15Days);
  const next30Days = payables.filter(p => p.vencimento >= today && p.vencimento <= in30Days);

  const overdueTotal = overdue.reduce((sum, p) => sum + p.valor, 0);
  const next7DaysTotal = next7Days.reduce((sum, p) => sum + p.valor, 0);
  const next15DaysTotal = next15Days.reduce((sum, p) => sum + p.valor, 0);
  const next30DaysTotal = next30Days.reduce((sum, p) => sum + p.valor, 0);

  // Group by week for chart
  const weeklyData = groupPayablesByWeek(payables);

  // Upcoming (today/tomorrow)
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const upcoming = payables.filter(p => p.vencimento === today || p.vencimento === tomorrow);

  return {
    overdue: { count: overdue.length, total: overdueTotal, items: overdue.slice(0, 5) },
    next7Days: { count: next7Days.length, total: next7DaysTotal },
    next15Days: { count: next15Days.length, total: next15DaysTotal },
    next30Days: { count: next30Days.length, total: next30DaysTotal },
    upcoming,
    weeklyData,
    totalPending: payables.length,
    totalValue: payables.reduce((sum, p) => sum + p.valor, 0),
  };
}

function groupPayablesByWeek(payables: Array<{ vencimento: string; valor: number }>) {
  const weeks: Record<string, number> = {};
  const today = new Date();

  for (const p of payables) {
    const dueDate = new Date(p.vencimento);
    const diffDays = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const weekNumber = Math.floor(diffDays / 7);

    if (weekNumber >= 0 && weekNumber < 6) {
      const weekLabel = weekNumber === 0 ? 'Esta semana' : `Semana ${weekNumber + 1}`;
      weeks[weekLabel] = (weeks[weekLabel] || 0) + p.valor;
    }
  }

  return Object.entries(weeks).map(([name, value]) => ({ name, value }));
}
