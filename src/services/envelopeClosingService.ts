import { supabase } from '@/integrations/supabase/client';

export interface LisItemForEnvelope {
  id: string;
  lis_code: string;
  date: string;
  patient_name: string | null;
  convenio: string | null;
  amount: number;
  cash_component: number | null;
  receivable_component: number | null;
  payment_method: string;
  payment_status: string;
  closure_id: string;
  envelope_id: string | null;
}

export interface EnvelopeData {
  id: string;
  unit_id: string | null;
  closure_id: string;
  expected_cash: number;
  counted_cash: number | null;
  difference: number | null;
  justificativa: string | null;
  status: string;
  lis_codes: string[];
  lis_codes_count: number;
  label_printed_at: string | null;
  label_printed_by: string | null;
  created_at: string;
  created_by: string | null;
}

/**
 * Busca items LIS disponíveis para incluir em um envelope (cash_component > 0 e envelope_id IS NULL)
 */
export async function getAvailableItemsForEnvelope(closureId: string): Promise<LisItemForEnvelope[]> {
  const { data, error } = await supabase
    .from('lis_closure_items')
    .select('*')
    .eq('closure_id', closureId)
    .gt('cash_component', 0)
    .is('envelope_id', null)
    .order('date', { ascending: true })
    .order('lis_code', { ascending: true });

  if (error) throw error;
  return data as LisItemForEnvelope[];
}

/**
 * Busca items LIS por IDs específicos
 */
export async function getItemsByIds(itemIds: string[]): Promise<LisItemForEnvelope[]> {
  if (itemIds.length === 0) return [];
  
  const { data, error } = await supabase
    .from('lis_closure_items')
    .select('*')
    .in('id', itemIds);

  if (error) throw error;
  return data as LisItemForEnvelope[];
}

/**
 * Valida que nenhum dos items já está associado a outro envelope
 */
export async function validateItemsNotAssigned(itemIds: string[]): Promise<{ valid: boolean; conflictingIds: string[] }> {
  if (itemIds.length === 0) return { valid: true, conflictingIds: [] };

  const { data, error } = await supabase
    .from('lis_closure_items')
    .select('id, envelope_id')
    .in('id', itemIds)
    .not('envelope_id', 'is', null);

  if (error) throw error;

  const conflictingIds = data?.map(item => item.id) || [];
  return { valid: conflictingIds.length === 0, conflictingIds };
}

/**
 * Calcula a soma de cash_component para os items selecionados
 */
export function calculateExpectedCash(items: LisItemForEnvelope[]): number {
  return items.reduce((sum, item) => sum + (item.cash_component || 0), 0);
}

/**
 * Busca a próxima sequência de envelope para a unidade/dia
 */
export async function getNextEnvelopeSequence(unitId: string, date: string): Promise<number> {
  const startOfDay = `${date}T00:00:00`;
  const endOfDay = `${date}T23:59:59`;

  const { data, error } = await supabase
    .from('cash_envelopes')
    .select('id')
    .eq('unit_id', unitId)
    .gte('created_at', startOfDay)
    .lte('created_at', endOfDay);

  if (error) throw error;
  return (data?.length || 0) + 1;
}

/**
 * Cria um novo envelope e associa os items selecionados
 */
export async function createEnvelopeWithItems(params: {
  closureId: string;
  unitId: string;
  selectedItemIds: string[];
  countedCash: number;
  justificativa?: string;
  userId: string;
}): Promise<EnvelopeData> {
  const { closureId, unitId, selectedItemIds, countedCash, justificativa, userId } = params;

  // 1. Validar que items não estão em outro envelope
  const validation = await validateItemsNotAssigned(selectedItemIds);
  if (!validation.valid) {
    throw new Error(`Alguns códigos LIS já estão em outro envelope: ${validation.conflictingIds.join(', ')}`);
  }

  // 2. Buscar items para calcular expected_cash
  const items = await getItemsByIds(selectedItemIds);
  const expectedCash = calculateExpectedCash(items);
  const lisCodes = items.map(item => item.lis_code);

  // 3. Criar envelope
  const { data: envelope, error: envelopeError } = await supabase
    .from('cash_envelopes')
    .insert({
      closure_id: closureId,
      unit_id: unitId,
      cash_total: expectedCash,
      expected_cash: expectedCash,
      counted_cash: countedCash,
      difference: countedCash - expectedCash,
      justificativa: justificativa || null,
      lis_codes: lisCodes,
      lis_codes_count: lisCodes.length,
      status: 'fechado',
      created_by: userId,
    })
    .select()
    .single();

  if (envelopeError) throw envelopeError;

  // 4. Atualizar items para associar ao envelope
  const { error: updateError } = await supabase
    .from('lis_closure_items')
    .update({ 
      envelope_id: envelope.id,
      payment_status: 'FECHADO_EM_ENVELOPE'
    })
    .in('id', selectedItemIds);

  if (updateError) throw updateError;

  return envelope as EnvelopeData;
}

/**
 * Verifica se a etiqueta já foi impressa
 */
export async function checkLabelPrinted(envelopeId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('cash_envelopes')
    .select('label_printed_at')
    .eq('id', envelopeId)
    .single();

  if (error) throw error;
  return data?.label_printed_at !== null;
}

/**
 * Marca a etiqueta como impressa
 */
export async function markLabelPrinted(envelopeId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('cash_envelopes')
    .update({ 
      label_printed_at: new Date().toISOString(),
      label_printed_by: userId
    })
    .eq('id', envelopeId);

  if (error) throw error;
}

/**
 * Busca envelope pelo ID
 */
export async function getEnvelopeById(envelopeId: string): Promise<EnvelopeData | null> {
  const { data, error } = await supabase
    .from('cash_envelopes')
    .select('*')
    .eq('id', envelopeId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }
  return data as EnvelopeData;
}

/**
 * Busca items vinculados a um envelope
 */
export async function getItemsByEnvelope(envelopeId: string): Promise<LisItemForEnvelope[]> {
  const { data, error } = await supabase
    .from('lis_closure_items')
    .select('*')
    .eq('envelope_id', envelopeId)
    .order('lis_code', { ascending: true });

  if (error) throw error;
  return data as LisItemForEnvelope[];
}

/**
 * Busca envelopes de um closure
 */
export async function getEnvelopesByClosureId(closureId: string): Promise<EnvelopeData[]> {
  const { data, error } = await supabase
    .from('cash_envelopes')
    .select('*')
    .eq('closure_id', closureId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as EnvelopeData[];
}
