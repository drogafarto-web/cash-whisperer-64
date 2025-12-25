import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ProfileFunction {
  id: string;
  profile_id: string;
  function: string;
  created_at: string;
}

// Available operational functions
export const OPERATIONAL_FUNCTIONS = [
  { value: 'atendimento', label: 'Atendimento', description: 'Atendimento ao paciente' },
  { value: 'coleta', label: 'Coleta', description: 'Coleta de materiais' },
  { value: 'caixa', label: 'Caixa', description: 'Operações de caixa' },
  { value: 'supervisao', label: 'Supervisão', description: 'Supervisão da unidade' },
  { value: 'tecnico', label: 'Técnico', description: 'Técnico de laboratório' },
] as const;

export type OperationalFunction = typeof OPERATIONAL_FUNCTIONS[number]['value'];

export function useProfileFunctions(profileId?: string) {
  return useQuery({
    queryKey: ['profile-functions', profileId],
    queryFn: async () => {
      if (!profileId) return [];
      const { data, error } = await supabase
        .from('profile_functions')
        .select('*')
        .eq('profile_id', profileId);
      
      if (error) throw error;
      return data as ProfileFunction[];
    },
    enabled: !!profileId,
  });
}

export function useAllProfileFunctions() {
  return useQuery({
    queryKey: ['all-profile-functions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profile_functions')
        .select('*');
      
      if (error) throw error;
      return data as ProfileFunction[];
    },
  });
}

export function useUpdateProfileFunctions() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      profileId, 
      functions 
    }: { 
      profileId: string; 
      functions: string[];
    }) => {
      // Delete existing functions for this profile
      const { error: deleteError } = await supabase
        .from('profile_functions')
        .delete()
        .eq('profile_id', profileId);
      
      if (deleteError) throw deleteError;
      
      // Insert new functions
      if (functions.length > 0) {
        const inserts = functions.map(fn => ({
          profile_id: profileId,
          function: fn,
        }));
        
        const { error: insertError } = await supabase
          .from('profile_functions')
          .insert(inserts);
        
        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile-functions'] });
      queryClient.invalidateQueries({ queryKey: ['all-profile-functions'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Funções atualizadas!');
    },
    onError: (error) => {
      console.error('Error updating profile functions:', error);
      toast.error('Erro ao atualizar funções');
    },
  });
}
