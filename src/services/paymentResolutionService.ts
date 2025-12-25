import { supabase } from '@/integrations/supabase/client';
import { LisItemForEnvelope } from './envelopeClosingService';

export type PaymentMethodType = 'PIX' | 'CARTAO';

/**
 * Busca items PIX disponíveis para resolução
 */
export async function getAvailablePixItems(unitId: string): Promise<LisItemForEnvelope[]> {
  const { data, error } = await supabase
    .from('lis_closure_items')
    .select(`
      *,
      unit:units(name)
    `)
    .eq('unit_id', unitId)
    .eq('payment_method', 'PIX')
    .eq('payment_status', 'PENDENTE')
    .order('date', { ascending: true })
    .order('lis_code', { ascending: true });

  if (error) throw error;

  return (data || []).map(item => ({
    ...item,
    unit_name: item.unit?.name || null,
    unit: undefined,
  })) as LisItemForEnvelope[];
}

/**
 * Busca items CARTÃO disponíveis para resolução
 */
export async function getAvailableCardItems(unitId: string): Promise<LisItemForEnvelope[]> {
  const { data, error } = await supabase
    .from('lis_closure_items')
    .select(`
      *,
      unit:units(name)
    `)
    .eq('unit_id', unitId)
    .eq('payment_method', 'CARTAO')
    .eq('payment_status', 'PENDENTE')
    .order('date', { ascending: true })
    .order('lis_code', { ascending: true });

  if (error) throw error;

  return (data || []).map(item => ({
    ...item,
    unit_name: item.unit?.name || null,
    unit: undefined,
  })) as LisItemForEnvelope[];
}

/**
 * Resolve items de pagamento - marca como CONFIRMADO
 */
export async function resolvePaymentItems(
  itemIds: string[],
  unitId: string,
  paymentMethod: PaymentMethodType,
): Promise<void> {
  if (itemIds.length === 0) return;

  const { error } = await supabase
    .from('lis_closure_items')
    .update({
      payment_status: 'CONFIRMADO',
    })
    .in('id', itemIds)
    .eq('unit_id', unitId)
    .eq('payment_method', paymentMethod);

  if (error) throw error;
}

/**
 * Calcula totais para itens de cartão (bruto, taxa, líquido)
 */
export interface CardTotals {
  grossAmount: number;
  feeAmount: number;
  netAmount: number;
}

export function calculateCardTotals(items: LisItemForEnvelope[]): CardTotals {
  let grossAmount = 0;
  let feeAmount = 0;
  let netAmount = 0;

  for (const item of items) {
    grossAmount += item.gross_amount || item.amount || 0;
    feeAmount += item.card_fee_value || 0;
    netAmount += item.net_amount || item.amount || 0;
  }

  return { grossAmount, feeAmount, netAmount };
}

/**
 * Calcula total para itens PIX (valor total)
 */
export function calculatePixTotal(items: LisItemForEnvelope[]): number {
  return items.reduce((sum, item) => sum + (item.amount || 0), 0);
}
