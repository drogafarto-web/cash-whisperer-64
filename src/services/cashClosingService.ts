/**
 * Serviço para gerenciar fechamento de caixa com seleção de códigos LIS
 * 
 * Fluxo:
 * 1. Recepcionista seleciona quais códigos LIS foram pagos neste fechamento
 * 2. Sistema calcula expectedCash = soma de cash_component dos selecionados
 * 3. Recepcionista informa countedCash (valor contado no caixa físico)
 * 4. Sistema compara e valida
 * 5. Ao confirmar, vincula itens ao fechamento e marca como PAGO_NESTE_FECHAMENTO
 */

import { supabase } from '@/integrations/supabase/client';
import { generateEnvelopeId } from '@/utils/zpl';

export interface CloseLisItemsParams {
  dailyClosingId: string;
  lisItemIds: string[];
  expectedCash: number;
  countedCash: number;
  userId: string;
  unitId: string;
  unitCode: string;
  notes?: string;
}

export interface ClosingResult {
  success: boolean;
  envelopeId: string;
  difference: number;
  itemsLinked: number;
  labelSequence: number;
}

/**
 * Vincula itens LIS selecionados ao fechamento diário
 * e atualiza seus payment_status para PAGO_NESTE_FECHAMENTO
 */
export async function linkLisItemsToClosing(
  envelopeId: string,
  lisItemIds: string[]
): Promise<number> {
  if (lisItemIds.length === 0) return 0;

  const { error } = await supabase
    .from('lis_closure_items')
    .update({
      payment_status: 'PAGO_NESTE_FECHAMENTO',
      envelope_id: envelopeId,
    })
    .in('id', lisItemIds);

  if (error) throw error;
  return lisItemIds.length;
}

/**
 * Verifica se algum dos itens já está vinculado a outro fechamento
 */
export async function checkItemsNotLinked(lisItemIds: string[]): Promise<boolean> {
  if (lisItemIds.length === 0) return true;

  const { data, error } = await supabase
    .from('lis_closure_items')
    .select('id, envelope_id')
    .in('id', lisItemIds)
    .not('envelope_id', 'is', null);

  if (error) throw error;
  return data?.length === 0;
}

/**
 * Obtém próximo número de sequência para etiqueta do dia/unidade
 */
export async function getNextLabelSequence(unitId: string, date: string): Promise<number> {
  const { count, error } = await supabase
    .from('daily_cash_closings')
    .select('*', { count: 'exact', head: true })
    .eq('unit_id', unitId)
    .gte('date', date);

  if (error) throw error;
  return (count || 0) + 1;
}

/**
 * Cria ou atualiza fechamento diário com os itens LIS selecionados
 */
export async function createOrUpdateDailyClosing(params: {
  lisClosureId: string;
  unitId: string;
  unitCode: string;
  date: string;
  expectedCash: number;
  countedCash: number;
  lisItemIds: string[];
  userId: string;
  notes?: string;
  existingClosingId?: string;
}): Promise<ClosingResult> {
  const {
    lisClosureId,
    unitId,
    unitCode,
    date,
    expectedCash,
    countedCash,
    lisItemIds,
    userId,
    notes,
    existingClosingId,
  } = params;

  // Verificar se itens não estão vinculados a outro fechamento
  const itemsAvailable = await checkItemsNotLinked(lisItemIds);
  if (!itemsAvailable) {
    throw new Error('Alguns itens selecionados já estão vinculados a outro fechamento.');
  }

  const difference = countedCash - expectedCash;
  const hasDifference = Math.abs(difference) > 0.01;
  const status = hasDifference ? 'CONFERIDO_COM_DIFERENCA' : 'CONFERIDO';

  // Obter sequência para envelope
  const sequence = await getNextLabelSequence(unitId, date);
  const envelopeId = generateEnvelopeId(unitCode, date, sequence);

  const closingData = {
    lis_closure_id: lisClosureId,
    unit_id: unitId,
    date,
    expected_cash: expectedCash,
    counted_cash: countedCash,
    difference,
    status,
    counted_by: userId,
    counted_at: new Date().toISOString(),
    confirmed_by: userId,
    confirmed_at: new Date().toISOString(),
    notes: notes || null,
    envelope_id: envelopeId,
    lis_codes_count: lisItemIds.length,
    selected_lis_item_ids: lisItemIds,
    label_sequence: sequence,
  };

  let dailyClosingId: string;

  if (existingClosingId) {
    const { error } = await supabase
      .from('daily_cash_closings')
      .update(closingData)
      .eq('id', existingClosingId);
    if (error) throw error;
    dailyClosingId = existingClosingId;
  } else {
    const { data, error } = await supabase
      .from('daily_cash_closings')
      .insert(closingData)
      .select('id')
      .single();
    if (error) throw error;
    dailyClosingId = data.id;
  }

  // Vincular itens LIS ao fechamento
  const itemsLinked = await linkLisItemsToClosing(dailyClosingId, lisItemIds);

  return {
    success: true,
    envelopeId,
    difference,
    itemsLinked,
    labelSequence: sequence,
  };
}

/**
 * Verifica se etiqueta já foi emitida para um fechamento
 */
export async function checkLabelEmitted(dailyClosingId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('daily_cash_closings')
    .select('label_emitted_at')
    .eq('id', dailyClosingId)
    .single();

  if (error) throw error;
  return !!data?.label_emitted_at;
}

/**
 * Marca etiqueta como emitida (uma única vez)
 */
export async function markLabelEmitted(dailyClosingId: string, userId: string): Promise<void> {
  // Primeiro verifica se já foi emitida
  const alreadyEmitted = await checkLabelEmitted(dailyClosingId);
  if (alreadyEmitted) {
    throw new Error('Etiqueta já foi emitida. Não é possível gerar segunda via.');
  }

  const { error } = await supabase
    .from('daily_cash_closings')
    .update({
      label_emitted_at: new Date().toISOString(),
      status: 'FECHADO',
    })
    .eq('id', dailyClosingId);

  if (error) throw error;
}

/**
 * Busca itens LIS de um fechamento com os novos campos de componentes
 */
export async function fetchLisItemsWithComponents(closureId: string) {
  const { data, error } = await supabase
    .from('lis_closure_items')
    .select(`
      id,
      lis_code,
      date,
      patient_name,
      convenio,
      payment_method,
      amount,
      gross_amount,
      status,
      payment_status,
      cash_component,
      receivable_component,
      envelope_id
    `)
    .eq('closure_id', closureId)
    .order('date', { ascending: true });

  if (error) throw error;
  return data;
}

/**
 * Atualiza os componentes de pagamento dos itens LIS
 * (usado após importação para calcular cash_component e receivable_component)
 */
export async function updateItemPaymentComponents(
  itemId: string,
  cashComponent: number,
  receivableComponent: number,
  paymentStatus: string
): Promise<void> {
  const { error } = await supabase
    .from('lis_closure_items')
    .update({
      cash_component: cashComponent,
      receivable_component: receivableComponent,
      payment_status: paymentStatus,
    })
    .eq('id', itemId);

  if (error) throw error;
}

/**
 * Calcula e atualiza componentes para todos os itens de um fechamento
 */
export async function calculateAndUpdateAllComponents(closureId: string): Promise<void> {
  const { data: items, error: fetchError } = await supabase
    .from('lis_closure_items')
    .select('id, payment_method, amount, gross_amount, convenio, status')
    .eq('closure_id', closureId);

  if (fetchError) throw fetchError;
  if (!items) return;

  for (const item of items) {
    // Determinar se é particular baseado no convênio
    const isParticular = !item.convenio || 
      item.convenio.toLowerCase().includes('particular') ||
      item.convenio.toLowerCase().includes('part.');

    let cashComponent = 0;
    let receivableComponent = 0;
    let paymentStatus = 'PENDENTE';

    // NAO_PAGO vai para A_RECEBER
    if (item.payment_method === 'NAO_PAGO' || item.status === 'NAO_PAGO') {
      cashComponent = 0;
      receivableComponent = item.gross_amount || item.amount || 0;
      paymentStatus = 'A_RECEBER';
    } else if (isParticular) {
      // Particular: todo valor é cash
      cashComponent = item.amount || 0;
      receivableComponent = 0;
      paymentStatus = 'PENDENTE';
    } else if (item.amount > 0) {
      // Convênio com complemento
      cashComponent = item.amount;
      receivableComponent = Math.max(0, (item.gross_amount || item.amount) - item.amount);
      paymentStatus = 'PENDENTE';
    } else {
      // Convênio puro
      cashComponent = 0;
      receivableComponent = item.gross_amount || 0;
      paymentStatus = 'A_RECEBER';
    }

    await updateItemPaymentComponents(item.id, cashComponent, receivableComponent, paymentStatus);
  }
}
