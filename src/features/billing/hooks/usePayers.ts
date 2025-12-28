import { useQuery } from '@tanstack/react-query';
import { fetchPayers } from '../api/payers.api';

export function usePayers(activeOnly = true) {
  return useQuery({
    queryKey: ['payers', activeOnly],
    queryFn: () => fetchPayers(activeOnly),
    staleTime: 1000 * 60 * 5, // 5 minutos
  });
}
