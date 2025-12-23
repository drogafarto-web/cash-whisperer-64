import { useQuery } from '@tanstack/react-query';
import { fetchBillingSummary } from '../api/summary.api';

export function useBillingSummary(year: number, month: number, unitId?: string) {
  return useQuery({
    queryKey: ['billing-summary', year, month, unitId],
    queryFn: () => fetchBillingSummary(year, month, unitId),
  });
}
