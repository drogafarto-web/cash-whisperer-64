import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

// Types for seed data
export interface SeedPayroll {
  id?: string;
  ano: number;
  mes: number;
  salarios: number;
  prolabore: number;
  inss_patronal: number;
  fgts: number;
  decimo_terceiro: number;
  ferias: number;
  observacoes?: string;
}

export interface SeedTaxes {
  id?: string;
  ano: number;
  mes: number;
  das: number;
  iss_proprio: number;
  iss_retido: number;
  irrf_retido: number;
  outros: number;
  observacoes?: string;
}

export interface SeedRevenue {
  id?: string;
  ano: number;
  mes: number;
  receita_servicos: number;
  receita_outras: number;
  fonte_principal?: string;
  observacoes?: string;
}

export interface SeedBankStatement {
  id?: string;
  ano: number;
  mes: number;
  account_id: string;
  file_name: string;
  file_type: 'csv' | 'pdf' | 'outro';
  storage_path: string;
  imported: boolean;
  imported_at?: string;
}

// Período de dados: Nov/2024 a Dez/2025 (14 meses - início da prestação de contas)
export interface SeedPeriod {
  ano: number;
  mes: number;
  label: string;
}

export const SEED_PERIODS: SeedPeriod[] = [
  { ano: 2024, mes: 11, label: 'Nov/2024' },
  { ano: 2024, mes: 12, label: 'Dez/2024' },
  { ano: 2025, mes: 1, label: 'Jan/2025' },
  { ano: 2025, mes: 2, label: 'Fev/2025' },
  { ano: 2025, mes: 3, label: 'Mar/2025' },
  { ano: 2025, mes: 4, label: 'Abr/2025' },
  { ano: 2025, mes: 5, label: 'Mai/2025' },
  { ano: 2025, mes: 6, label: 'Jun/2025' },
  { ano: 2025, mes: 7, label: 'Jul/2025' },
  { ano: 2025, mes: 8, label: 'Ago/2025' },
  { ano: 2025, mes: 9, label: 'Set/2025' },
  { ano: 2025, mes: 10, label: 'Out/2025' },
  { ano: 2025, mes: 11, label: 'Nov/2025' },
  { ano: 2025, mes: 12, label: 'Dez/2025' },
];

export const TOTAL_SEED_MONTHS = SEED_PERIODS.length; // 14 meses

// Helper para verificar se um período está no range válido
const isValidPeriod = (ano: number, mes: number): boolean => {
  if (ano === 2024) return mes >= 11;
  if (ano === 2025) return mes >= 1 && mes <= 12;
  return false;
};

// Hook para buscar dados de folha (Nov/2024 - Dez/2025)
export function useSeedPayroll() {
  return useQuery({
    queryKey: ['seed-payroll', 'historical'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('seed_payroll')
        .select('*')
        .or('ano.eq.2024,ano.eq.2025')
        .order('ano')
        .order('mes');
      
      if (error) throw error;
      
      // Filtrar apenas os meses válidos (Nov-Dez 2024 + Jan-Dez 2025)
      const filtered = (data as SeedPayroll[]).filter(p => isValidPeriod(p.ano, p.mes));
      return filtered;
    },
  });
}

// Hook para salvar/atualizar folha
export function useSaveSeedPayroll() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (payrollData: SeedPayroll[]) => {
      const dataWithUser = payrollData.map(item => ({
        ...item,
        created_by: item.id ? undefined : user?.id,
        updated_by: user?.id,
      }));

      const { error } = await supabase
        .from('seed_payroll')
        .upsert(dataWithUser, { onConflict: 'ano,mes' });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seed-payroll'] });
      toast.success('Dados de folha salvos com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao salvar folha: ${error.message}`);
    },
  });
}

// Hook para buscar dados de impostos (Nov/2024 - Dez/2025)
export function useSeedTaxes() {
  return useQuery({
    queryKey: ['seed-taxes', 'historical'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('seed_taxes')
        .select('*')
        .or('ano.eq.2024,ano.eq.2025')
        .order('ano')
        .order('mes');
      
      if (error) throw error;
      
      const filtered = (data as SeedTaxes[]).filter(t => isValidPeriod(t.ano, t.mes));
      return filtered;
    },
  });
}

// Hook para salvar/atualizar impostos
export function useSaveSeedTaxes() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (taxesData: SeedTaxes[]) => {
      const dataWithUser = taxesData.map(item => ({
        ...item,
        created_by: item.id ? undefined : user?.id,
        updated_by: user?.id,
      }));

      const { error } = await supabase
        .from('seed_taxes')
        .upsert(dataWithUser, { onConflict: 'ano,mes' });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seed-taxes'] });
      toast.success('Dados de impostos salvos com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao salvar impostos: ${error.message}`);
    },
  });
}

// Hook para buscar dados de receita (Nov/2024 - Dez/2025)
export function useSeedRevenue() {
  return useQuery({
    queryKey: ['seed-revenue', 'historical'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('seed_revenue')
        .select('*')
        .or('ano.eq.2024,ano.eq.2025')
        .order('ano')
        .order('mes');
      
      if (error) throw error;
      
      const filtered = (data as SeedRevenue[]).filter(r => isValidPeriod(r.ano, r.mes));
      return filtered;
    },
  });
}

// Hook para salvar/atualizar receita
export function useSaveSeedRevenue() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (revenueData: SeedRevenue[]) => {
      const dataWithUser = revenueData.map(item => ({
        ...item,
        created_by: item.id ? undefined : user?.id,
        updated_by: user?.id,
      }));

      const { error } = await supabase
        .from('seed_revenue')
        .upsert(dataWithUser, { onConflict: 'ano,mes' });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seed-revenue'] });
      toast.success('Dados de receita salvos com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao salvar receita: ${error.message}`);
    },
  });
}

// Hook para buscar extratos (Nov/2024 - Dez/2025)
export function useSeedBankStatements(accountId?: string) {
  return useQuery({
    queryKey: ['seed-bank-statements', 'historical', accountId],
    queryFn: async () => {
      let query = supabase
        .from('seed_bank_statements')
        .select('*')
        .or('ano.eq.2024,ano.eq.2025')
        .order('ano')
        .order('mes');

      if (accountId) {
        query = query.eq('account_id', accountId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      const filtered = (data as SeedBankStatement[]).filter(s => isValidPeriod(s.ano, s.mes));
      return filtered;
    },
    enabled: !!accountId,
  });
}

// Hook para upload de extrato
export function useUploadSeedStatement() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ 
      file, 
      accountId, 
      ano,
      mes 
    }: { 
      file: File; 
      accountId: string; 
      ano: number;
      mes: number;
    }) => {
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'outro';
      const fileType = ['csv', 'pdf'].includes(fileExt) ? fileExt as 'csv' | 'pdf' : 'outro';
      const storagePath = `${ano}/extratos/${accountId}/${mes}/${file.name}`;

      // Upload para storage
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(storagePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Registrar metadados
      const { error: insertError } = await supabase
        .from('seed_bank_statements')
        .upsert({
          ano,
          mes,
          account_id: accountId,
          file_name: file.name,
          file_type: fileType,
          storage_path: storagePath,
          imported: false,
          created_by: user?.id,
        }, { onConflict: 'ano,mes,account_id,file_name' });

      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seed-bank-statements'] });
      toast.success('Extrato enviado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao enviar extrato: ${error.message}`);
    },
  });
}

// Hook para calcular progresso geral (14 meses)
export function useSeedProgress() {
  const { data: payroll } = useSeedPayroll();
  const { data: taxes } = useSeedTaxes();
  const { data: revenue } = useSeedRevenue();

  const payrollMonths = payroll?.filter(p => 
    p.salarios > 0 || p.prolabore > 0 || p.inss_patronal > 0
  ).length || 0;

  const taxesMonths = taxes?.filter(t => 
    t.das > 0 || t.iss_proprio > 0 || t.iss_retido > 0 || t.irrf_retido > 0
  ).length || 0;

  const revenueMonths = revenue?.filter(r => 
    r.receita_servicos > 0 || r.receita_outras > 0
  ).length || 0;

  // Total: 14 meses × 3 categorias = 42 itens
  const totalProgress = Math.round(
    ((payrollMonths + taxesMonths + revenueMonths) / (TOTAL_SEED_MONTHS * 3)) * 100
  );

  return {
    payrollMonths,
    taxesMonths,
    revenueMonths,
    totalProgress,
    payrollComplete: payrollMonths === TOTAL_SEED_MONTHS,
    taxesComplete: taxesMonths === TOTAL_SEED_MONTHS,
    revenueComplete: revenueMonths === TOTAL_SEED_MONTHS,
    totalMonths: TOTAL_SEED_MONTHS,
  };
}
