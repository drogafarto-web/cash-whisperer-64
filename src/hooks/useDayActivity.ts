import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface DayActivityItem {
  id: string;
  tipo: string | null;
  beneficiario: string | null;
  description: string | null;
  valor: number | null;
  status: string | null;
  created_at: string;
}

interface DayActivityResult {
  items: DayActivityItem[];
  total: number;
  count: number;
}

export function useDayActivity(
  unitId: string | null, 
  role: 'atendimento' | 'contabilidade'
) {
  const today = new Date().toISOString().split('T')[0];
  
  return useQuery<DayActivityResult>({
    queryKey: ['day-activity', unitId, role, today],
    queryFn: async () => {
      if (!unitId) return { items: [], total: 0, count: 0 };
      
      const startOfDay = `${today}T00:00:00`;
      const endOfDay = `${today}T23:59:59`;
      
      // Query base para payables do dia
      let query = supabase
        .from('payables')
        .select('id, tipo, beneficiario, description, valor, status, created_at')
        .eq('unit_id', unitId)
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay)
        .order('created_at', { ascending: false })
        .limit(5);
      
      // Filtro adicional por role
      if (role === 'contabilidade') {
        // Documentos fiscais: impostos, guias, notas
        query = query.in('tipo', ['das', 'darf', 'gps', 'inss', 'fgts', 'iss', 'boleto', 'nf_fornecedor', 'recibo']);
      }
      // Para atendimento, pega todos os tipos
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Erro ao buscar atividades do dia:', error);
        return { items: [], total: 0, count: 0 };
      }
      
      const items = (data || []) as DayActivityItem[];
      const total = items.reduce((sum, d) => sum + (d.valor || 0), 0);
      
      return {
        items,
        total,
        count: items.length,
      };
    },
    staleTime: 30000, // Atualiza a cada 30 segundos
    enabled: !!unitId,
  });
}
