import { useMutation, useQueryClient } from '@tanstack/react-query';
import { upsertInvoice, deleteInvoice } from '../api/invoices.api';
import { Invoice } from '@/types/billing';
import { toast } from 'sonner';

export function useInvoiceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (invoice: Partial<Invoice> & { id?: string }) => upsertInvoice(invoice),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Nota fiscal salva', {
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
      
      // Detectar erro de constraint única (duplicata)
      if (error?.code === '23505') {
        description = 'Esta nota fiscal já foi cadastrada anteriormente.';
      }
      
      // Detectar erro de tipo UUID inválido
      if (error?.code === '22P02' && error?.message?.includes('uuid')) {
        description = 'Dados inválidos. Verifique os campos e tente novamente.';
      }
      
      toast.error('Erro ao salvar', { description });
    },
  });
}

export function useDeleteInvoiceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteInvoice(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Nota fiscal excluída', {
        description: 'A nota fiscal foi removida com sucesso.',
      });
    },
    onError: (error: any) => {
      console.error('Error deleting invoice:', error);
      
      let description = 'Não foi possível excluir a nota fiscal.';
      
      if (error?.message?.includes('row-level security') || 
          error?.code === '42501') {
        description = 'Você não tem permissão para excluir notas fiscais.';
      }
      
      toast.error('Erro ao excluir', { description });
    },
  });
}
