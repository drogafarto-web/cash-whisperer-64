import { supabase } from '@/integrations/supabase/client';
import { SupplierInvoice, SupplierInvoiceFormData } from '@/types/payables';

export async function fetchSupplierInvoices(unitId?: string) {
  let query = supabase
    .from('supplier_invoices')
    .select('*')
    .order('issue_date', { ascending: false });

  if (unitId) {
    query = query.eq('unit_id', unitId);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data as SupplierInvoice[];
}

export async function fetchSupplierInvoiceById(id: string) {
  const { data, error } = await supabase
    .from('supplier_invoices')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as SupplierInvoice;
}

export async function createSupplierInvoice(
  data: SupplierInvoiceFormData,
  filePath?: string,
  fileName?: string,
  ocrConfidence?: number,
  status?: string
) {
  const { data: result, error } = await supabase
    .from('supplier_invoices')
    .insert({
      document_number: data.document_number,
      document_series: data.document_series,
      supplier_name: data.supplier_name,
      supplier_cnpj: data.supplier_cnpj,
      issue_date: data.issue_date,
      due_date: data.due_date,
      total_value: data.total_value,
      description: data.description,
      payment_conditions: data.payment_conditions,
      installments_count: data.installments_count,
      unit_id: data.unit_id,
      category_id: data.category_id,
      file_path: filePath,
      file_name: fileName,
      ocr_confidence: ocrConfidence,
      status: status || 'pendente',
      payment_method: data.payment_method,
      payment_pix_key: data.payment_pix_key,
      payment_bank_account_id: data.payment_bank_account_id || null,
    })
    .select()
    .single();

  if (error) throw error;
  return result as SupplierInvoice;
}

export async function updateSupplierInvoice(id: string, data: Partial<SupplierInvoiceFormData>) {
  const updateData: Record<string, unknown> = {
    ...data,
    updated_at: new Date().toISOString(),
  };
  
  // Handle empty bank account id
  if (data.payment_bank_account_id === '') {
    updateData.payment_bank_account_id = null;
  }
  
  const { data: result, error } = await supabase
    .from('supplier_invoices')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return result as SupplierInvoice;
}

export async function deleteSupplierInvoice(id: string) {
  const { error } = await supabase
    .from('supplier_invoices')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function updateSupplierInvoiceStatus(id: string, status: string) {
  const { data, error } = await supabase
    .from('supplier_invoices')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as SupplierInvoice;
}

export async function checkDuplicateSupplierInvoice(
  documentNumber: string,
  supplierCnpj: string | undefined,
  issueDate: string,
  excludeId?: string
): Promise<boolean> {
  if (!documentNumber) return false;

  let query = supabase
    .from('supplier_invoices')
    .select('id')
    .eq('document_number', documentNumber)
    .eq('issue_date', issueDate);

  if (supplierCnpj) {
    query = query.eq('supplier_cnpj', supplierCnpj);
  }

  if (excludeId) {
    query = query.neq('id', excludeId);
  }

  const { data } = await query.limit(1);
  return (data?.length ?? 0) > 0;
}

// Auto-matching function for boleto linking
export interface SupplierInvoiceMatch {
  invoice: SupplierInvoice;
  matchScore: number;
  matchReasons: string[];
}

export async function findMatchingSupplierInvoices(
  beneficiarioCnpj: string | undefined,
  valor: number | undefined,
  tolerancePercent: number = 5
): Promise<SupplierInvoiceMatch[]> {
  // Fetch recent pending supplier invoices (last 90 days)
  // Only fetch invoices with payment_method = 'boleto'
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const { data: invoices, error } = await supabase
    .from('supplier_invoices')
    .select('*')
    .eq('payment_method', 'boleto')
    .in('status', ['pendente', 'parcial', 'aguardando_boleto'])
    .gte('issue_date', ninetyDaysAgo.toISOString().split('T')[0])
    .order('issue_date', { ascending: false })
    .limit(100);

  if (error || !invoices) return [];

  const matches: SupplierInvoiceMatch[] = [];

  for (const invoice of invoices) {
    let matchScore = 0;
    const matchReasons: string[] = [];

    // Bonus for status 'aguardando_boleto' - highest priority
    if (invoice.status === 'aguardando_boleto') {
      matchScore += 30;
      matchReasons.push('Aguardando boleto');
    }

    // CNPJ match (strongest)
    if (beneficiarioCnpj && invoice.supplier_cnpj) {
      const normalizedBoleto = beneficiarioCnpj.replace(/\D/g, '');
      const normalizedInvoice = invoice.supplier_cnpj.replace(/\D/g, '');
      if (normalizedBoleto === normalizedInvoice) {
        matchScore += 50;
        matchReasons.push('CNPJ coincide');
      }
    }

    // Value match (with tolerance)
    if (valor && invoice.total_value) {
      const tolerance = invoice.total_value * (tolerancePercent / 100);
      const diff = Math.abs(valor - invoice.total_value);
      if (diff <= tolerance) {
        matchScore += 40;
        matchReasons.push(diff === 0 ? 'Valor exato' : `Valor aproximado (${((diff / invoice.total_value) * 100).toFixed(1)}% diferença)`);
      }
    }

    // Only include if we have at least some match
    if (matchScore >= 40) {
      matches.push({ invoice, matchScore, matchReasons });
    }
  }

  // Sort by score descending (aguardando_boleto will naturally be prioritized)
  return matches.sort((a, b) => b.matchScore - a.matchScore);
}

// Update invoice status when a boleto is linked
export async function updateInvoiceStatusOnBoletoLink(invoiceId: string) {
  // Check current status
  const { data: invoice } = await supabase
    .from('supplier_invoices')
    .select('status')
    .eq('id', invoiceId)
    .single();

  // If status is 'aguardando_boleto', update to 'pendente'
  if (invoice?.status === 'aguardando_boleto') {
    await supabase
      .from('supplier_invoices')
      .update({ status: 'pendente', updated_at: new Date().toISOString() })
      .eq('id', invoiceId);
  }
}
