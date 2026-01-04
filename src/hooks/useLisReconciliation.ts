import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getReconciliationSummary,
  linkTransactionToLis,
  logReconciliation,
  ReconciliationSummary,
} from '@/services/lisFinancialReconciliation';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

export function useLisReconciliation(
  unitId: string | undefined,
  startDate: string,
  endDate: string
) {
  return useQuery<ReconciliationSummary>({
    queryKey: ['lis-reconciliation', unitId, startDate, endDate],
    queryFn: () => {
      if (!unitId) {
        return Promise.resolve({
          lisWithoutFinancial: [],
          financialWithoutLis: [],
          duplicates: [],
          matched: [],
          totals: {
            lisCount: 0,
            lisAmount: 0,
            transactionCount: 0,
            transactionAmount: 0,
            matchedCount: 0,
            matchedAmount: 0,
          },
        });
      }
      return getReconciliationSummary(unitId, startDate, endDate);
    },
    enabled: !!unitId && !!startDate && !!endDate,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useLinkTransactionToLis() {
  const queryClient = useQueryClient();
  const { user, activeUnit } = useAuth();

  return useMutation({
    mutationFn: async ({
      transactionId,
      lisCode,
      lisItemId,
      date,
    }: {
      transactionId: string;
      lisCode: string;
      lisItemId?: string;
      date: string;
    }) => {
      const success = await linkTransactionToLis(transactionId, lisCode);
      if (!success) throw new Error('Failed to link transaction');

      // Log the reconciliation
      if (user && activeUnit) {
        await logReconciliation(
          lisCode,
          activeUnit.id,
          date,
          transactionId,
          lisItemId || null,
          'CONCILIADO',
          user.id,
          'Vinculação manual via tela de reconciliação'
        );
      }

      return success;
    },
    onSuccess: () => {
      toast.success('Transação vinculada ao código LIS com sucesso');
      queryClient.invalidateQueries({ queryKey: ['lis-reconciliation'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
    onError: () => {
      toast.error('Erro ao vincular transação');
    },
  });
}

export function useMarkAsNoMatch() {
  const queryClient = useQueryClient();
  const { user, activeUnit } = useAuth();

  return useMutation({
    mutationFn: async ({
      lisCode,
      lisItemId,
      date,
      notes,
    }: {
      lisCode: string;
      lisItemId: string;
      date: string;
      notes?: string;
    }) => {
      if (!user || !activeUnit) throw new Error('User not authenticated');

      return logReconciliation(
        lisCode,
        activeUnit.id,
        date,
        null,
        lisItemId,
        'SEM_MATCH',
        user.id,
        notes || 'Marcado como sem correspondência'
      );
    },
    onSuccess: () => {
      toast.success('Item marcado como sem correspondência');
      queryClient.invalidateQueries({ queryKey: ['lis-reconciliation'] });
    },
    onError: () => {
      toast.error('Erro ao marcar item');
    },
  });
}
