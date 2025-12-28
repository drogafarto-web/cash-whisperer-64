import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Account } from '@/types/database';

export function useBankAccounts(unitId?: string) {
  return useQuery({
    queryKey: ['bank-accounts', unitId],
    queryFn: async () => {
      let query = supabase
        .from('accounts')
        .select('*')
        .eq('active', true)
        .in('type', ['CONTA_BANCARIA', 'OPERADORA_CARTAO'])
        .order('is_default', { ascending: false })
        .order('name');

      if (unitId) {
        query = query.or(`unit_id.eq.${unitId},unit_id.is.null`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Account[];
    },
  });
}

export function useDefaultBankAccount() {
  return useQuery({
    queryKey: ['default-bank-account'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('is_default', true)
        .eq('active', true)
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as Account | null;
    },
  });
}
