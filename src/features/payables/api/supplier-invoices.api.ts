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
  ocrConfidence?: number
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
      status: 'pendente',
    })
    .select()
    .single();

  if (error) throw error;
  return result as SupplierInvoice;
}

export async function updateSupplierInvoice(id: string, data: Partial<SupplierInvoiceFormData>) {
  const { data: result, error } = await supabase
    .from('supplier_invoices')
    .update({
      ...data,
      updated_at: new Date().toISOString(),
    })
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
