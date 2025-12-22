import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';

export interface UnitPending {
  id: string;
  name: string;
  code: string;
}

export interface CategoryPending {
  id: string;
  name: string;
  type: string;
}

export interface FatorRStatus {
  fatorR: number;
  totalReceitas: number;
  folhaPagamento: number;
  mesReferencia: string;
  alertLevel: 'ok' | 'warning' | 'critical';
}

export interface PendingDetails {
  unidadesSemFechamento: UnitPending[];
  unidadesSemTaxConfig: UnitPending[];
  categoriasSemTaxGroup: CategoryPending[];
  fatorRStatus: FatorRStatus | null;
}

export function usePendingDetails() {
  const { isAdmin, unit } = useAuth();

  return useQuery({
    queryKey: ['pending-details', isAdmin, unit?.id],
    queryFn: async (): Promise<PendingDetails> => {
      const today = format(new Date(), 'yyyy-MM-dd');
      
      // 1. Unidades sem fechamento de caixa hoje
      let unidadesSemFechamento: UnitPending[] = [];
      
      if (isAdmin) {
        // Buscar todas as unidades
        const { data: allUnits } = await supabase
          .from('units')
          .select('id, name, code');
        
        // Buscar fechamentos de hoje
        const { data: todayClosings } = await supabase
          .from('cash_closings')
          .select('unit_id')
          .eq('date', today);
        
        const closedUnitIds = new Set(todayClosings?.map(c => c.unit_id) || []);
        
        unidadesSemFechamento = (allUnits || []).filter(u => !closedUnitIds.has(u.id));
      } else if (unit?.id) {
        const { data: hasClosing } = await supabase
          .from('cash_closings')
          .select('id')
          .eq('date', today)
          .eq('unit_id', unit.id)
          .limit(1);
        
        if (!hasClosing || hasClosing.length === 0) {
          unidadesSemFechamento = [{ id: unit.id, name: unit.name, code: unit.code }];
        }
      }

      // 2. Categorias ativas sem tax_group
      const { data: categoriesWithoutTaxGroup } = await supabase
        .from('categories')
        .select('id, name, type')
        .eq('active', true)
        .is('tax_group', null);
      
      const categoriasSemTaxGroup: CategoryPending[] = (categoriesWithoutTaxGroup || []).map(c => ({
        id: c.id,
        name: c.name,
        type: c.type,
      }));

      // 3. Unidades sem config tributária
      let unidadesSemTaxConfig: UnitPending[] = [];
      
      const { data: allUnits } = await supabase
        .from('units')
        .select('id, name, code');
      
      const { data: taxConfigs } = await supabase
        .from('tax_config')
        .select('unit_id');
      
      const configuredUnitIds = new Set(taxConfigs?.map(c => c.unit_id).filter(Boolean) || []);
      
      unidadesSemTaxConfig = (allUnits || []).filter(u => !configuredUnitIds.has(u.id));

      // 4. Status do Fator R do mês anterior
      let fatorRStatus: FatorRStatus | null = null;
      
      const lastMonth = subMonths(new Date(), 1);
      const startDate = format(startOfMonth(lastMonth), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(lastMonth), 'yyyy-MM-dd');
      const mesReferencia = format(lastMonth, 'MM/yyyy');

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
        
        let alertLevel: 'ok' | 'warning' | 'critical' = 'ok';
        if (fatorR < 28) {
          alertLevel = 'critical';
        } else if (fatorR < 30) {
          alertLevel = 'warning';
        }

        fatorRStatus = {
          fatorR,
          totalReceitas,
          folhaPagamento,
          mesReferencia,
          alertLevel,
        };
      }

      return {
        unidadesSemFechamento,
        unidadesSemTaxConfig,
        categoriasSemTaxGroup,
        fatorRStatus,
      };
    },
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 5,
  });
}
