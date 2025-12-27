import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AccountingDashboardData {
  impostos: {
    das: number;
    iss_proprio: number;
    iss_retido: number;
    irrf_retido: number;
    outros: number;
    total: number;
  };
  receita: {
    servicos: number;
    outras: number;
    total: number;
  };
  folha: {
    salarios: number;
    prolabore: number;
    inss_patronal: number;
    fgts: number;
    decimo_terceiro: number;
    ferias: number;
    total: number;
  };
  fatorR: {
    percentual: number;
    anexo: 'III' | 'V';
    status: 'ok' | 'alerta' | 'critico';
  };
  documentos: AccountingDocument[];
  linkStatus: {
    enviado: boolean;
    enviadoEm: string | null;
    usado: boolean;
    expirado: boolean;
  };
}

export interface AccountingDocument {
  id: string;
  tipo_documento: string;
  file_name: string;
  valor_documento: number | null;
  status: string;
  created_at: string;
  ocr_status: string;
}

export function useAccountingDashboard(ano: number, mes: number) {
  return useQuery({
    queryKey: ['accounting-dashboard', ano, mes],
    queryFn: async (): Promise<AccountingDashboardData> => {
      // Buscar dados de impostos
      const { data: taxData } = await supabase
        .from('seed_taxes')
        .select('*')
        .eq('ano', ano)
        .eq('mes', mes)
        .maybeSingle();

      // Buscar dados de receita
      const { data: revenueData } = await supabase
        .from('seed_revenue')
        .select('*')
        .eq('ano', ano)
        .eq('mes', mes)
        .maybeSingle();

      // Buscar dados de folha
      const { data: payrollData } = await supabase
        .from('seed_payroll')
        .select('*')
        .eq('ano', ano)
        .eq('mes', mes)
        .maybeSingle();

      // Buscar documentos da competência
      const { data: documents } = await supabase
        .from('accounting_documents')
        .select('id, tipo_documento, file_name, valor_documento, status, created_at, ocr_status')
        .eq('ano', ano)
        .eq('mes', mes)
        .order('created_at', { ascending: false });

      // Buscar token mais recente da competência
      const { data: tokenData } = await supabase
        .from('accounting_tokens')
        .select('*')
        .eq('ano', ano)
        .eq('mes', mes)
        .eq('tipo', 'mensal')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Calcular valores
      const impostos = {
        das: taxData?.das || 0,
        iss_proprio: taxData?.iss_proprio || 0,
        iss_retido: taxData?.iss_retido || 0,
        irrf_retido: taxData?.irrf_retido || 0,
        outros: taxData?.outros || 0,
        total: (taxData?.das || 0) + (taxData?.iss_proprio || 0) + (taxData?.iss_retido || 0) + (taxData?.irrf_retido || 0) + (taxData?.outros || 0),
      };

      const receita = {
        servicos: revenueData?.receita_servicos || 0,
        outras: revenueData?.receita_outras || 0,
        total: (revenueData?.receita_servicos || 0) + (revenueData?.receita_outras || 0),
      };

      const folha = {
        salarios: payrollData?.salarios || 0,
        prolabore: payrollData?.prolabore || 0,
        inss_patronal: payrollData?.inss_patronal || 0,
        fgts: payrollData?.fgts || 0,
        decimo_terceiro: payrollData?.decimo_terceiro || 0,
        ferias: payrollData?.ferias || 0,
        total: (payrollData?.salarios || 0) + (payrollData?.prolabore || 0) + (payrollData?.inss_patronal || 0) + (payrollData?.fgts || 0) + (payrollData?.decimo_terceiro || 0) + (payrollData?.ferias || 0),
      };

      // Calcular Fator R
      const fatorRPercentual = receita.total > 0 ? (folha.total / receita.total) * 100 : 0;
      const fatorR = {
        percentual: fatorRPercentual,
        anexo: fatorRPercentual >= 28 ? 'III' as const : 'V' as const,
        status: fatorRPercentual >= 28 ? 'ok' as const : fatorRPercentual >= 25 ? 'alerta' as const : 'critico' as const,
      };

      // Status do link
      const linkStatus = {
        enviado: !!tokenData,
        enviadoEm: tokenData?.created_at || null,
        usado: !!tokenData?.used_at,
        expirado: tokenData ? new Date(tokenData.expires_at) < new Date() : false,
      };

      return {
        impostos,
        receita,
        folha,
        fatorR,
        documentos: (documents || []) as AccountingDocument[],
        linkStatus,
      };
    },
    staleTime: 1000 * 60 * 5, // 5 minutos
  });
}

export function useAccountingDocuments(ano: number, mes: number) {
  return useQuery({
    queryKey: ['accounting-documents', ano, mes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounting_documents')
        .select('*')
        .eq('ano', ano)
        .eq('mes', mes)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });
}
