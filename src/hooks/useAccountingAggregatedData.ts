import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook central que agrega dados contábeis de múltiplas fontes
 * Prioridade: payables reais > accounting_competence_data > dados legados
 */

export interface AggregatedFolhaData {
  total_folha: number;
  encargos: number;
  prolabore: number;
  num_funcionarios: number;
  source: 'payables' | 'competence_data' | 'empty';
}

export interface AggregatedImpostosData {
  das: number;
  darf: number;
  gps: number;
  inss: number;
  fgts: number;
  iss: number;
  total: number;
  source: 'payables' | 'competence_data' | 'empty';
}

export interface AggregatedReceitaData {
  servicos: number;
  outras: number;
  total: number;
  source: 'invoices' | 'competence_data' | 'empty';
}

export interface AggregatedAccountingData {
  folha: AggregatedFolhaData;
  impostos: AggregatedImpostosData;
  receita: AggregatedReceitaData;
  isLoading: boolean;
}

/**
 * Verifica se accounting_competence_data tem dados reais (não zerados)
 */
export function hasRealCompetenceData(data: any | null): boolean {
  if (!data) return false;
  
  return (
    (data.total_folha ?? 0) > 0 ||
    (data.encargos ?? 0) > 0 ||
    (data.prolabore ?? 0) > 0 ||
    (data.das_valor ?? 0) > 0 ||
    (data.darf_valor ?? 0) > 0 ||
    (data.gps_valor ?? 0) > 0 ||
    (data.inss_valor ?? 0) > 0 ||
    (data.fgts_valor ?? 0) > 0 ||
    (data.iss_valor ?? 0) > 0 ||
    (data.receita_servicos ?? 0) > 0 ||
    (data.receita_outras ?? 0) > 0
  );
}

/**
 * Hook para buscar dados de folha agregados (payables ou competence_data)
 */
export function useAggregatedFolhaData(unitId: string | null, ano: number, mes: number) {
  return useQuery({
    queryKey: ['accounting-aggregated-folha', unitId, ano, mes],
    queryFn: async (): Promise<AggregatedFolhaData> => {
      if (!unitId) {
        return { total_folha: 0, encargos: 0, prolabore: 0, num_funcionarios: 0, source: 'empty' };
      }

      const startDate = `${ano}-${String(mes).padStart(2, '0')}-01`;
      const endDate = `${ano}-${String(mes).padStart(2, '0')}-31`;

      // 1. Buscar payables de folha (PESSOAL)
      const { data: payablesData } = await supabase
        .from('payables')
        .select(`id, beneficiario, valor, category_id, categories!inner(tax_group)`)
        .eq('unit_id', unitId)
        .eq('tipo', 'titulo')
        .gte('vencimento', startDate)
        .lte('vencimento', endDate)
        .neq('status', 'CANCELADO');

      const folhaPayables = payablesData?.filter((p: any) => p.categories?.tax_group === 'PESSOAL') || [];

      if (folhaPayables.length > 0) {
        // Separar salários de encargos
        const salarios = folhaPayables.filter((p: any) =>
          !p.beneficiario?.toLowerCase().includes('encargo')
        );
        const encargos = folhaPayables.filter((p: any) =>
          p.beneficiario?.toLowerCase().includes('encargo')
        );
        const prolabore = folhaPayables.filter((p: any) =>
          p.beneficiario?.toLowerCase().includes('pró-labore') || 
          p.beneficiario?.toLowerCase().includes('prolabore')
        );

        return {
          total_folha: salarios.reduce((sum: number, p: any) => sum + (p.valor || 0), 0),
          encargos: encargos.reduce((sum: number, p: any) => sum + (p.valor || 0), 0),
          prolabore: prolabore.reduce((sum: number, p: any) => sum + (p.valor || 0), 0),
          num_funcionarios: salarios.filter((p: any) => 
            !p.beneficiario?.toLowerCase().includes('pró-labore') &&
            !p.beneficiario?.toLowerCase().includes('prolabore')
          ).length,
          source: 'payables',
        };
      }

      // 2. Fallback: buscar de accounting_competence_data
      const { data: competenceData } = await supabase
        .from('accounting_competence_data')
        .select('total_folha, encargos, prolabore, num_funcionarios')
        .eq('unit_id', unitId)
        .eq('ano', ano)
        .eq('mes', mes)
        .maybeSingle();

      if (competenceData && hasRealCompetenceData(competenceData)) {
        return {
          total_folha: competenceData.total_folha || 0,
          encargos: competenceData.encargos || 0,
          prolabore: competenceData.prolabore || 0,
          num_funcionarios: competenceData.num_funcionarios || 0,
          source: 'competence_data',
        };
      }

      return { total_folha: 0, encargos: 0, prolabore: 0, num_funcionarios: 0, source: 'empty' };
    },
    enabled: !!unitId,
    staleTime: 1000 * 60 * 2, // 2 minutos
  });
}

/**
 * Hook para buscar dados de impostos agregados
 */
export function useAggregatedImpostosData(unitId: string | null, ano: number, mes: number) {
  return useQuery({
    queryKey: ['accounting-aggregated-impostos', unitId, ano, mes],
    queryFn: async (): Promise<AggregatedImpostosData> => {
      if (!unitId) {
        return { das: 0, darf: 0, gps: 0, inss: 0, fgts: 0, iss: 0, total: 0, source: 'empty' };
      }

      // 1. Buscar de accounting_lab_documents (processados via Smart Upload)
      const { data: labDocs } = await supabase
        .from('accounting_lab_documents')
        .select('tipo, valor')
        .eq('unit_id', unitId)
        .eq('ano', ano)
        .eq('mes', mes)
        .in('tipo', ['das', 'darf', 'gps', 'inss', 'fgts', 'iss']);

      if (labDocs && labDocs.length > 0) {
        const byType: Record<string, number> = {};
        labDocs.forEach(doc => {
          byType[doc.tipo] = (byType[doc.tipo] || 0) + (doc.valor || 0);
        });

        const total = Object.values(byType).reduce((sum, val) => sum + val, 0);

        return {
          das: byType['das'] || 0,
          darf: byType['darf'] || 0,
          gps: byType['gps'] || 0,
          inss: byType['inss'] || 0,
          fgts: byType['fgts'] || 0,
          iss: byType['iss'] || 0,
          total,
          source: 'payables',
        };
      }

      // 2. Fallback: buscar de accounting_competence_data
      const { data: competenceData } = await supabase
        .from('accounting_competence_data')
        .select('das_valor, darf_valor, gps_valor, inss_valor, fgts_valor, iss_valor')
        .eq('unit_id', unitId)
        .eq('ano', ano)
        .eq('mes', mes)
        .maybeSingle();

      if (competenceData && hasRealCompetenceData(competenceData)) {
        const total = (competenceData.das_valor || 0) + 
                      (competenceData.darf_valor || 0) + 
                      (competenceData.gps_valor || 0) + 
                      (competenceData.inss_valor || 0) + 
                      (competenceData.fgts_valor || 0) + 
                      (competenceData.iss_valor || 0);

        return {
          das: competenceData.das_valor || 0,
          darf: competenceData.darf_valor || 0,
          gps: competenceData.gps_valor || 0,
          inss: competenceData.inss_valor || 0,
          fgts: competenceData.fgts_valor || 0,
          iss: competenceData.iss_valor || 0,
          total,
          source: 'competence_data',
        };
      }

      return { das: 0, darf: 0, gps: 0, inss: 0, fgts: 0, iss: 0, total: 0, source: 'empty' };
    },
    enabled: !!unitId,
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Hook para buscar dados de receita agregados
 */
export function useAggregatedReceitaData(unitId: string | null, ano: number, mes: number) {
  return useQuery({
    queryKey: ['accounting-aggregated-receita', unitId, ano, mes],
    queryFn: async (): Promise<AggregatedReceitaData> => {
      if (!unitId) {
        return { servicos: 0, outras: 0, total: 0, source: 'empty' };
      }

      // 1. Buscar de invoices
      const { data: invoices } = await supabase
        .from('invoices')
        .select('service_value, net_value')
        .eq('unit_id', unitId)
        .eq('competence_year', ano)
        .eq('competence_month', mes);

      if (invoices && invoices.length > 0) {
        const servicos = invoices.reduce((sum, inv) => sum + (inv.service_value || inv.net_value || 0), 0);
        return {
          servicos,
          outras: 0,
          total: servicos,
          source: 'invoices',
        };
      }

      // 2. Fallback: buscar de accounting_competence_data
      const { data: competenceData } = await supabase
        .from('accounting_competence_data')
        .select('receita_servicos, receita_outras')
        .eq('unit_id', unitId)
        .eq('ano', ano)
        .eq('mes', mes)
        .maybeSingle();

      if (competenceData && hasRealCompetenceData(competenceData)) {
        const servicos = competenceData.receita_servicos || 0;
        const outras = competenceData.receita_outras || 0;
        return {
          servicos,
          outras,
          total: servicos + outras,
          source: 'competence_data',
        };
      }

      return { servicos: 0, outras: 0, total: 0, source: 'empty' };
    },
    enabled: !!unitId,
    staleTime: 1000 * 60 * 2,
  });
}
