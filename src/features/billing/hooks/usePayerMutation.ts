import { useMutation, useQueryClient } from '@tanstack/react-query';
import { upsertPayer } from '../api/payers.api';
import { Payer } from '@/types/billing';
import { useToast } from '@/hooks/use-toast';

export function usePayerMutation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (payer: Partial<Payer> & { id?: string }) => upsertPayer(payer),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payers'] });
      toast({
        title: 'Convênio salvo',
        description: 'O convênio foi registrado com sucesso.',
      });
    },
    onError: (error) => {
      console.error('Error saving payer:', error);
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar o convênio.',
        variant: 'destructive',
      });
    },
  });
}
