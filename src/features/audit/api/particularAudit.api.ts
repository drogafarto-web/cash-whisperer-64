import { supabase } from '@/integrations/supabase/client';

export interface ParticularAuditItem {
  // Dados do relatório de produção
  id: string;
  exam_date: string;
  lis_code: string;
  patient_name: string | null;
  amount: number;
  
  // Resultado do matching
  status: 'OK' | 'PENDENTE' | 'NAO_ENCONTRADO';
  reason: string;
  
  // Dados do item no caixa (se encontrado)
  lis_item_id?: string;
  lis_payment_status?: string;
  lis_payment_method?: string;
  lis_amount?: number;
}

export interface ParticularAuditSummary {
  total_producao: number;
  total_resolvido: number;
  total_pendente: number;
  diferenca: number;
  count_total: number;
  count_ok: number;
  count_pendente: number;
  count_nao_encontrado: number;
}

export interface ParticularAuditResult {
  summary: ParticularAuditSummary;
  items: ParticularAuditItem[];
}

/**
 * Realiza auditoria de particulares vs caixa
 */
export async function auditParticularVsCash(
  unitId: string | null,
  startDate: string,
  endDate: string
): Promise<ParticularAuditResult> {
  // 1. Busca registros de produção de particulares
  let productionQuery = supabase
    .from('convenio_production_reports')
    .select('id, exam_date, lis_code, patient_name, amount')
    .eq('is_particular', true)
    .gte('exam_date', startDate)
    .lte('exam_date', endDate);

  if (unitId) {
    productionQuery = productionQuery.eq('unit_id', unitId);
  }

  const { data: productionData, error: productionError } = await productionQuery;
  if (productionError) throw productionError;

  if (!productionData || productionData.length === 0) {
    return {
      summary: {
        total_producao: 0,
        total_resolvido: 0,
        total_pendente: 0,
        diferenca: 0,
        count_total: 0,
        count_ok: 0,
        count_pendente: 0,
        count_nao_encontrado: 0,
      },
      items: [],
    };
  }

  // 2. Busca itens do caixa (lis_closure_items) no mesmo período
  let lisQuery = supabase
    .from('lis_closure_items')
    .select('id, lis_code, date, amount, payment_status, payment_method')
    .gte('date', startDate)
    .lte('date', endDate)
    .in('payment_method', ['DINHEIRO', 'PIX', 'CARTAO']);

  if (unitId) {
    lisQuery = lisQuery.eq('unit_id', unitId);
  }

  const { data: lisData, error: lisError } = await lisQuery;
  if (lisError) throw lisError;

  // 3. Cria mapa de itens do caixa por lis_code
  const lisItemsMap = new Map<string, typeof lisData[0]>();
  for (const item of lisData || []) {
    // Usa chave composta: lis_code + date para matching mais preciso
    const key = `${item.lis_code}_${item.date}`;
    lisItemsMap.set(key, item);
    // Também armazena só por lis_code como fallback
    if (!lisItemsMap.has(item.lis_code)) {
      lisItemsMap.set(item.lis_code, item);
    }
  }

  // 4. Realiza matching
  const items: ParticularAuditItem[] = [];
  let totalResolvido = 0;
  let totalPendente = 0;
  let countOk = 0;
  let countPendente = 0;
  let countNaoEncontrado = 0;

  for (const prod of productionData) {
    // Tenta encontrar por lis_code + date primeiro
    const exactKey = `${prod.lis_code}_${prod.exam_date}`;
    let lisItem = lisItemsMap.get(exactKey);
    
    // Se não encontrou, tenta só pelo lis_code
    if (!lisItem) {
      lisItem = lisItemsMap.get(prod.lis_code);
    }

    let status: ParticularAuditItem['status'];
    let reason: string;

    if (!lisItem) {
      status = 'NAO_ENCONTRADO';
      reason = 'Não encontrado no caixa';
      totalPendente += prod.amount;
      countNaoEncontrado++;
    } else if (lisItem.payment_status === 'FECHADO_EM_ENVELOPE' || lisItem.payment_status === 'CONFIRMADO') {
      status = 'OK';
      reason = `Resolvido (${lisItem.payment_status})`;
      totalResolvido += prod.amount;
      countOk++;
    } else if (lisItem.payment_status === 'NAO_PAGO') {
      status = 'PENDENTE';
      reason = 'Marcado como não pago';
      totalPendente += prod.amount;
      countPendente++;
    } else {
      status = 'PENDENTE';
      reason = `Status: ${lisItem.payment_status}`;
      totalPendente += prod.amount;
      countPendente++;
    }

    items.push({
      id: prod.id,
      exam_date: prod.exam_date,
      lis_code: prod.lis_code,
      patient_name: prod.patient_name,
      amount: prod.amount,
      status,
      reason,
      lis_item_id: lisItem?.id,
      lis_payment_status: lisItem?.payment_status,
      lis_payment_method: lisItem?.payment_method,
      lis_amount: lisItem?.amount,
    });
  }

  const totalProducao = productionData.reduce((sum, p) => sum + p.amount, 0);

  return {
    summary: {
      total_producao: totalProducao,
      total_resolvido: totalResolvido,
      total_pendente: totalPendente,
      diferenca: totalProducao - totalResolvido,
      count_total: productionData.length,
      count_ok: countOk,
      count_pendente: countPendente,
      count_nao_encontrado: countNaoEncontrado,
    },
    items: items.filter(i => i.status !== 'OK'), // Retorna apenas pendências
  };
}
