import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Unit, TaxConfig, UnitType, RegimeTributario, IssTipoApuracao } from '@/types/database';

export interface UnitFiscalData {
  // Unit identity fields
  cnpj: string;
  inscricao_municipal: string;
  inscricao_estadual: string;
  municipio_codigo_ibge: string;
  municipio_nome: string;
  unit_type: UnitType;
  parent_unit_id: string | null;
  centraliza_tributos_federais: boolean;
  // Tax config fields
  regime_atual: RegimeTributario;
  iss_aliquota: number;
  iss_municipio_incidente: string;
  iss_tipo_apuracao: IssTipoApuracao;
  iss_valor_fixo_mensal: number | null;
  iss_responsavel_unit_id: string | null;
  vigencia_inicio: string;
  vigencia_fim: string | null;
  notas: string;
}

const DEFAULT_FISCAL_DATA: UnitFiscalData = {
  cnpj: '',
  inscricao_municipal: '',
  inscricao_estadual: '',
  municipio_codigo_ibge: '',
  municipio_nome: '',
  unit_type: 'FILIAL_COM_NF',
  parent_unit_id: null,
  centraliza_tributos_federais: false,
  regime_atual: 'SIMPLES_NACIONAL',
  iss_aliquota: 0.05,
  iss_municipio_incidente: '',
  iss_tipo_apuracao: 'SOBRE_FATURAMENTO',
  iss_valor_fixo_mensal: null,
  iss_responsavel_unit_id: null,
  vigencia_inicio: new Date().toISOString().split('T')[0],
  vigencia_fim: null,
  notas: '',
};

export function useTaxConfig(unitId?: string) {
  return useQuery({
    queryKey: ['tax-config-full', unitId],
    queryFn: async (): Promise<{ unit: Unit | null; taxConfig: TaxConfig | null; fiscalData: UnitFiscalData }> => {
      if (!unitId) {
        return { unit: null, taxConfig: null, fiscalData: DEFAULT_FISCAL_DATA };
      }

      // Fetch unit data with parent
      const { data: unit, error: unitError } = await supabase
        .from('units')
        .select('*')
        .eq('id', unitId)
        .maybeSingle();

      if (unitError) throw unitError;

      // Fetch tax config
      const { data: taxConfig, error: taxError } = await supabase
        .from('tax_config')
        .select('*')
        .eq('unit_id', unitId)
        .maybeSingle();

      if (taxError) throw taxError;

      // Combine into fiscal data
      const fiscalData: UnitFiscalData = {
        cnpj: unit?.cnpj || '',
        inscricao_municipal: unit?.inscricao_municipal || '',
        inscricao_estadual: unit?.inscricao_estadual || '',
        municipio_codigo_ibge: unit?.municipio_codigo_ibge || '',
        municipio_nome: unit?.municipio_nome || '',
        unit_type: (unit?.unit_type as UnitType) || 'FILIAL_COM_NF',
        parent_unit_id: unit?.parent_unit_id || null,
        centraliza_tributos_federais: unit?.centraliza_tributos_federais || false,
        regime_atual: (taxConfig?.regime_atual as RegimeTributario) || 'SIMPLES_NACIONAL',
        iss_aliquota: Number(taxConfig?.iss_aliquota) || 0.05,
        iss_municipio_incidente: taxConfig?.iss_municipio_incidente || '',
        iss_tipo_apuracao: (taxConfig?.iss_tipo_apuracao as IssTipoApuracao) || 'SOBRE_FATURAMENTO',
        iss_valor_fixo_mensal: taxConfig?.iss_valor_fixo_mensal ? Number(taxConfig.iss_valor_fixo_mensal) : null,
        iss_responsavel_unit_id: taxConfig?.iss_responsavel_unit_id || null,
        vigencia_inicio: taxConfig?.vigencia_inicio || new Date().toISOString().split('T')[0],
        vigencia_fim: taxConfig?.vigencia_fim || null,
        notas: taxConfig?.notas || '',
      };

      return { unit, taxConfig, fiscalData };
    },
    enabled: !!unitId,
  });
}

export function useSaveTaxConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ unitId, data, existingTaxConfigId }: { 
      unitId: string; 
      data: UnitFiscalData; 
      existingTaxConfigId?: string;
    }) => {
      // 1. Update unit with fiscal identity fields
      const { error: unitError } = await supabase
        .from('units')
        .update({
          cnpj: data.cnpj || null,
          inscricao_municipal: data.inscricao_municipal || null,
          inscricao_estadual: data.inscricao_estadual || null,
          municipio_codigo_ibge: data.municipio_codigo_ibge || null,
          municipio_nome: data.municipio_nome || null,
          unit_type: data.unit_type,
          parent_unit_id: data.parent_unit_id || null,
          centraliza_tributos_federais: data.centraliza_tributos_federais,
        })
        .eq('id', unitId);

      if (unitError) throw unitError;

      // 2. Upsert tax_config
      const taxConfigData = {
        unit_id: unitId,
        regime_atual: data.regime_atual,
        iss_aliquota: data.iss_aliquota,
        iss_municipio_incidente: data.iss_municipio_incidente || null,
        iss_tipo_apuracao: data.iss_tipo_apuracao,
        iss_valor_fixo_mensal: data.iss_valor_fixo_mensal,
        iss_responsavel_unit_id: data.iss_responsavel_unit_id || null,
        vigencia_inicio: data.vigencia_inicio,
        vigencia_fim: data.vigencia_fim,
        notas: data.notas || null,
      };

      if (existingTaxConfigId) {
        const { error } = await supabase
          .from('tax_config')
          .update(taxConfigData)
          .eq('id', existingTaxConfigId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('tax_config')
          .insert(taxConfigData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Configuração tributária salva com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['tax-config-full'] });
      queryClient.invalidateQueries({ queryKey: ['tax-config'] });
      queryClient.invalidateQueries({ queryKey: ['units'] });
    },
    onError: (error: Error) => {
      toast.error('Erro ao salvar: ' + error.message);
    },
  });
}

export function useUnits() {
  return useQuery({
    queryKey: ['units-with-hierarchy'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('units')
        .select('*')
        .order('name');
      if (error) throw error;
      return data;
    },
  });
}
