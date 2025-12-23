import { useQuery } from '@tanstack/react-query';
import { fetchInvoices, InvoiceFilters } from '../api/invoices.api';

export function useInvoices(filters?: InvoiceFilters) {
  return useQuery({
    queryKey: ['invoices', filters],
    queryFn: () => fetchInvoices(filters),
  });
}
