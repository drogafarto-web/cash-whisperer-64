import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format, startOfDay, endOfDay } from 'date-fns';

export interface EnvelopeConferenciaFilters {
  unitId?: string;
  status?: 'PENDENTE' | 'EMITIDO' | 'all';
  startDate?: Date;
  endDate?: Date;
  onlyWithDifference?: boolean;
}

export interface EnvelopeForConferencia {
  id: string;
  created_at: string;
  unit_id: string | null;
  unit_name: string;
  unit_code: string;
  expected_cash: number | null;
  counted_cash: number | null;
  difference: number | null;
  status: string;
  lis_codes_count: number | null;
  lis_codes: string[];
  justificativa: string | null;
  created_by: string | null;
  created_by_name: string | null;
}

export interface EnvelopeStats {
  totalPendentes: number;
  totalComDiferenca: number;
  totalConferidosHoje: number;
  valorPendente: number;
  diferencaTotal: number;
}

export function useEnvelopeConferencia(filters: EnvelopeConferenciaFilters = {}) {
  const { isAdmin, unit } = useAuth();
  const queryClient = useQueryClient();

  // Query para buscar envelopes pendentes
  const envelopesQuery = useQuery({
    queryKey: ['envelopes-conferencia', filters, isAdmin, unit?.id],
    queryFn: async (): Promise<EnvelopeForConferencia[]> => {
      let query = supabase
        .from('cash_envelopes')
        .select(`
          id,
          created_at,
          unit_id,
          expected_cash,
          counted_cash,
          difference,
          status,
          lis_codes_count,
          lis_codes,
          justificativa,
          created_by,
          units!inner(name, code)
        `)
        .order('created_at', { ascending: false });

      // Filtro por status - SEMPRE excluir CONFERIDO
      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      } else {
        // Mostrar apenas pendentes e emitidos (nunca conferidos)
        query = query.in('status', ['PENDENTE', 'EMITIDO']);
      }

      // Filtro por unidade
      if (filters.unitId) {
        query = query.eq('unit_id', filters.unitId);
      } else if (!isAdmin && unit?.id) {
        query = query.eq('unit_id', unit.id);
      }

      // Filtro por período
      if (filters.startDate) {
        query = query.gte('created_at', startOfDay(filters.startDate).toISOString());
      }
      if (filters.endDate) {
        query = query.lte('created_at', endOfDay(filters.endDate).toISOString());
      }

      // Filtro apenas com diferença
      if (filters.onlyWithDifference) {
        query = query.neq('difference', 0);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Erro ao buscar envelopes:', error);
        throw error;
      }

      // Buscar nomes dos criadores
      const creatorIds = [...new Set((data || []).map(e => e.created_by).filter(Boolean))];
      let creatorsMap: Record<string, string> = {};

      if (creatorIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', creatorIds as string[]);
        
        if (profiles) {
          creatorsMap = profiles.reduce((acc, p) => {
            acc[p.id] = p.name || 'Usuário';
            return acc;
          }, {} as Record<string, string>);
        }
      }

      return (data || []).map((envelope: any) => ({
        id: envelope.id,
        created_at: envelope.created_at,
        unit_id: envelope.unit_id,
        unit_name: envelope.units?.name || 'Unidade',
        unit_code: envelope.units?.code || '??',
        expected_cash: envelope.expected_cash,
        counted_cash: envelope.counted_cash,
        difference: envelope.difference,
        status: envelope.status,
        lis_codes_count: envelope.lis_codes_count,
        lis_codes: envelope.lis_codes || [],
        justificativa: envelope.justificativa,
        created_by: envelope.created_by,
        created_by_name: envelope.created_by ? creatorsMap[envelope.created_by] || null : null,
      }));
    },
    staleTime: 1000 * 5, // 5 segundos para refresh mais rápido
  });

  // Query para estatísticas
  const statsQuery = useQuery({
    queryKey: ['envelopes-stats', isAdmin, unit?.id],
    queryFn: async (): Promise<EnvelopeStats> => {
      const today = format(new Date(), 'yyyy-MM-dd');
      
      // Query base
      let baseQuery = supabase.from('cash_envelopes').select('id, status, expected_cash, counted_cash, difference, conferido_at');
      if (!isAdmin && unit?.id) {
        baseQuery = baseQuery.eq('unit_id', unit.id);
      }

      // Buscar todos os dados necessários em uma query
      const { data: allEnvelopes, error } = await baseQuery;

      if (error) throw error;

      const envelopes = allEnvelopes || [];

      // Calcular estatísticas
      const pendentes = envelopes.filter(e => e.status === 'PENDENTE' || e.status === 'EMITIDO');
      const comDiferenca = pendentes.filter(e => e.difference && e.difference !== 0);
      const conferidosHoje = envelopes.filter(
        e => e.status === 'CONFERIDO' && e.conferido_at?.startsWith(today)
      );

      const valorPendente = pendentes.reduce((sum, e) => sum + (e.expected_cash || 0), 0);
      const diferencaTotal = comDiferenca.reduce((sum, e) => sum + (e.difference || 0), 0);

      return {
        totalPendentes: pendentes.length,
        totalComDiferenca: comDiferenca.length,
        totalConferidosHoje: conferidosHoje.length,
        valorPendente,
        diferencaTotal,
      };
    },
    staleTime: 1000 * 5, // 5 segundos para refresh mais rápido
  });

  // Mutation para conferir envelope
  const conferirMutation = useMutation({
    mutationFn: async ({ envelopeId, observacao }: { envelopeId: string; observacao?: string }) => {
      const { data, error } = await supabase
        .from('cash_envelopes')
        .update({
          status: 'CONFERIDO',
          conferencia_checkbox: true,
          conferido_at: new Date().toISOString(),
        })
        .eq('id', envelopeId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // Invalidar e refetch imediato
      queryClient.invalidateQueries({ queryKey: ['envelopes-conferencia'] });
      queryClient.invalidateQueries({ queryKey: ['envelopes-stats'] });
      queryClient.invalidateQueries({ queryKey: ['badge-counts'] });
      queryClient.invalidateQueries({ queryKey: ['cash-envelopes'] });
      toast.success('Envelope conferido com sucesso!');
    },
    onError: (error: Error) => {
      console.error('Erro ao conferir envelope:', error);
      toast.error('Erro ao conferir envelope: ' + error.message);
    },
  });

  // Mutation para conferir múltiplos envelopes
  const conferirMultiplosMutation = useMutation({
    mutationFn: async (envelopeIds: string[]) => {
      const { data, error } = await supabase
        .from('cash_envelopes')
        .update({
          status: 'CONFERIDO',
          conferencia_checkbox: true,
          conferido_at: new Date().toISOString(),
        })
        .in('id', envelopeIds)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, envelopeIds) => {
      queryClient.invalidateQueries({ queryKey: ['envelopes-conferencia'] });
      queryClient.invalidateQueries({ queryKey: ['envelopes-stats'] });
      queryClient.invalidateQueries({ queryKey: ['badge-counts'] });
      queryClient.invalidateQueries({ queryKey: ['cash-envelopes'] });
      toast.success(`${envelopeIds.length} envelope(s) conferido(s) com sucesso!`);
    },
    onError: (error: Error) => {
      console.error('Erro ao conferir envelopes:', error);
      toast.error('Erro ao conferir envelopes: ' + error.message);
    },
  });

  return {
    envelopes: envelopesQuery.data || [],
    isLoading: envelopesQuery.isLoading,
    isError: envelopesQuery.isError,
    stats: statsQuery.data,
    isLoadingStats: statsQuery.isLoading,
    conferir: conferirMutation.mutate,
    conferirMultiplos: conferirMultiplosMutation.mutate,
    isConferindo: conferirMutation.isPending || conferirMultiplosMutation.isPending,
    refetch: async () => {
      // Invalidar cache antes de refetch para garantir dados frescos
      await queryClient.invalidateQueries({ queryKey: ['envelopes-conferencia'] });
      await queryClient.invalidateQueries({ queryKey: ['envelopes-stats'] });
      await queryClient.invalidateQueries({ queryKey: ['cash-envelopes'] });
      envelopesQuery.refetch();
      statsQuery.refetch();
    },
  };
}
