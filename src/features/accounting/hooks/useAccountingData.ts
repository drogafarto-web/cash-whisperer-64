import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AccountingContact {
  id: string;
  nome: string;
  email: string;
  telefone?: string;
  empresa?: string;
  ativo: boolean;
  created_at: string;
}

export interface AccountingToken {
  id: string;
  token: string;
  tipo: 'mensal' | 'historico';
  ano?: number;
  mes?: number;
  ano_inicio?: number;
  mes_inicio?: number;
  ano_fim?: number;
  mes_fim?: number;
  expires_at: string;
  used_at?: string;
  contact_id: string;
  created_at: string;
}

export interface AccountingEmailLog {
  id: string;
  token_id: string;
  contact_id: string;
  email_to: string;
  subject: string;
  sent_at: string;
  status: string;
  error_message?: string;
}

// Fetch accounting contacts
export function useAccountingContacts() {
  return useQuery({
    queryKey: ['accounting-contacts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounting_contacts')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as AccountingContact[];
    },
  });
}

// Create accounting contact
export function useCreateAccountingContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (contact: Omit<AccountingContact, 'id' | 'created_at' | 'ativo'>) => {
      const { data, error } = await supabase
        .from('accounting_contacts')
        .insert({ ...contact, ativo: true })
        .select()
        .single();
      
      if (error) throw error;
      return data as AccountingContact;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounting-contacts'] });
      toast.success('Contato criado com sucesso');
    },
    onError: (error: Error) => {
      toast.error('Erro ao criar contato: ' + error.message);
    },
  });
}

// Update accounting contact
export function useUpdateAccountingContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...contact }: Partial<AccountingContact> & { id: string }) => {
      const { data, error } = await supabase
        .from('accounting_contacts')
        .update(contact)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as AccountingContact;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounting-contacts'] });
      toast.success('Contato atualizado');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar contato: ' + error.message);
    },
  });
}

// Fetch accounting tokens
export function useAccountingTokens() {
  return useQuery({
    queryKey: ['accounting-tokens'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounting_tokens')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as AccountingToken[];
    },
  });
}

// Fetch email logs
export function useAccountingEmailLogs() {
  return useQuery({
    queryKey: ['accounting-email-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounting_email_logs')
        .select('*')
        .order('sent_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data as AccountingEmailLog[];
    },
  });
}

// Send accounting link
export function useSendAccountingLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      contact_id: string;
      tipo: 'mensal' | 'historico';
      ano?: number;
      mes?: number;
      ano_inicio?: number;
      mes_inicio?: number;
      ano_fim?: number;
      mes_fim?: number;
    }) => {
      const { data, error } = await supabase.functions.invoke('send-accounting-link', {
        body: params,
      });
      
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['accounting-tokens'] });
      queryClient.invalidateQueries({ queryKey: ['accounting-email-logs'] });
      toast.success(`Email enviado para ${data.email_sent_to}`);
    },
    onError: (error: Error) => {
      toast.error('Erro ao enviar link: ' + error.message);
    },
  });
}
