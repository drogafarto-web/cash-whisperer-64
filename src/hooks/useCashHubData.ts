import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import {
  getPendingCashCount,
  getPendingCashTotal,
  getPendingPixCount,
  getPendingPixTotal,
  getPendingCardCount,
  getPendingCardTotals,
  CardTotals,
} from '@/services/paymentResolutionService';

export interface CashHubData {
  cash: {
    count: number;
    total: number;
  };
  pix: {
    count: number;
    total: number;
  };
  card: {
    count: number;
  } & CardTotals;
}

export function useCashHubData() {
  const { unit } = useAuth();

  return useQuery<CashHubData>({
    queryKey: ['cash-hub-data', unit?.id],
    queryFn: async () => {
      if (!unit?.id) throw new Error('Sem unidade');

      const [
        cashCount,
        cashTotal,
        pixCount,
        pixTotal,
        cardCount,
        cardTotals,
      ] = await Promise.all([
        getPendingCashCount(unit.id),
        getPendingCashTotal(unit.id),
        getPendingPixCount(unit.id),
        getPendingPixTotal(unit.id),
        getPendingCardCount(unit.id),
        getPendingCardTotals(unit.id),
      ]);

      return {
        cash: { count: cashCount, total: cashTotal },
        pix: { count: pixCount, total: pixTotal },
        card: { count: cardCount, ...cardTotals },
      };
    },
    enabled: !!unit?.id,
    refetchInterval: 30000, // Atualiza a cada 30s
  });
}
