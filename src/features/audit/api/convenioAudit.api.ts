import { supabase } from '@/integrations/supabase/client';

export interface ConvenioAuditSummary {
  provider_name: string;
  total_producao: number;
  total_nf_emitida: number;
  diferenca: number;
  count_producao: number;
  count_nf: number;
}

export interface ConvenioAuditResult {
  summary: ConvenioAuditSummary;
  production_items: {
    exam_date: string;
    lis_code: string;
    patient_name: string | null;
    amount: number;
  }[];
  invoices: {
    id: string;
    document_number: string;
    issue_date: string;
    customer_name: string;
    net_value: number;
  }[];
}

/**
 * Realiza auditoria de convênio vs notas fiscais
 */
export async function auditConvenioVsInvoice(
  unitId: string | null,
  providerName: string,
  startDate: string,
  endDate: string
): Promise<ConvenioAuditResult> {
  // 1. Busca registros de produção do convênio
  let productionQuery = supabase
    .from('convenio_production_reports')
    .select('exam_date, lis_code, patient_name, amount')
    .eq('is_particular', false)
    .eq('provider_name', providerName)
    .gte('exam_date', startDate)
    .lte('exam_date', endDate)
    .order('exam_date', { ascending: true });

  if (unitId) {
    productionQuery = productionQuery.eq('unit_id', unitId);
  }

  const { data: productionData, error: productionError } = await productionQuery;
  if (productionError) throw productionError;

  // 2. Busca notas fiscais do mesmo período/cliente
  // Tenta match por customer_name que contenha o nome do convênio
  let invoicesQuery = supabase
    .from('invoices')
    .select('id, document_number, issue_date, customer_name, net_value')
    .gte('issue_date', startDate)
    .lte('issue_date', endDate)
    .ilike('customer_name', `%${providerName.split(' ').slice(0, 2).join('%')}%`)
    .order('issue_date', { ascending: true });

  if (unitId) {
    invoicesQuery = invoicesQuery.eq('unit_id', unitId);
  }

  const { data: invoicesData, error: invoicesError } = await invoicesQuery;
  if (invoicesError) throw invoicesError;

  // Calcula totais
  const totalProducao = (productionData || []).reduce((sum, p) => sum + p.amount, 0);
  const totalNfEmitida = (invoicesData || []).reduce((sum, i) => sum + i.net_value, 0);

  return {
    summary: {
      provider_name: providerName,
      total_producao: totalProducao,
      total_nf_emitida: totalNfEmitida,
      diferenca: totalProducao - totalNfEmitida,
      count_producao: productionData?.length || 0,
      count_nf: invoicesData?.length || 0,
    },
    production_items: productionData || [],
    invoices: invoicesData || [],
  };
}

/**
 * Busca resumo de todos os convênios no período
 */
export async function fetchConvenioAuditOverview(
  unitId: string | null,
  startDate: string,
  endDate: string
): Promise<ConvenioAuditSummary[]> {
  // Busca produção agrupada por convênio
  let productionQuery = supabase
    .from('convenio_production_reports')
    .select('provider_name, amount')
    .eq('is_particular', false)
    .gte('exam_date', startDate)
    .lte('exam_date', endDate);

  if (unitId) {
    productionQuery = productionQuery.eq('unit_id', unitId);
  }

  const { data: productionData, error: productionError } = await productionQuery;
  if (productionError) throw productionError;

  // Agrupa produção por convênio
  const productionByProvider = new Map<string, { total: number; count: number }>();
  for (const item of productionData || []) {
    const current = productionByProvider.get(item.provider_name) || { total: 0, count: 0 };
    current.total += item.amount;
    current.count += 1;
    productionByProvider.set(item.provider_name, current);
  }

  // Busca todas as NFs no período
  let invoicesQuery = supabase
    .from('invoices')
    .select('customer_name, net_value')
    .gte('issue_date', startDate)
    .lte('issue_date', endDate);

  if (unitId) {
    invoicesQuery = invoicesQuery.eq('unit_id', unitId);
  }

  const { data: invoicesData, error: invoicesError } = await invoicesQuery;
  if (invoicesError) throw invoicesError;

  // Agrupa NFs por nome (aproximado)
  const invoicesByCustomer = new Map<string, { total: number; count: number }>();
  for (const item of invoicesData || []) {
    const current = invoicesByCustomer.get(item.customer_name) || { total: 0, count: 0 };
    current.total += item.net_value;
    current.count += 1;
    invoicesByCustomer.set(item.customer_name, current);
  }

  // Monta resultado
  const results: ConvenioAuditSummary[] = [];
  
  for (const [providerName, production] of productionByProvider) {
    // Tenta encontrar NFs correspondentes
    let matchedInvoice = invoicesByCustomer.get(providerName);
    
    // Se não encontrou exato, tenta match parcial
    if (!matchedInvoice) {
      const searchTerms = providerName.toLowerCase().split(' ').slice(0, 2);
      for (const [customerName, invoice] of invoicesByCustomer) {
        const customerLower = customerName.toLowerCase();
        if (searchTerms.every(term => customerLower.includes(term))) {
          matchedInvoice = invoice;
          break;
        }
      }
    }

    results.push({
      provider_name: providerName,
      total_producao: production.total,
      total_nf_emitida: matchedInvoice?.total || 0,
      diferenca: production.total - (matchedInvoice?.total || 0),
      count_producao: production.count,
      count_nf: matchedInvoice?.count || 0,
    });
  }

  // Ordena por diferença (maiores diferenças primeiro)
  return results.sort((a, b) => Math.abs(b.diferenca) - Math.abs(a.diferenca));
}
