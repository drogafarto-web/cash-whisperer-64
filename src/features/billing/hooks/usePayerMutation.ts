import { useMutation, useQueryClient } from '@tanstack/react-query';
import { upsertPayer } from '../api/payers.api';
import { Payer } from '@/types/billing';
import { toast } from 'sonner';

export function usePayerMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payer: Partial<Payer> & { id?: string }) => upsertPayer(payer),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payers'] });
      toast.success('Convênio salvo', {
        description: 'O convênio foi registrado com sucesso.',
      });
    },
    onError: (error) => {
      console.error('Error saving payer:', error);
      toast.error('Erro ao salvar', {
        description: 'Não foi possível salvar o convênio.',
      });
    },
  });
}
