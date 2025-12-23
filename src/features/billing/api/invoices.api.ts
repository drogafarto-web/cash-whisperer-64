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

export async function upsertInvoice(invoice: Partial<Invoice> & { id?: string }) {
  if (invoice.id) {
    const { data, error } = await supabase
      .from('invoices')
      .update(invoice as any)
      .eq('id', invoice.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase
      .from('invoices')
      .insert(invoice as any)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}
