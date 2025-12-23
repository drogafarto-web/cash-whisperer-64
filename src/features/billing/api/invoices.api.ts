import { supabase } from '@/integrations/supabase/client';
import { Invoice } from '@/types/billing';

export interface InvoiceFilters {
  competenceYear?: number;
  competenceMonth?: number;
  payerId?: string;
  unitId?: string;
  status?: string;
}

export async function fetchInvoices(filters?: InvoiceFilters): Promise<Invoice[]> {
  let query = supabase
    .from('invoices')
    .select(`
      *,
      payer:payers(*),
      unit:units(*)
    `)
    .order('issue_date', { ascending: false });

  if (filters?.competenceYear) {
    query = query.eq('competence_year', filters.competenceYear);
  }
  if (filters?.competenceMonth) {
    query = query.eq('competence_month', filters.competenceMonth);
  }
  if (filters?.payerId) {
    query = query.eq('payer_id', filters.payerId);
  }
  if (filters?.unitId) {
    query = query.eq('unit_id', filters.unitId);
  }
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as Invoice[];
}

function sanitizeInvoiceData(invoice: Partial<Invoice>) {
  const sanitized = { ...invoice };
  
  // Converter strings vazias para null em campos UUID
  if (sanitized.payer_id === '' || sanitized.payer_id === 'manual') {
    sanitized.payer_id = null;
  }
  if (sanitized.unit_id === '' || sanitized.unit_id === 'none') {
    sanitized.unit_id = null;
  }
  if (sanitized.file_path === '') {
    sanitized.file_path = null;
  }
  
  return sanitized;
}

export async function upsertInvoice(invoice: Partial<Invoice> & { id?: string }) {
  const sanitized = sanitizeInvoiceData(invoice);
  
  if (sanitized.id) {
    const { data, error } = await supabase
      .from('invoices')
      .update(sanitized as any)
      .eq('id', sanitized.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    const { id, ...insertData } = sanitized;
    const { data, error } = await supabase
      .from('invoices')
      .insert(insertData as any)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}
