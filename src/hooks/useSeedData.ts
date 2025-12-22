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

const SEED_YEAR = 2025;

// Hook para buscar dados de folha 2025
export function useSeedPayroll() {
  return useQuery({
    queryKey: ['seed-payroll', SEED_YEAR],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('seed_payroll')
        .select('*')
        .eq('ano', SEED_YEAR)
        .order('mes');
      
      if (error) throw error;
      return data as SeedPayroll[];
    },
  });
}

// Hook para salvar/atualizar folha 2025
export function useSaveSeedPayroll() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (payrollData: SeedPayroll[]) => {
      const dataWithUser = payrollData.map(item => ({
        ...item,
        ano: SEED_YEAR,
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
      toast.success('Folha 2025 salva com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao salvar folha: ${error.message}`);
    },
  });
}

// Hook para buscar dados de impostos 2025
export function useSeedTaxes() {
  return useQuery({
    queryKey: ['seed-taxes', SEED_YEAR],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('seed_taxes')
        .select('*')
        .eq('ano', SEED_YEAR)
        .order('mes');
      
      if (error) throw error;
      return data as SeedTaxes[];
    },
  });
}

// Hook para salvar/atualizar impostos 2025
export function useSaveSeedTaxes() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (taxesData: SeedTaxes[]) => {
      const dataWithUser = taxesData.map(item => ({
        ...item,
        ano: SEED_YEAR,
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
      toast.success('Impostos 2025 salvos com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao salvar impostos: ${error.message}`);
    },
  });
}

// Hook para buscar dados de receita 2025
export function useSeedRevenue() {
  return useQuery({
    queryKey: ['seed-revenue', SEED_YEAR],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('seed_revenue')
        .select('*')
        .eq('ano', SEED_YEAR)
        .order('mes');
      
      if (error) throw error;
      return data as SeedRevenue[];
    },
  });
}

// Hook para salvar/atualizar receita 2025
export function useSaveSeedRevenue() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (revenueData: SeedRevenue[]) => {
      const dataWithUser = revenueData.map(item => ({
        ...item,
        ano: SEED_YEAR,
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
      toast.success('Receita 2025 salva com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao salvar receita: ${error.message}`);
    },
  });
}

// Hook para buscar extratos 2025
export function useSeedBankStatements(accountId?: string) {
  return useQuery({
    queryKey: ['seed-bank-statements', SEED_YEAR, accountId],
    queryFn: async () => {
      let query = supabase
        .from('seed_bank_statements')
        .select('*')
        .eq('ano', SEED_YEAR)
        .order('mes');

      if (accountId) {
        query = query.eq('account_id', accountId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as SeedBankStatement[];
    },
    enabled: !!accountId,
  });
}

// Hook para upload de extrato 2025
export function useUploadSeedStatement() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ 
      file, 
      accountId, 
      mes 
    }: { 
      file: File; 
      accountId: string; 
      mes: number;
    }) => {
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'outro';
      const fileType = ['csv', 'pdf'].includes(fileExt) ? fileExt as 'csv' | 'pdf' : 'outro';
      const storagePath = `2025/extratos/${accountId}/${mes}/${file.name}`;

      // Upload para storage
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(storagePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Registrar metadados
      const { error: insertError } = await supabase
        .from('seed_bank_statements')
        .upsert({
          ano: SEED_YEAR,
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

// Hook para calcular progresso geral
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

  const totalProgress = Math.round(
    ((payrollMonths + taxesMonths + revenueMonths) / 36) * 100
  );

  return {
    payrollMonths,
    taxesMonths,
    revenueMonths,
    totalProgress,
    payrollComplete: payrollMonths === 12,
    taxesComplete: taxesMonths === 12,
    revenueComplete: revenueMonths === 12,
  };
}
