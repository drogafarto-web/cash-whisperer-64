import { supabase } from '@/integrations/supabase/client';
import { Payer } from '@/types/billing';

export async function fetchPayers(activeOnly = true): Promise<Payer[]> {
  let query = supabase
    .from('payers')
    .select('*')
    .order('name');

  if (activeOnly) {
    query = query.eq('active', true);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as Payer[];
}

export async function upsertPayer(payer: Partial<Payer> & { id?: string }) {
  if (payer.id) {
    const { data, error } = await supabase
      .from('payers')
      .update(payer as any)
      .eq('id', payer.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase
      .from('payers')
      .insert(payer as any)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}
