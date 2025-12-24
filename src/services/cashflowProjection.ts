import { supabase } from '@/integrations/supabase/client';
import { format, addWeeks, startOfWeek, endOfWeek, isAfter, isBefore, isWithinInterval, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface CashflowItem {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'ENTRADA' | 'SAIDA';
  source: 'invoice' | 'payable' | 'cash_closing';
}

export interface CashflowWeek {
  weekNumber: number;
  weekStart: Date;
  weekEnd: Date;
  weekLabel: string;
  openingBalance: number;
  expectedInflows: CashflowItem[];
  scheduledOutflows: CashflowItem[];
  totalInflows: number;
  totalOutflows: number;
  netFlow: number;
  closingBalance: number;
  status: 'POSITIVO' | 'BAIXO' | 'NEGATIVO';
}

export interface CashflowProjectionResult {
  weeks: CashflowWeek[];
  summary: {
    currentBalance: number;
    totalProjectedInflows: number;
    totalProjectedOutflows: number;
    finalProjectedBalance: number;
    weeksWithNegativeBalance: number;
    firstNegativeWeek: CashflowWeek | null;
  };
}

export interface CashflowAlert {
  id: string;
  unitId: string | null;
  unitName: string;
  weekStart: Date;
  projectedBalance: number;
  alertType: 'NEGATIVO' | 'BAIXO' | 'OK';
}

const BALANCE_THRESHOLD_LOW = 5000; // Threshold for "low" balance alert

export async function getLastCashClosingBalance(unitId?: string): Promise<number> {
  let query = supabase
    .from('cash_closings')
    .select('actual_balance')
    .order('date', { ascending: false })
    .limit(1);

  if (unitId && unitId !== 'all') {
    query = query.eq('unit_id', unitId);
  }

  const { data, error } = await query;
  
  if (error || !data || data.length === 0) {
    return 0;
  }
  
  return Number(data[0].actual_balance) || 0;
}

export async function fetchPendingInvoices(unitId?: string): Promise<CashflowItem[]> {
  let query = supabase
    .from('invoices')
    .select('id, customer_name, net_value, issue_date, received_at')
    .eq('status', 'ABERTA')
    .is('received_at', null);

  if (unitId && unitId !== 'all') {
    query = query.eq('unit_id', unitId);
  }

  const { data, error } = await query;

  if (error || !data) {
    console.error('Error fetching pending invoices:', error);
    return [];
  }

  // Estimate receipt date as 30 days from issue
  return data.map(inv => ({
    id: inv.id,
    date: format(addDays(new Date(inv.issue_date), 30), 'yyyy-MM-dd'),
    description: `NF ${inv.customer_name}`,
    amount: Number(inv.net_value) || 0,
    type: 'ENTRADA' as const,
    source: 'invoice' as const,
  }));
}

export async function fetchPendingPayables(unitId?: string): Promise<CashflowItem[]> {
  let query = supabase
    .from('payables')
    .select('id, beneficiario, valor, vencimento, description')
    .eq('status', 'PENDENTE');

  if (unitId && unitId !== 'all') {
    query = query.eq('unit_id', unitId);
  }

  const { data, error } = await query;

  if (error || !data) {
    console.error('Error fetching pending payables:', error);
    return [];
  }

  return data.map(pay => ({
    id: pay.id,
    date: pay.vencimento,
    description: pay.beneficiario || pay.description || 'Boleto',
    amount: Number(pay.valor) || 0,
    type: 'SAIDA' as const,
    source: 'payable' as const,
  }));
}

export function projectCashflow(
  lastClosingBalance: number,
  pendingInvoices: CashflowItem[],
  pendingPayables: CashflowItem[],
  weeks: number = 8
): CashflowProjectionResult {
  const today = new Date();
  const weeklyData: CashflowWeek[] = [];
  let runningBalance = lastClosingBalance;

  for (let i = 0; i < weeks; i++) {
    const weekStart = startOfWeek(addWeeks(today, i), { weekStartsOn: 1 }); // Monday
    const weekEnd = endOfWeek(addWeeks(today, i), { weekStartsOn: 1 }); // Sunday

    // Filter items for this week
    const weekInflows = pendingInvoices.filter(item => {
      const itemDate = new Date(item.date);
      return isWithinInterval(itemDate, { start: weekStart, end: weekEnd });
    });

    const weekOutflows = pendingPayables.filter(item => {
      const itemDate = new Date(item.date);
      return isWithinInterval(itemDate, { start: weekStart, end: weekEnd });
    });

    const totalInflows = weekInflows.reduce((sum, item) => sum + item.amount, 0);
    const totalOutflows = weekOutflows.reduce((sum, item) => sum + item.amount, 0);
    const netFlow = totalInflows - totalOutflows;
    const closingBalance = runningBalance + netFlow;

    let status: 'POSITIVO' | 'BAIXO' | 'NEGATIVO' = 'POSITIVO';
    if (closingBalance < 0) {
      status = 'NEGATIVO';
    } else if (closingBalance < BALANCE_THRESHOLD_LOW) {
      status = 'BAIXO';
    }

    weeklyData.push({
      weekNumber: i + 1,
      weekStart,
      weekEnd,
      weekLabel: `${format(weekStart, 'dd/MM', { locale: ptBR })} - ${format(weekEnd, 'dd/MM', { locale: ptBR })}`,
      openingBalance: runningBalance,
      expectedInflows: weekInflows,
      scheduledOutflows: weekOutflows,
      totalInflows,
      totalOutflows,
      netFlow,
      closingBalance,
      status,
    });

    runningBalance = closingBalance;
  }

  const weeksNegative = weeklyData.filter(w => w.status === 'NEGATIVO');

  return {
    weeks: weeklyData,
    summary: {
      currentBalance: lastClosingBalance,
      totalProjectedInflows: pendingInvoices.reduce((sum, i) => sum + i.amount, 0),
      totalProjectedOutflows: pendingPayables.reduce((sum, p) => sum + p.amount, 0),
      finalProjectedBalance: weeklyData[weeklyData.length - 1]?.closingBalance || lastClosingBalance,
      weeksWithNegativeBalance: weeksNegative.length,
      firstNegativeWeek: weeksNegative[0] || null,
    },
  };
}

export async function runCashflowProjection(unitId?: string, weeks: number = 8): Promise<CashflowProjectionResult> {
  const [lastBalance, pendingInvoices, pendingPayables] = await Promise.all([
    getLastCashClosingBalance(unitId),
    fetchPendingInvoices(unitId),
    fetchPendingPayables(unitId),
  ]);

  return projectCashflow(lastBalance, pendingInvoices, pendingPayables, weeks);
}
