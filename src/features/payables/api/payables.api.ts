import { supabase } from '@/integrations/supabase/client';
import { Payable, PayableFormData, PayableStatus, PAYABLE_STATUS } from '@/types/payables';

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
    .order('created_at', { ascending: false });

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
  ocrConfidence?: number,
  nfVinculacaoStatus?: 'nao_requer' | 'pendente' | 'vinculado',
  nfExemptionReason?: string,
  nfInSameDocument?: boolean
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
      supplier_invoice_id: data.supplier_invoice_id || null,
      unit_id: data.unit_id || null,
      category_id: data.category_id || null,
      file_path: filePath,
      file_name: fileName,
      ocr_confidence: ocrConfidence,
      status: PAYABLE_STATUS.PENDENTE,
      nf_vinculacao_status: nfVinculacaoStatus || 'nao_requer',
      nf_exemption_reason: nfExemptionReason || null,
      nf_in_same_document: nfInSameDocument || false,
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
    status: PAYABLE_STATUS.PENDENTE,
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
  const paidAt = new Date().toISOString();
  
  const { data, error } = await supabase
    .from('payables')
    .update({
      status: PAYABLE_STATUS.PAGO,
      paid_at: paidAt,
      paid_amount: paidAmount,
      paid_method: paidMethod,
      matched_transaction_id: transactionId,
      updated_at: paidAt,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  // Se não tinha transaction vinculada, criar uma nova para o fluxo de caixa
  if (!transactionId && data) {
    await createTransactionFromPayable(data as Payable, paidAt);
  }

  return data as Payable;
}

// Função auxiliar para criar transaction a partir de um payable pago
async function createTransactionFromPayable(
  payable: Payable,
  paidAt: string,
  paymentAccountId?: string
) {
  try {
    // Verificar campos obrigatórios - se não tiver, não criar transaction
    const accountId = paymentAccountId || payable.payment_bank_account_id;
    if (!accountId) {
      console.warn('Não foi possível criar transaction: account_id ausente');
      return;
    }

    const categoryId = payable.category_id;
    if (!categoryId) {
      console.warn('Não foi possível criar transaction: category_id ausente');
      return;
    }

    const description = [
      payable.beneficiario,
      payable.description
    ].filter(Boolean).join(' - ') || 'Pagamento';

    // Obter usuário autenticado para created_by
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) {
      console.warn('Não foi possível criar transaction: usuário não autenticado');
      return;
    }

    const { data: newTx, error: txError } = await supabase
      .from('transactions')
      .insert({
        type: 'SAIDA',
        amount: -(payable.paid_amount || payable.valor),
        date: paidAt.split('T')[0],
        description,
        account_id: accountId,
        category_id: categoryId,
        unit_id: payable.unit_id,
        status: 'APROVADO',
        payment_method: payable.paid_method || 'transferencia',
        created_by: user.id,
        revenue_source: 'payables',
      })
      .select('id')
      .single();

    if (txError) {
      console.error('Erro ao criar transaction para payable:', txError);
      return;
    }

    // Atualizar o payable com o ID da transaction criada
    if (newTx?.id) {
      await supabase
        .from('payables')
        .update({ matched_transaction_id: newTx.id })
        .eq('id', payable.id);
    }
  } catch (err) {
    console.error('Erro ao sincronizar payable com transactions:', err);
  }
}

export async function reconcilePayableWithBankItem(
  payableId: string,
  bankItemId: string,
  paidAmount: number
) {
  const { data, error } = await supabase
    .from('payables')
    .update({
      status: PAYABLE_STATUS.PAGO,
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
    .in('status', [PAYABLE_STATUS.PENDENTE, PAYABLE_STATUS.VENCIDO])
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

// Update file attachment for an existing payable
export async function updatePayableFile(
  id: string,
  filePath: string,
  fileName: string
): Promise<Payable> {
  const { data, error } = await supabase
    .from('payables')
    .update({
      file_path: filePath,
      file_name: fileName,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as Payable;
}

// Create payable and immediately mark as paid (for receipts without existing pending payables)
export async function createPayableAndMarkAsPaid(
  data: {
    beneficiario: string;
    beneficiario_cnpj?: string;
    valor: number;
    vencimento: string;
    description?: string;
    tipo: 'boleto' | 'pix';
    linha_digitavel?: string;
    codigo_barras?: string;
    banco_codigo?: string;
    banco_nome?: string;
    unit_id?: string;
    category_id?: string;
  },
  paidAmount: number,
  paidMethod: string,
  filePath?: string,
  fileName?: string
): Promise<Payable> {
  const { data: result, error } = await supabase
    .from('payables')
    .insert({
      beneficiario: data.beneficiario,
      beneficiario_cnpj: data.beneficiario_cnpj,
      valor: data.valor,
      vencimento: data.vencimento,
      description: data.description,
      tipo: data.tipo,
      linha_digitavel: data.linha_digitavel,
      codigo_barras: data.codigo_barras,
      banco_codigo: data.banco_codigo,
      banco_nome: data.banco_nome,
      unit_id: data.unit_id,
      category_id: data.category_id,
      file_path: filePath,
      file_name: fileName,
      status: PAYABLE_STATUS.PAGO,
      paid_at: new Date().toISOString(),
      paid_amount: paidAmount,
      paid_method: paidMethod,
    })
    .select()
    .single();

  if (error) throw error;
  return result as Payable;
}

// Update payment data for an existing payable (boleto/PIX info)
export async function updatePayablePaymentData(
  id: string,
  data: {
    vencimento?: string;
    linha_digitavel?: string;
    codigo_barras?: string;
    pix_key?: string;
    banco_codigo?: string;
    banco_nome?: string;
    payment_bank_account_id?: string;
  }
): Promise<Payable> {
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (data.vencimento) updateData.vencimento = data.vencimento;
  if (data.linha_digitavel) updateData.linha_digitavel = data.linha_digitavel;
  if (data.codigo_barras) updateData.codigo_barras = data.codigo_barras;
  if (data.pix_key) updateData.pix_key = data.pix_key;
  if (data.banco_codigo) updateData.banco_codigo = data.banco_codigo;
  if (data.banco_nome) updateData.banco_nome = data.banco_nome;
  if (data.payment_bank_account_id) updateData.payment_bank_account_id = data.payment_bank_account_id;

  const { data: result, error } = await supabase
    .from('payables')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return result as Payable;
}

// Fetch payables with payment data (linha_digitavel, codigo_barras, or pix_key)
// Now with optional toggle to show ALL payables, not just those with payment data
export async function fetchPayablesWithPaymentData(filters?: {
  unitId?: string;
  paymentAccountId?: string;
  periodDays?: number; // 7, 30, or undefined for all
  showAll?: boolean; // If true, show all payables regardless of payment data
  status?: 'PENDENTE' | 'PAGO' | 'VENCIDO' | 'all'; // Status filter
  monthYear?: string; // Format "2026-01" for filtering by month (used for paid payables)
}) {
  let query = supabase
    .from('payables')
    .select('*, accounts:payment_bank_account_id(id, name, institution), categories:category_id(id, name)')
    .order('created_at', { ascending: false });

  // Status filter
  if (filters?.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  } else if (!filters?.status) {
    // Default behavior: pending + overdue
    query = query.in('status', [PAYABLE_STATUS.PENDENTE, PAYABLE_STATUS.VENCIDO]);
  }

  // Month filter (for paid payables)
  if (filters?.monthYear) {
    const [year, month] = filters.monthYear.split('-').map(Number);
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
    query = query.gte('paid_at', startDate).lte('paid_at', endDate + 'T23:59:59');
  }

  // Only filter by payment data if showAll is not true and not filtering paid
  if (!filters?.showAll && filters?.status !== 'PAGO') {
    query = query.or('linha_digitavel.neq.null,codigo_barras.neq.null,pix_key.neq.null');
  }

  if (filters?.unitId && filters.unitId !== 'all') {
    query = query.eq('unit_id', filters.unitId);
  }

  if (filters?.paymentAccountId && filters.paymentAccountId !== 'all') {
    query = query.eq('payment_bank_account_id', filters.paymentAccountId);
  }

  if (filters?.periodDays && !filters?.monthYear) {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + filters.periodDays);
    query = query.lte('vencimento', endDate.toISOString().split('T')[0]);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data as (Payable & { 
    accounts?: { id: string; name: string; institution?: string } | null;
    categories?: { id: string; name: string } | null;
  })[];
}

// Mark payable as paid with additional options
export async function markPayableAsPaidWithAccount(
  id: string,
  paidAmount: number,
  paidMethod: string,
  paidAt: string,
  paymentAccountId?: string
) {
  // Verificar autenticação antes de prosseguir
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) {
    throw new Error('Usuário não autenticado. Faça login e tente novamente.');
  }

  const updateData: Record<string, unknown> = {
    status: PAYABLE_STATUS.PAGO,
    paid_at: paidAt,
    paid_amount: paidAmount,
    paid_method: paidMethod,
    updated_at: new Date().toISOString(),
  };

  if (paymentAccountId) {
    updateData.payment_bank_account_id = paymentAccountId;
  }

  const { data, error } = await supabase
    .from('payables')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  // Criar transaction para o fluxo de caixa (se não tiver vinculada)
  if (data && !(data as Payable).matched_transaction_id) {
    await createTransactionFromPayable(data as Payable, paidAt, paymentAccountId);
  }

  return data as Payable;
}
