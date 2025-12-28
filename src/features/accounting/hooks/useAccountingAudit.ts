import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type AuditCategory = 'folha' | 'das' | 'darf' | 'gps' | 'inss' | 'fgts' | 'iss' | 'receitas' | 'geral';
export type AuditStatus = 'revisado' | 'pendencia' | 'pendente';
export type CompetenceStatus = 'completo' | 'pendente' | 'inconsistente';

export interface AuditLog {
  id: string;
  unit_id: string | null;
  ano: number;
  mes: number;
  categoria: AuditCategory;
  status: AuditStatus;
  comentario: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaxComparison {
  imposto: string;
  campo: string;
  valorInformado: number;
  valorOcr: number | null;
  diferenca: number;
  percentualDiferenca: number;
  vencimentoInformado: string | null;
  vencimentoOcr: string | null;
  documentoStatus: 'sem_guia' | 'ocr_pendente' | 'ocr_processado' | 'divergencia';
  status: 'ok' | 'warning' | 'error';
}

export interface ChecklistItem {
  key: string;
  label: string;
  completed: boolean;
  icon: '✔' | '⚠' | '✖';
}

export interface AccountingAuditData {
  // Dados da competência
  competenceData: {
    total_folha: number;
    encargos: number;
    prolabore: number;
    num_funcionarios: number;
    receita_servicos: number;
    receita_outras: number;
    das_valor: number;
    das_vencimento: string | null;
    darf_valor: number;
    darf_vencimento: string | null;
    gps_valor: number;
    gps_vencimento: string | null;
    inss_valor: number;
    inss_vencimento: string | null;
    fgts_valor: number;
    fgts_vencimento: string | null;
    iss_valor: number;
    iss_vencimento: string | null;
  } | null;
  
  // Documentos anexados com OCR
  documents: Array<{
    id: string;
    categoria: string;
    file_name: string;
    ocr_status: string | null;
    ocr_data: Record<string, unknown> | null;
  }>;
  
  // NFs da competência
  invoices: Array<{
    id: string;
    net_value: number;
    issue_date: string;
  }>;
  
  // Entradas bancárias do mês
  bankEntries: number;
  
  // Logs de auditoria
  auditLogs: AuditLog[];
  
  // Cálculos derivados
  status: CompetenceStatus;
  checklist: ChecklistItem[];
  fatorR: {
    mensal: number;
    acumulado12m: number;
    anexo: 'III' | 'V';
    margem: number;
    status: 'ok' | 'alerta' | 'critico';
  };
  taxComparisons: TaxComparison[];
  revenueComparison: {
    declarada: number;
    nfs: number;
    banco: number;
    diferencaNfs: number;
    diferencaBanco: number;
  };
}

const TOLERANCE_PERCENT = 0.01; // 1%
const TOLERANCE_FIXED = 50; // R$ 50

function checkValueDivergence(informado: number, ocr: number | null): { status: 'ok' | 'warning' | 'error'; icon: '✔' | '⚠' | '✖' } {
  if (ocr === null) return { status: 'warning', icon: '⚠' };
  
  const diff = Math.abs(informado - ocr);
  const percentDiff = informado > 0 ? diff / informado : 0;
  
  if (diff <= TOLERANCE_FIXED || percentDiff <= TOLERANCE_PERCENT) {
    return { status: 'ok', icon: '✔' };
  }
  if (percentDiff <= 0.05) {
    return { status: 'warning', icon: '⚠' };
  }
  return { status: 'error', icon: '✖' };
}

export function useAccountingAudit(unitId: string | null, ano: number, mes: number) {
  return useQuery({
    queryKey: ['accounting-audit', unitId, ano, mes],
    queryFn: async (): Promise<AccountingAuditData> => {
      // 1. Buscar dados de competência
      let competenceQuery = supabase
        .from('accounting_competence_data')
        .select('*')
        .eq('ano', ano)
        .eq('mes', mes);
      
      if (unitId) {
        competenceQuery = competenceQuery.eq('unit_id', unitId);
      }
      
      const { data: competenceData } = await competenceQuery.maybeSingle();

      // 2. Buscar documentos de competência
      let docsQuery = supabase
        .from('accounting_competence_documents')
        .select('id, categoria, file_name, ocr_status, ocr_data')
        .eq('ano', ano)
        .eq('mes', mes);
      
      if (unitId) {
        docsQuery = docsQuery.eq('unit_id', unitId);
      }
      
      const { data: documents } = await docsQuery;

      // 3. Buscar NFs da competência
      let invoicesQuery = supabase
        .from('invoices')
        .select('id, net_value, issue_date')
        .eq('competence_year', ano)
        .eq('competence_month', mes);
      
      if (unitId) {
        invoicesQuery = invoicesQuery.eq('unit_id', unitId);
      }
      
      const { data: invoices } = await invoicesQuery;

      // 4. Buscar entradas bancárias do mês
      const startDate = `${ano}-${String(mes).padStart(2, '0')}-01`;
      const endDate = new Date(ano, mes, 0).toISOString().split('T')[0];
      
      let transactionsQuery = supabase
        .from('transactions')
        .select('amount')
        .eq('type', 'ENTRADA')
        .eq('status', 'APROVADO')
        .gte('date', startDate)
        .lte('date', endDate);
      
      if (unitId) {
        transactionsQuery = transactionsQuery.eq('unit_id', unitId);
      }
      
      const { data: transactions } = await transactionsQuery;
      const bankEntries = (transactions || []).reduce((sum, t) => sum + (t.amount || 0), 0);

      // 5. Buscar logs de auditoria
      let logsQuery = supabase
        .from('accounting_audit_logs')
        .select('*')
        .eq('ano', ano)
        .eq('mes', mes)
        .order('created_at', { ascending: false });
      
      if (unitId) {
        logsQuery = logsQuery.eq('unit_id', unitId);
      }
      
      const { data: auditLogs } = await logsQuery;

      // 6. Calcular checklist
      const checklist: ChecklistItem[] = [
        {
          key: 'folha',
          label: 'Folha informada',
          completed: (competenceData?.total_folha || 0) > 0,
          icon: (competenceData?.total_folha || 0) > 0 ? '✔' : '✖',
        },
        {
          key: 'impostos',
          label: 'Impostos informados',
          completed: ((competenceData?.das_valor || 0) + (competenceData?.darf_valor || 0)) > 0,
          icon: ((competenceData?.das_valor || 0) + (competenceData?.darf_valor || 0)) > 0 ? '✔' : '✖',
        },
        {
          key: 'receitas',
          label: 'Receitas informadas',
          completed: (competenceData?.receita_servicos || 0) > 0,
          icon: (competenceData?.receita_servicos || 0) > 0 ? '✔' : '✖',
        },
        {
          key: 'documentos',
          label: `Documentos anexados (${(documents || []).length})`,
          completed: (documents || []).length >= 3,
          icon: (documents || []).length >= 3 ? '✔' : (documents || []).length > 0 ? '⚠' : '✖',
        },
        {
          key: 'ocr',
          label: 'OCR processado nas guias',
          completed: (documents || []).filter(d => d.ocr_status === 'processado').length > 0,
          icon: (documents || []).filter(d => d.ocr_status === 'processado').length > 0 ? '✔' : '⚠',
        },
      ];

      // 7. Comparações de impostos com OCR
      const taxFields = [
        { imposto: 'DAS', campo: 'das_valor', vencimento: 'das_vencimento', categoria: 'das' },
        { imposto: 'DARF', campo: 'darf_valor', vencimento: 'darf_vencimento', categoria: 'darf' },
        { imposto: 'GPS', campo: 'gps_valor', vencimento: 'gps_vencimento', categoria: 'gps' },
        { imposto: 'INSS', campo: 'inss_valor', vencimento: 'inss_vencimento', categoria: 'inss' },
        { imposto: 'FGTS', campo: 'fgts_valor', vencimento: 'fgts_vencimento', categoria: 'fgts' },
        { imposto: 'ISS', campo: 'iss_valor', vencimento: 'iss_vencimento', categoria: 'iss' },
      ];

      const taxComparisons: TaxComparison[] = taxFields.map(({ imposto, campo, vencimento, categoria }) => {
        const valorInformado = competenceData?.[campo as keyof typeof competenceData] as number || 0;
        const vencimentoInformado = competenceData?.[vencimento as keyof typeof competenceData] as string | null;
        
        // Procurar documento correspondente
        const doc = (documents || []).find(d => d.categoria.toLowerCase() === categoria);
        
        let valorOcr: number | null = null;
        let vencimentoOcr: string | null = null;
        let documentoStatus: TaxComparison['documentoStatus'] = 'sem_guia';
        
        if (doc) {
          if (doc.ocr_status === 'processado' && doc.ocr_data) {
            const ocrData = doc.ocr_data as Record<string, unknown>;
            valorOcr = (ocrData.valor as number) || null;
            vencimentoOcr = (ocrData.vencimento as string) || null;
            documentoStatus = 'ocr_processado';
          } else if (doc.ocr_status === 'pendente') {
            documentoStatus = 'ocr_pendente';
          } else {
            documentoStatus = 'ocr_pendente';
          }
        }
        
        const divergence = checkValueDivergence(valorInformado, valorOcr);
        if (valorOcr !== null && divergence.status === 'error') {
          documentoStatus = 'divergencia';
        }
        
        const diferenca = valorOcr !== null ? valorInformado - valorOcr : 0;
        const percentualDiferenca = valorInformado > 0 && valorOcr !== null 
          ? ((valorInformado - valorOcr) / valorInformado) * 100 
          : 0;

        return {
          imposto,
          campo,
          valorInformado,
          valorOcr,
          diferenca,
          percentualDiferenca,
          vencimentoInformado,
          vencimentoOcr,
          documentoStatus,
          status: divergence.status,
        };
      });

      // 8. Fator R
      const totalFolha = competenceData?.total_folha || 0;
      const totalReceita = (competenceData?.receita_servicos || 0) + (competenceData?.receita_outras || 0);
      const fatorRMensal = totalReceita > 0 ? (totalFolha / totalReceita) * 100 : 0;
      
      // Buscar 12 meses anteriores para Fator R acumulado
      const startYear = mes === 1 ? ano - 1 : ano;
      const startMonth = mes === 1 ? 1 : mes;
      
      let historicalQuery = supabase
        .from('accounting_competence_data')
        .select('total_folha, receita_servicos, receita_outras')
        .or(`and(ano.eq.${ano},mes.lte.${mes}),and(ano.eq.${ano - 1},mes.gt.${mes})`);
      
      if (unitId) {
        historicalQuery = historicalQuery.eq('unit_id', unitId);
      }
      
      const { data: historicalData } = await historicalQuery;
      
      const totalFolha12m = (historicalData || []).reduce((sum, d) => sum + (d.total_folha || 0), 0);
      const totalReceita12m = (historicalData || []).reduce((sum, d) => 
        sum + (d.receita_servicos || 0) + (d.receita_outras || 0), 0
      );
      const fatorRAcumulado = totalReceita12m > 0 ? (totalFolha12m / totalReceita12m) * 100 : 0;
      
      const fatorR = {
        mensal: fatorRMensal,
        acumulado12m: fatorRAcumulado,
        anexo: fatorRAcumulado >= 28 ? 'III' as const : 'V' as const,
        margem: fatorRAcumulado - 28,
        status: fatorRAcumulado >= 28 ? 'ok' as const : fatorRAcumulado >= 25 ? 'alerta' as const : 'critico' as const,
      };

      // 9. Comparação de receitas
      const receitaDeclarada = totalReceita;
      const receitaNfs = (invoices || []).reduce((sum, inv) => sum + (inv.net_value || 0), 0);
      
      const revenueComparison = {
        declarada: receitaDeclarada,
        nfs: receitaNfs,
        banco: bankEntries,
        diferencaNfs: receitaDeclarada > 0 ? ((receitaNfs - receitaDeclarada) / receitaDeclarada) * 100 : 0,
        diferencaBanco: receitaDeclarada > 0 ? ((bankEntries - receitaDeclarada) / receitaDeclarada) * 100 : 0,
      };

      // 10. Calcular status geral
      const hasDivergencias = taxComparisons.some(t => t.status === 'error');
      const allCompleted = checklist.every(c => c.completed);
      
      let status: CompetenceStatus = 'pendente';
      if (hasDivergencias) {
        status = 'inconsistente';
      } else if (allCompleted) {
        status = 'completo';
      }

      return {
        competenceData: competenceData ? {
          total_folha: competenceData.total_folha || 0,
          encargos: competenceData.encargos || 0,
          prolabore: competenceData.prolabore || 0,
          num_funcionarios: competenceData.num_funcionarios || 0,
          receita_servicos: competenceData.receita_servicos || 0,
          receita_outras: competenceData.receita_outras || 0,
          das_valor: competenceData.das_valor || 0,
          das_vencimento: competenceData.das_vencimento,
          darf_valor: competenceData.darf_valor || 0,
          darf_vencimento: competenceData.darf_vencimento,
          gps_valor: competenceData.gps_valor || 0,
          gps_vencimento: competenceData.gps_vencimento,
          inss_valor: competenceData.inss_valor || 0,
          inss_vencimento: competenceData.inss_vencimento,
          fgts_valor: competenceData.fgts_valor || 0,
          fgts_vencimento: competenceData.fgts_vencimento,
          iss_valor: competenceData.iss_valor || 0,
          iss_vencimento: competenceData.iss_vencimento,
        } : null,
        documents: (documents || []).map(d => ({
          id: d.id,
          categoria: d.categoria,
          file_name: d.file_name,
          ocr_status: d.ocr_status,
          ocr_data: d.ocr_data as Record<string, unknown> | null,
        })),
        invoices: (invoices || []).map(inv => ({
          id: inv.id,
          net_value: inv.net_value,
          issue_date: inv.issue_date,
        })),
        bankEntries,
        auditLogs: (auditLogs || []) as AuditLog[],
        status,
        checklist,
        fatorR,
        taxComparisons,
        revenueComparison,
      };
    },
    enabled: ano > 0 && mes > 0,
    staleTime: 1000 * 60 * 2,
  });
}

export function useAuditLogMutation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: {
      unitId: string | null;
      ano: number;
      mes: number;
      categoria: AuditCategory;
      status: AuditStatus;
      comentario?: string;
    }) => {
      const { unitId, ano, mes, categoria, status, comentario } = params;

      // Check if log exists
      let existingQuery = supabase
        .from('accounting_audit_logs')
        .select('id')
        .eq('ano', ano)
        .eq('mes', mes)
        .eq('categoria', categoria);
      
      if (unitId) {
        existingQuery = existingQuery.eq('unit_id', unitId);
      }

      const { data: existing } = await existingQuery.maybeSingle();

      if (existing) {
        // Update
        const { error } = await supabase
          .from('accounting_audit_logs')
          .update({ status, comentario, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        
        if (error) throw error;
      } else {
        // Insert
        const { error } = await supabase
          .from('accounting_audit_logs')
          .insert({
            unit_id: unitId,
            ano,
            mes,
            categoria,
            status,
            comentario,
            created_by: user?.id,
          });
        
        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ['accounting-audit', variables.unitId, variables.ano, variables.mes] 
      });
    },
  });
}
