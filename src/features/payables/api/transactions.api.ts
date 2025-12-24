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

export interface MonthlyPayablesHistoryPoint {
  month: string;
  pagos: number;
  vencidos: number;
}

/**
 * Fetch monthly history of paid vs overdue payables for the last N months
 */
export async function fetchMonthlyPayablesHistory(
  unitId?: string,
  months: number = 6
): Promise<MonthlyPayablesHistoryPoint[]> {
  const today = new Date();
  const startDate = new Date(today.getFullYear(), today.getMonth() - months + 1, 1);
  const startDateStr = startDate.toISOString().split('T')[0];

  // Fetch paid payables (using paid_at for the month they were paid)
  let paidQuery = supabase
    .from('payables')
    .select('paid_at, paid_amount, valor')
    .eq('status', 'pago')
    .gte('paid_at', startDateStr);

  if (unitId) {
    paidQuery = paidQuery.eq('unit_id', unitId);
  }

  // Fetch overdue/pending payables (using vencimento for when they were due)
  let overdueQuery = supabase
    .from('payables')
    .select('vencimento, valor, status')
    .in('status', ['pendente', 'vencido'])
    .gte('vencimento', startDateStr)
    .lte('vencimento', today.toISOString().split('T')[0]);

  if (unitId) {
    overdueQuery = overdueQuery.eq('unit_id', unitId);
  }

  const [paidResult, overdueResult] = await Promise.all([paidQuery, overdueQuery]);

  if (paidResult.error) throw paidResult.error;
  if (overdueResult.error) throw overdueResult.error;

  // Group by month
  const monthlyData: Record<string, { pagos: number; vencidos: number }> = {};

  // Initialize all months
  for (let i = 0; i < months; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - months + 1 + i, 1);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthlyData[monthKey] = { pagos: 0, vencidos: 0 };
  }

  // Sum paid amounts by month
  for (const p of paidResult.data || []) {
    if (p.paid_at) {
      const paidDate = new Date(p.paid_at);
      const monthKey = `${paidDate.getFullYear()}-${String(paidDate.getMonth() + 1).padStart(2, '0')}`;
      if (monthlyData[monthKey]) {
        monthlyData[monthKey].pagos += p.paid_amount || p.valor;
      }
    }
  }

  // Sum overdue amounts by month
  for (const p of overdueResult.data || []) {
    const dueDate = new Date(p.vencimento);
    const monthKey = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}`;
    if (monthlyData[monthKey]) {
      monthlyData[monthKey].vencidos += p.valor;
    }
  }

  // Format month labels (MMM/YY)
  const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  
  return Object.entries(monthlyData)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, data]) => {
      const [year, month] = key.split('-');
      const monthLabel = `${monthNames[parseInt(month) - 1]}/${year.slice(2)}`;
      return {
        month: monthLabel,
        pagos: data.pagos,
        vencidos: data.vencidos,
      };
    });
}

export interface CategoryDistribution {
  category_id: string | null;
  category_name: string;
  count: number;
  total: number;
  color: string;
}

const CATEGORY_COLORS = [
  'hsl(220, 70%, 50%)',  // Blue
  'hsl(160, 60%, 45%)',  // Green
  'hsl(340, 75%, 55%)',  // Pink
  'hsl(40, 90%, 50%)',   // Orange
  'hsl(280, 60%, 55%)',  // Purple
  'hsl(190, 80%, 45%)',  // Cyan
  'hsl(0, 70%, 55%)',    // Red
  'hsl(60, 80%, 45%)',   // Yellow
];

/**
 * Fetch payables grouped by category for pie chart
 */
export async function fetchPayablesByCategory(unitId?: string): Promise<CategoryDistribution[]> {
  // Fetch payables with category info
  let query = supabase
    .from('payables')
    .select(`
      id,
      valor,
      category_id,
      categories (
        id,
        name
      )
    `)
    .in('status', ['pendente', 'vencido']);

  if (unitId) {
    query = query.eq('unit_id', unitId);
  }

  const { data, error } = await query;

  if (error) throw error;

  // Group by category
  const categoryMap = new Map<string | null, { name: string; count: number; total: number }>();

  for (const p of data || []) {
    const categoryId = p.category_id;
    const categoryName = (p.categories as { id: string; name: string } | null)?.name || 'Sem categoria';
    
    const existing = categoryMap.get(categoryId) || { name: categoryName, count: 0, total: 0 };
    existing.count += 1;
    existing.total += p.valor;
    categoryMap.set(categoryId, existing);
  }

  // Convert to array and sort by total descending
  const result: CategoryDistribution[] = Array.from(categoryMap.entries())
    .map(([category_id, data], index) => ({
      category_id,
      category_name: data.name,
      count: data.count,
      total: data.total,
      color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
    }))
    .sort((a, b) => b.total - a.total);

  return result;
}
