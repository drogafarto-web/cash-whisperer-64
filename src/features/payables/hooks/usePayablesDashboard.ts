import { useQuery } from '@tanstack/react-query';
import { fetchPayablesDashboardSummary, fetchUnreconciledOutgoingTransactions } from '../api/transactions.api';

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
