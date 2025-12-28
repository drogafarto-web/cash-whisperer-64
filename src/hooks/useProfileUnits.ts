import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ProfileUnit {
  id: string;
  profile_id: string;
  unit_id: string;
  is_primary: boolean;
  created_at: string;
}

export function useProfileUnits(profileId?: string) {
  return useQuery({
    queryKey: ['profile-units', profileId],
    queryFn: async () => {
      if (!profileId) return [];
      const { data, error } = await supabase
        .from('profile_units')
        .select('*')
        .eq('profile_id', profileId);
      
      if (error) throw error;
      return data as ProfileUnit[];
    },
    enabled: !!profileId,
    staleTime: 1000 * 60 * 5, // 5 minutos
  });
}

export function useAllProfileUnits() {
  return useQuery({
    queryKey: ['all-profile-units'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profile_units')
        .select('*');
      
      if (error) throw error;
      return data as ProfileUnit[];
    },
    staleTime: 1000 * 60 * 5, // 5 minutos
  });
}

export function useUpdateProfileUnits() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      profileId, 
      unitIds, 
      primaryUnitId 
    }: { 
      profileId: string; 
      unitIds: string[]; 
      primaryUnitId?: string;
    }) => {
      // Delete existing units for this profile
      const { error: deleteError } = await supabase
        .from('profile_units')
        .delete()
        .eq('profile_id', profileId);
      
      if (deleteError) throw deleteError;
      
      // Insert new units
      if (unitIds.length > 0) {
        const inserts = unitIds.map(unitId => ({
          profile_id: profileId,
          unit_id: unitId,
          is_primary: unitId === primaryUnitId,
        }));
        
        const { error: insertError } = await supabase
          .from('profile_units')
          .insert(inserts);
        
        if (insertError) throw insertError;
      }
      
      // Also update the legacy unit_id field on profiles for backwards compatibility
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ unit_id: primaryUnitId || null })
        .eq('id', profileId);
      
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile-units'] });
      queryClient.invalidateQueries({ queryKey: ['all-profile-units'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Unidades atualizadas!');
    },
    onError: (error) => {
      console.error('Error updating profile units:', error);
      toast.error('Erro ao atualizar unidades');
    },
  });
}
