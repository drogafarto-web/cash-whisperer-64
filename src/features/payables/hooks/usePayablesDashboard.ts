import { useQuery } from '@tanstack/react-query';
import { 
  fetchPayablesDashboardSummary, 
  fetchUnreconciledOutgoingTransactions,
  fetchMonthlyPayablesHistory,
  fetchPayablesByCategory,
} from '../api/transactions.api';

export function usePayablesDashboard(unitId?: string) {
  return useQuery({
    queryKey: ['payables-dashboard', unitId],
    queryFn: () => fetchPayablesDashboardSummary(unitId),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useUnreconciledTransactions(unitId?: string) {
  return useQuery({
    queryKey: ['unreconciled-transactions', unitId],
    queryFn: () => fetchUnreconciledOutgoingTransactions(unitId),
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

export function usePayablesMonthlyHistory(unitId?: string, months: number = 6) {
  return useQuery({
    queryKey: ['payables-monthly-history', unitId, months],
    queryFn: () => fetchMonthlyPayablesHistory(unitId, months),
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}

export function usePayablesByCategory(unitId?: string) {
  return useQuery({
    queryKey: ['payables-by-category', unitId],
    queryFn: () => fetchPayablesByCategory(unitId),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
