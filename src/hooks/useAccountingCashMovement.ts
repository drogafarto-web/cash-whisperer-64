import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Dados de movimento de caixa agregados por competência
 * Origem: Central de Fechamento (lis_closures / lis_closure_items)
 * Valores agregados por competência (ano/mês) e unidade
 */
export interface CashMovementData {
  total: number;
  money: number;     // DINHEIRO
  pix: number;       // PIX
  card: number;      // CARTAO (valor líquido)
  cardFees: number;  // Taxa de cartão
  unpaid: number;    // NAO_PAGO
  closuresCount: number;
}

interface UseAccountingCashMovementResult {
  data: CashMovementData | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook para buscar dados de movimento de caixa da central de fechamento
 * Agrega valores de lis_closures para a competência e unidade selecionadas
 */
export function useAccountingCashMovement(
  unitId: string | null,
  year: number,
  month: number
): UseAccountingCashMovementResult {
  const { data, isLoading, error } = useQuery({
    queryKey: ['accounting-cash-movement', unitId, year, month],
    queryFn: async (): Promise<CashMovementData> => {
      if (!unitId) {
        return { total: 0, money: 0, pix: 0, card: 0, cardFees: 0, unpaid: 0, closuresCount: 0 };
      }

      // Calcular range de datas para a competência
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDate = month === 12 
        ? `${year + 1}-01-01` 
        : `${year}-${String(month + 1).padStart(2, '0')}-01`;

      // Buscar dados agregados de lis_closures
      // A tabela já tem os totais por fechamento
      const { data: closures, error: queryError } = await supabase
        .from('lis_closures')
        .select('total_dinheiro, total_pix, total_cartao_liquido, total_taxa_cartao, total_nao_pago')
        .eq('unit_id', unitId)
        .gte('period_start', startDate)
        .lt('period_start', endDate);

      if (queryError) {
        throw queryError;
      }

      // Se há fechamentos LIS, usar esses dados
      if (closures && closures.length > 0) {
        const aggregated = closures.reduce(
          (acc, closure) => ({
            money: acc.money + (closure.total_dinheiro || 0),
            pix: acc.pix + (closure.total_pix || 0),
            card: acc.card + (closure.total_cartao_liquido || 0),
            cardFees: acc.cardFees + (closure.total_taxa_cartao || 0),
            unpaid: acc.unpaid + (closure.total_nao_pago || 0),
          }),
          { money: 0, pix: 0, card: 0, cardFees: 0, unpaid: 0 }
        );

        const total = aggregated.money + aggregated.pix + aggregated.card;

        return {
          ...aggregated,
          total,
          closuresCount: closures.length,
        };
      }

      // Fallback: buscar de transactions quando não há lis_closures
      const { data: transactions, error: txError } = await supabase
        .from('transactions')
        .select('amount, payment_method')
        .eq('unit_id', unitId)
        .eq('type', 'ENTRADA')
        .eq('status', 'APROVADO')
        .gte('date', startDate)
        .lt('date', endDate);

      if (txError) {
        throw txError;
      }

      // Agregar por método de pagamento
      const txAggregated = (transactions || []).reduce(
        (acc, tx) => {
          const amount = Number(tx.amount) || 0;
          const method = tx.payment_method?.toUpperCase();
          if (method === 'DINHEIRO') acc.money += amount;
          else if (method === 'PIX') acc.pix += amount;
          else if (method === 'CARTAO' || method === 'CARTÃO') acc.card += amount;
          return acc;
        },
        { money: 0, pix: 0, card: 0, cardFees: 0, unpaid: 0 }
      );

      return {
        ...txAggregated,
        total: txAggregated.money + txAggregated.pix + txAggregated.card,
        closuresCount: 0,
      };
    },
    enabled: !!unitId,
    staleTime: 5 * 60 * 1000, // 5 minutos
  });

  return {
    data: data || null,
    isLoading,
    error: error as Error | null,
  };
}
