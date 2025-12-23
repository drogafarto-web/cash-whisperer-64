import { useMutation, useQueryClient } from '@tanstack/react-query';
import { upsertInvoice } from '../api/invoices.api';
import { Invoice } from '@/types/billing';
import { useToast } from '@/hooks/use-toast';

export function useInvoiceMutation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (invoice: Partial<Invoice> & { id?: string }) => upsertInvoice(invoice),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast({
        title: 'Nota fiscal salva',
        description: 'A nota fiscal foi registrada com sucesso.',
      });
    },
    onError: (error) => {
      console.error('Error saving invoice:', error);
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar a nota fiscal.',
        variant: 'destructive',
      });
    },
  });
}
