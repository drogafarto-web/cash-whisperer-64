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
      const lastMonth = subMonths(new Date(), 1);
      const startDate = format(startOfMonth(lastMonth), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(lastMonth), 'yyyy-MM-dd');
      const mesReferencia = format(lastMonth, 'MM/yyyy');

      // Executar todas as queries em paralelo para eliminar N+1
      const [
        unitsResult,
        closingsResult,
        categoriesResult,
        taxConfigsResult,
        transactionsResult,
      ] = await Promise.all([
        supabase.from('units').select('id, name, code'),
        supabase.from('cash_closings').select('unit_id').eq('date', today),
        supabase.from('categories').select('id, name, type').eq('active', true).is('tax_group', null),
        supabase.from('tax_config').select('unit_id'),
        supabase.from('transactions').select(`amount, type, category:categories!inner(entra_fator_r)`)
          .gte('date', startDate).lte('date', endDate).eq('status', 'APROVADA').is('deleted_at', null),
      ]);

      const allUnits = unitsResult.data || [];
      const todayClosings = closingsResult.data || [];
      const categoriesWithoutTaxGroup = categoriesResult.data || [];
      const taxConfigs = taxConfigsResult.data || [];
      const transactions = transactionsResult.data || [];

      // 1. Unidades sem fechamento de caixa hoje
      let unidadesSemFechamento: UnitPending[] = [];
      const closedUnitIds = new Set(todayClosings.map(c => c.unit_id));
      
      if (isAdmin) {
        unidadesSemFechamento = allUnits.filter(u => !closedUnitIds.has(u.id));
      } else if (unit?.id) {
        if (!closedUnitIds.has(unit.id)) {
          unidadesSemFechamento = [{ id: unit.id, name: unit.name, code: unit.code }];
        }
      }

      // 2. Categorias ativas sem tax_group
      const categoriasSemTaxGroup: CategoryPending[] = categoriesWithoutTaxGroup.map(c => ({
        id: c.id,
        name: c.name,
        type: c.type,
      }));

      // 3. Unidades sem config tributária
      const configuredUnitIds = new Set(taxConfigs.map(c => c.unit_id).filter(Boolean));
      const unidadesSemTaxConfig: UnitPending[] = allUnits.filter(u => !configuredUnitIds.has(u.id));

      // 4. Status do Fator R do mês anterior
      let fatorRStatus: FatorRStatus | null = null;

      if (transactions.length > 0) {
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
