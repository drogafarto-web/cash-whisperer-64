import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface LisUser {
  id: string;
  lis_id: number | null;
  login: string;
  nome: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export function useLisUsers() {
  return useQuery({
    queryKey: ['lis-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lis_users')
        .select('*')
        .order('nome');
      
      if (error) throw error;
      return data as LisUser[];
    },
    staleTime: 1000 * 60 * 10, // 10 minutos
  });
}

export function useUnlinkedLisUsers() {
  return useQuery({
    queryKey: ['unlinked-lis-users'],
    queryFn: async () => {
      // Buscar LIS users e profiles em paralelo para eliminar N+1
      const [lisUsersResult, profilesResult] = await Promise.all([
        supabase
          .from('lis_users')
          .select('*')
          .eq('active', true)
          .order('nome'),
        supabase
          .from('profiles')
          .select('lis_login')
          .not('lis_login', 'is', null),
      ]);
      
      if (lisUsersResult.error) throw lisUsersResult.error;
      if (profilesResult.error) throw profilesResult.error;
      
      const linkedLogins = new Set(profilesResult.data?.map(p => p.lis_login?.toUpperCase()) || []);
      
      // Filter to only unlinked users
      return (lisUsersResult.data || []).filter(u => !linkedLogins.has(u.login.toUpperCase())) as LisUser[];
    },
    staleTime: 1000 * 60 * 5, // 5 minutos
  });
}

export function useLinkLisLogin() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      profileId, 
      lisLogin,
      lisId
    }: { 
      profileId: string; 
      lisLogin: string | null;
      lisId?: number | null;
    }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          lis_login: lisLogin,
          lis_id: lisId || null
        })
        .eq('id', profileId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unlinked-lis-users'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Login LIS vinculado!');
    },
    onError: (error) => {
      console.error('Error linking LIS login:', error);
      toast.error('Erro ao vincular login LIS');
    },
  });
}

export interface CreateUserFromLisParams {
  lis_login: string;
  lis_id: number | null;
  nome: string;
  email: string;
  role: string;
  unit_id: string;
}

export function useCreateUserFromLis() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (params: CreateUserFromLisParams) => {
      const { data, error } = await supabase.functions.invoke('create-user-from-lis', {
        body: params,
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return data as { success: boolean; user_id: string; message: string; reset_link: string | null };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unlinked-lis-users'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error) => {
      console.error('Error creating user from LIS:', error);
    },
  });
}
