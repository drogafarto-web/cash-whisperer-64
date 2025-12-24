import { supabase } from '@/integrations/supabase/client';
import { Payable, PayableFormData, PayableStatus } from '@/types/payables';

export async function fetchPayables(filters?: {
  unitId?: string;
  status?: PayableStatus | PayableStatus[];
  supplierInvoiceId?: string;
  startDate?: string;
  endDate?: string;
}) {
  let query = supabase
    .from('payables')
    .select('*')
    .order('vencimento', { ascending: true });

  if (filters?.unitId) {
    query = query.eq('unit_id', filters.unitId);
  }

  if (filters?.status) {
    if (Array.isArray(filters.status)) {
      query = query.in('status', filters.status);
    } else {
      query = query.eq('status', filters.status);
    }
  }

  if (filters?.supplierInvoiceId) {
    query = query.eq('supplier_invoice_id', filters.supplierInvoiceId);
  }

  if (filters?.startDate) {
    query = query.gte('vencimento', filters.startDate);
  }

  if (filters?.endDate) {
    query = query.lte('vencimento', filters.endDate);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data as Payable[];
}

export async function fetchPayableById(id: string) {
  const { data, error } = await supabase
    .from('payables')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as Payable;
}

export async function createPayable(
  data: PayableFormData,
  filePath?: string,
  fileName?: string,
  ocrConfidence?: number
) {
  const { data: result, error } = await supabase
    .from('payables')
    .insert({
      beneficiario: data.beneficiario,
      beneficiario_cnpj: data.beneficiario_cnpj,
      valor: data.valor,
      vencimento: data.vencimento,
      linha_digitavel: data.linha_digitavel,
      codigo_barras: data.codigo_barras,
      banco_codigo: data.banco_codigo,
      banco_nome: data.banco_nome,
      description: data.description,
      tipo: data.tipo,
      parcela_numero: data.parcela_numero,
      parcela_total: data.parcela_total,
      supplier_invoice_id: data.supplier_invoice_id,
      unit_id: data.unit_id,
      category_id: data.category_id,
      file_path: filePath,
      file_name: fileName,
      ocr_confidence: ocrConfidence,
      status: 'pendente',
    })
    .select()
    .single();

  if (error) throw error;
  return result as Payable;
}

export async function createPayablesFromParcelas(
  parcelas: Array<{
    numero: number;
    valor: number;
    vencimento: string;
    linha_digitavel?: string;
  }>,
  supplierInvoice: {
    id: string;
    supplier_name: string;
    supplier_cnpj?: string | null;
    unit_id?: string | null;
    category_id?: string | null;
  }
) {
  const payablesToInsert = parcelas.map((parcela) => ({
    beneficiario: supplierInvoice.supplier_name,
    beneficiario_cnpj: supplierInvoice.supplier_cnpj,
    valor: parcela.valor,
    vencimento: parcela.vencimento,
    linha_digitavel: parcela.linha_digitavel,
    tipo: 'boleto',
    parcela_numero: parcela.numero,
    parcela_total: parcelas.length,
    supplier_invoice_id: supplierInvoice.id,
    unit_id: supplierInvoice.unit_id,
    category_id: supplierInvoice.category_id,
    status: 'pendente',
  }));

  const { data, error } = await supabase
    .from('payables')
    .insert(payablesToInsert)
    .select();

  if (error) throw error;
  return data as Payable[];
}

export async function updatePayable(id: string, data: Partial<PayableFormData>) {
  const { data: result, error } = await supabase
    .from('payables')
    .update({
      ...data,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return result as Payable;
}

export async function deletePayable(id: string) {
  const { error } = await supabase
    .from('payables')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function markPayableAsPaid(
  id: string,
  paidAmount: number,
  paidMethod: string,
  transactionId?: string
) {
  const { data, error } = await supabase
    .from('payables')
    .update({
      status: 'pago',
      paid_at: new Date().toISOString(),
      paid_amount: paidAmount,
      paid_method: paidMethod,
      matched_transaction_id: transactionId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as Payable;
}

export async function reconcilePayableWithBankItem(
  payableId: string,
  bankItemId: string,
  paidAmount: number
) {
  const { data, error } = await supabase
    .from('payables')
    .update({
      status: 'pago',
      paid_at: new Date().toISOString(),
      paid_amount: paidAmount,
      paid_method: 'transferencia',
      matched_bank_item_id: bankItemId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', payableId)
    .select()
    .single();

  if (error) throw error;
  return data as Payable;
}

export async function fetchPendingPayablesForReconciliation(unitId?: string) {
  let query = supabase
    .from('payables')
    .select('*')
    .in('status', ['pendente', 'vencido'])
    .is('matched_transaction_id', null)
    .is('matched_bank_item_id', null)
    .order('vencimento', { ascending: true });

  if (unitId) {
    query = query.eq('unit_id', unitId);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data as Payable[];
}

export async function checkDuplicatePayableByCodigoBarras(
  codigoBarras: string,
  excludeId?: string
): Promise<boolean> {
  if (!codigoBarras) return false;
  
  let query = supabase
    .from('payables')
    .select('id')
    .eq('codigo_barras', codigoBarras);

  if (excludeId) {
    query = query.neq('id', excludeId);
  }

  const { data } = await query.limit(1);
  return (data?.length ?? 0) > 0;
}

export async function checkDuplicatePayableByLinhaDigitavel(
  linhaDigitavel: string,
  excludeId?: string
): Promise<boolean> {
  if (!linhaDigitavel) return false;
  
  let query = supabase
    .from('payables')
    .select('id')
    .eq('linha_digitavel', linhaDigitavel);

  if (excludeId) {
    query = query.neq('id', excludeId);
  }

  const { data } = await query.limit(1);
  return (data?.length ?? 0) > 0;
}
