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
      // Definir período da competência
      const startDate = `${ano}-${String(mes).padStart(2, '0')}-01`;
      const endDate = new Date(ano, mes, 0).toISOString().split('T')[0]; // Último dia do mês

      // Buscar payables pagos da competência com categoria
      const { data: payablesData } = await supabase
        .from('payables')
        .select(`
          id, valor, paid_amount, status, beneficiario,
          category:categories(id, name, tax_group, entra_fator_r)
        `)
        .gte('vencimento', startDate)
        .lte('vencimento', endDate)
        .in('status', ['pago', 'PAGO']);

      // Buscar invoices (receitas) da competência
      const { data: invoicesData } = await supabase
        .from('invoices')
        .select('id, service_value, net_value')
        .eq('competence_year', ano)
        .eq('competence_month', mes);

      // Buscar dados de impostos legados (fallback)
      const { data: taxData } = await supabase
        .from('seed_taxes')
        .select('*')
        .eq('ano', ano)
        .eq('mes', mes)
        .maybeSingle();

      // Buscar dados de receita legados (fallback)
      const { data: revenueData } = await supabase
        .from('seed_revenue')
        .select('*')
        .eq('ano', ano)
        .eq('mes', mes)
        .maybeSingle();

      // Buscar dados de folha legados (fallback)
      const { data: payrollData } = await supabase
        .from('seed_payroll')
        .select('*')
        .eq('ano', ano)
        .eq('mes', mes)
        .maybeSingle();

      // Buscar documentos de folha do lab (Processamento Inteligente)
      const { data: labPayrollDocs } = await supabase
        .from('accounting_lab_documents')
        .select('valor')
        .eq('ano', ano)
        .eq('mes', mes)
        .eq('tipo', 'folha_pagamento');
      
      const labPayrollTotal = (labPayrollDocs || []).reduce((sum, doc) => sum + (doc.valor || 0), 0);

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

      // Calcular folha de payables
      let payablesFolha = 0;
      let payablesImpostos = 0;
      
      if (payablesData) {
        payablesData.forEach((p: any) => {
          const amount = Math.abs(Number(p.paid_amount || p.valor || 0));
          const taxGroup = p.category?.tax_group;
          const entraFatorR = p.category?.entra_fator_r ?? false;
          
          if (taxGroup === 'PESSOAL' && entraFatorR) {
            payablesFolha += amount;
          } else if (taxGroup === 'IMPOSTOS' || taxGroup === 'TRIBUTARIAS') {
            payablesImpostos += amount;
          }
        });
      }

      // Calcular receita de invoices
      let invoicesReceita = 0;
      if (invoicesData) {
        invoicesData.forEach((inv: any) => {
          invoicesReceita += Number(inv.service_value || inv.net_value || 0);
        });
      }

      // Usar dados de payables/invoices se disponíveis, senão fallback para seed_*
      const usarPayables = payablesData && payablesData.length > 0;
      const usarInvoices = invoicesData && invoicesData.length > 0;

      // Calcular valores - priorizando dados reais
      const impostos = {
        das: usarPayables ? 0 : (taxData?.das || 0), // TODO: identificar DAS de payables
        iss_proprio: usarPayables ? 0 : (taxData?.iss_proprio || 0),
        iss_retido: usarPayables ? 0 : (taxData?.iss_retido || 0),
        irrf_retido: usarPayables ? 0 : (taxData?.irrf_retido || 0),
        outros: usarPayables ? payablesImpostos : (taxData?.outros || 0),
        total: usarPayables ? payablesImpostos : ((taxData?.das || 0) + (taxData?.iss_proprio || 0) + (taxData?.iss_retido || 0) + (taxData?.irrf_retido || 0) + (taxData?.outros || 0)),
      };

      // Receita: priorizar invoices reais
      const receita = {
        servicos: usarInvoices ? invoicesReceita : (revenueData?.receita_servicos || 0),
        outras: usarInvoices ? 0 : (revenueData?.receita_outras || 0),
        total: usarInvoices ? invoicesReceita : ((revenueData?.receita_servicos || 0) + (revenueData?.receita_outras || 0)),
      };

      // Folha: priorizar payables reais, depois lab documents, depois seed
      const seedFolhaTotal = (payrollData?.salarios || 0) + (payrollData?.prolabore || 0) + (payrollData?.inss_patronal || 0) + (payrollData?.fgts || 0) + (payrollData?.decimo_terceiro || 0) + (payrollData?.ferias || 0);
      
      // Determinar fonte de dados para folha
      const usarLabPayroll = !usarPayables && labPayrollTotal > 0;
      
      const folha = {
        salarios: usarPayables ? payablesFolha : usarLabPayroll ? labPayrollTotal : (payrollData?.salarios || 0),
        prolabore: usarPayables ? 0 : usarLabPayroll ? 0 : (payrollData?.prolabore || 0),
        inss_patronal: usarPayables ? 0 : usarLabPayroll ? 0 : (payrollData?.inss_patronal || 0),
        fgts: usarPayables ? 0 : usarLabPayroll ? 0 : (payrollData?.fgts || 0),
        decimo_terceiro: usarPayables ? 0 : usarLabPayroll ? 0 : (payrollData?.decimo_terceiro || 0),
        ferias: usarPayables ? 0 : usarLabPayroll ? 0 : (payrollData?.ferias || 0),
        total: usarPayables ? payablesFolha : usarLabPayroll ? labPayrollTotal : seedFolhaTotal,
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
