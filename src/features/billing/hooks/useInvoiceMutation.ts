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
    onError: (error: any) => {
      console.error('Error saving invoice:', error);
      
      let description = 'Não foi possível salvar a nota fiscal.';
      
      // Detectar erro de RLS
      if (error?.message?.includes('row-level security') || 
          error?.code === '42501' ||
          error?.message?.includes('permission denied') ||
          error?.message?.includes('violates row-level security')) {
        description = 'Você não tem permissão para salvar notas fiscais. Verifique se possui role admin ou contabilidade.';
      }
      
      // Detectar erro de tipo UUID inválido
      if (error?.code === '22P02' && error?.message?.includes('uuid')) {
        description = 'Dados inválidos. Verifique os campos e tente novamente.';
      }
      
      toast({
        title: 'Erro ao salvar',
        description,
        variant: 'destructive',
      });
    },
  });
}
