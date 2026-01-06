import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { getPendingPixCount, getPendingCardCount } from '@/services/paymentResolutionService';

export interface BadgeCounts {
  caixaUnidades: number;      // Unidades sem fechamento hoje
  lucratividade: number;      // Categorias sem tax_group
  riscoEstrategia: number;    // Alertas de risco ativos
  tributacao: number;         // Config tributária incompleta
  pixPendentes: number;       // Códigos PIX pendentes
  cartaoPendentes: number;    // Códigos Cartão pendentes
  envelopesPendentes: number; // Envelopes aguardando conferência
  envelopesComDiferenca: number; // Envelopes com diferença
}

export function useBadgeCounts() {
  const { isAdmin, unit } = useAuth();

  return useQuery({
    queryKey: ['badge-counts', isAdmin, unit?.id],
    queryFn: async (): Promise<BadgeCounts> => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const lastMonth = subMonths(new Date(), 1);
      const startDate = format(startOfMonth(lastMonth), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(lastMonth), 'yyyy-MM-dd');
      
      // Executar todas as queries em paralelo para eliminar N+1
      const [
        unitsResult,
        closingsResult,
        categoriesResult,
        transactionsResult,
        taxConfigsResult,
        envelopesResult,
      ] = await Promise.all([
        supabase.from('units').select('*', { count: 'exact', head: true }),
        supabase.from('cash_closings').select('unit_id', { count: 'exact', head: true }).eq('date', today),
        supabase.from('categories').select('*', { count: 'exact', head: true }).eq('active', true).is('tax_group', null),
        supabase.from('transactions').select(`amount, type, category:categories!inner(entra_fator_r)`)
          .gte('date', startDate).lte('date', endDate).eq('status', 'APROVADA').is('deleted_at', null),
        supabase.from('tax_config').select('*', { count: 'exact', head: true }),
        supabase.from('cash_envelopes').select('id, difference, status').in('status', ['PENDENTE', 'EMITIDO']),
      ]);

      // 1. Unidades sem fechamento de caixa hoje
      let caixaUnidades = 0;
      if (isAdmin) {
        caixaUnidades = Math.max(0, (unitsResult.count || 0) - (closingsResult.count || 0));
      } else if (unit?.id) {
        const { data: hasClosing } = await supabase
          .from('cash_closings')
          .select('id')
          .eq('date', today)
          .eq('unit_id', unit.id)
          .limit(1);
        caixaUnidades = (!hasClosing || hasClosing.length === 0) ? 1 : 0;
      }

      // 2. Categorias ativas sem tax_group definido
      const lucratividade = categoriesResult.count || 0;

      // 3. Alertas de risco (Fator R baixo)
      let riscoEstrategia = 0;
      const transactions = transactionsResult.data;
      if (transactions && transactions.length > 0) {
        let totalReceitas = 0;
        let folhaPagamento = 0;

        transactions.forEach((t: any) => {
          if (t.type === 'ENTRADA') {
            totalReceitas += Number(t.amount);
          }
          if (t.type === 'SAIDA' && t.category?.entra_fator_r) {
            folhaPagamento += Number(t.amount);
          }
        });

        const fatorR = totalReceitas > 0 ? (folhaPagamento / totalReceitas) * 100 : 0;
        if (fatorR < 28) {
          riscoEstrategia++;
        }
      }

      // 4. Config tributária incompleta
      const tributacao = Math.max(0, (unitsResult.count || 0) - (taxConfigsResult.count || 0));

      // 5. Contagem de PIX e Cartão pendentes (apenas se usuário tem unidade)
      let pixPendentes = 0;
      let cartaoPendentes = 0;

      if (unit?.id) {
        try {
          [pixPendentes, cartaoPendentes] = await Promise.all([
            getPendingPixCount(unit.id),
            getPendingCardCount(unit.id),
          ]);
        } catch (err) {
          console.error('Erro ao buscar contagens de pagamento:', err);
        }
      }

      // 6. Contagem de envelopes pendentes
      const envelopesPendentes = envelopesResult.data?.length || 0;
      const envelopesComDiferenca = envelopesResult.data?.filter(
        (e) => e.difference && e.difference !== 0
      ).length || 0;

      return {
        caixaUnidades,
        lucratividade,
        riscoEstrategia,
        tributacao,
        pixPendentes,
        cartaoPendentes,
        envelopesPendentes,
        envelopesComDiferenca,
      };
    },
    staleTime: 1000 * 60 * 5, // 5 minutos
    refetchInterval: 1000 * 60 * 5, // Atualiza a cada 5 minutos
  });
}
