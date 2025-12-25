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
}

export function useBadgeCounts() {
  const { isAdmin, unit } = useAuth();

  return useQuery({
    queryKey: ['badge-counts', isAdmin, unit?.id],
    queryFn: async (): Promise<BadgeCounts> => {
      const today = format(new Date(), 'yyyy-MM-dd');
      
      // 1. Unidades sem fechamento de caixa hoje
      let caixaUnidades = 0;
      
      if (isAdmin) {
        // Admin vê todas as unidades
        const { count: unitsCount } = await supabase
          .from('units')
          .select('*', { count: 'exact', head: true });
        
        const { count: closingsCount } = await supabase
          .from('cash_closings')
          .select('unit_id', { count: 'exact', head: true })
          .eq('date', today);
        
        caixaUnidades = Math.max(0, (unitsCount || 0) - (closingsCount || 0));
      } else if (unit?.id) {
        // Usuário de unidade vê apenas sua unidade
        const { data: hasClosing } = await supabase
          .from('cash_closings')
          .select('id')
          .eq('date', today)
          .eq('unit_id', unit.id)
          .limit(1);
        
        caixaUnidades = (!hasClosing || hasClosing.length === 0) ? 1 : 0;
      }

      // 2. Categorias ativas sem tax_group definido
      const { count: categoriesWithoutTaxGroup } = await supabase
        .from('categories')
        .select('*', { count: 'exact', head: true })
        .eq('active', true)
        .is('tax_group', null);
      
      const lucratividade = categoriesWithoutTaxGroup || 0;

      // 3. Alertas de risco (Fator R baixo)
      let riscoEstrategia = 0;
      
      // Calcular Fator R do mês anterior
      const lastMonth = subMonths(new Date(), 1);
      const startDate = format(startOfMonth(lastMonth), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(lastMonth), 'yyyy-MM-dd');

      // Buscar transações do mês anterior para calcular Fator R
      const { data: transactions } = await supabase
        .from('transactions')
        .select(`
          amount,
          type,
          category:categories!inner(entra_fator_r)
        `)
        .gte('date', startDate)
        .lte('date', endDate)
        .eq('status', 'APROVADA')
        .is('deleted_at', null);

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
        
        // Alerta se Fator R < 28%
        if (fatorR < 28) {
          riscoEstrategia++;
        }
      }

      // Verificar alertas de system_config
      const { data: alertConfig } = await supabase
        .from('system_config')
        .select('value')
        .eq('key', 'alert_thresholds')
        .single();

      if (alertConfig?.value) {
        const thresholds = alertConfig.value as any;
        // Adicionar outros alertas baseado nos thresholds configurados
        if (thresholds.folha_informal_max) {
          // Poderia verificar proporção de folha informal aqui
        }
      }

      // 4. Config tributária incompleta
      let tributacao = 0;
      
      const { data: taxConfigs, count: taxConfigCount } = await supabase
        .from('tax_config')
        .select('*', { count: 'exact' });
      
      const { count: unitsTotal } = await supabase
        .from('units')
        .select('*', { count: 'exact', head: true });
      
      // Alerta se há unidades sem config tributária
      if ((unitsTotal || 0) > (taxConfigCount || 0)) {
        tributacao = (unitsTotal || 0) - (taxConfigCount || 0);
      }

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

      return {
        caixaUnidades,
        lucratividade,
        riscoEstrategia,
        tributacao,
        pixPendentes,
        cartaoPendentes,
      };
    },
    staleTime: 1000 * 60 * 5, // 5 minutos
    refetchInterval: 1000 * 60 * 5, // Atualiza a cada 5 minutos
  });
}
