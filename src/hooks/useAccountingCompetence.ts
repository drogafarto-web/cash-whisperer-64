import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface CompetenceData {
  id?: string;
  unit_id: string;
  ano: number;
  mes: number;
  // Folha
  total_folha: number;
  encargos: number;
  prolabore: number;
  num_funcionarios: number;
  // Impostos
  das_valor: number;
  das_vencimento: string | null;
  darf_valor: number;
  darf_vencimento: string | null;
  gps_valor: number;
  gps_vencimento: string | null;
  inss_valor: number;
  inss_vencimento: string | null;
  fgts_valor: number;
  fgts_vencimento: string | null;
  iss_valor: number;
  iss_vencimento: string | null;
  // Receitas
  receita_servicos: number;
  receita_outras: number;
  receita_observacoes: string | null;
  // Metadata
  status: 'pendente' | 'informado' | 'confirmado';
  informado_em: string | null;
}

export interface LabSubmission {
  id?: string;
  unit_id: string;
  ano: number;
  mes: number;
  status: 'rascunho' | 'enviado' | 'recebido';
  enviado_em: string | null;
  receita_servicos_lab: number;
  receita_outras_lab: number;
  observacoes: string | null;
}

export interface LabDocument {
  id?: string;
  submission_id: string;
  unit_id: string;
  ano: number;
  mes: number;
  tipo: 'nf' | 'despesa' | 'extrato_bancario' | 'outro';
  file_name: string;
  file_path: string;
  file_size?: number;
  mime_type?: string;
  valor?: number;
  descricao?: string;
}

// Fetch competence data (from accounting)
export function useCompetenceData(unitId: string | null, ano: number, mes: number) {
  return useQuery({
    queryKey: ['accounting-competence-data', unitId, ano, mes],
    queryFn: async () => {
      if (!unitId) return null;
      
      const { data, error } = await supabase
        .from('accounting_competence_data')
        .select('*')
        .eq('unit_id', unitId)
        .eq('ano', ano)
        .eq('mes', mes)
        .maybeSingle();
      
      if (error) throw error;
      return data as CompetenceData | null;
    },
    enabled: !!unitId && ano >= 2026,
  });
}

// Fetch lab submission
export function useLabSubmission(unitId: string | null, ano: number, mes: number) {
  return useQuery({
    queryKey: ['accounting-lab-submission', unitId, ano, mes],
    queryFn: async () => {
      if (!unitId) return null;
      
      const { data, error } = await supabase
        .from('accounting_lab_submissions')
        .select('*')
        .eq('unit_id', unitId)
        .eq('ano', ano)
        .eq('mes', mes)
        .maybeSingle();
      
      if (error) throw error;
      return data as LabSubmission | null;
    },
    enabled: !!unitId && ano >= 2026,
  });
}

// Fetch lab documents
export function useLabDocuments(submissionId: string | null) {
  return useQuery({
    queryKey: ['accounting-lab-documents', submissionId],
    queryFn: async () => {
      if (!submissionId) return [];
      
      const { data, error } = await supabase
        .from('accounting_lab_documents')
        .select('*')
        .eq('submission_id', submissionId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as LabDocument[];
    },
    enabled: !!submissionId,
  });
}

// Create or update lab submission
export function useLabSubmissionMutation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (data: Partial<LabSubmission> & { unit_id: string; ano: number; mes: number }) => {
      // Check if exists
      const { data: existing } = await supabase
        .from('accounting_lab_submissions')
        .select('id')
        .eq('unit_id', data.unit_id)
        .eq('ano', data.ano)
        .eq('mes', data.mes)
        .maybeSingle();
      
      if (existing) {
        const { data: updated, error } = await supabase
          .from('accounting_lab_submissions')
          .update(data)
          .eq('id', existing.id)
          .select()
          .single();
        
        if (error) throw error;
        return updated;
      } else {
        const { data: created, error } = await supabase
          .from('accounting_lab_submissions')
          .insert(data)
          .select()
          .single();
        
        if (error) throw error;
        return created;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ['accounting-lab-submission', variables.unit_id, variables.ano, variables.mes] 
      });
    },
  });
}

// Upload lab document
export function useUploadLabDocument() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async ({ 
      file, 
      submission_id,
      unit_id,
      ano,
      mes,
      tipo,
      valor,
      descricao,
    }: { 
      file: File;
      submission_id: string;
      unit_id: string;
      ano: number;
      mes: number;
      tipo: 'nf' | 'despesa' | 'extrato_bancario' | 'outro';
      valor?: number;
      descricao?: string;
    }) => {
      // Upload file
      const filePath = `${unit_id}/${ano}/${mes}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('accounting-documents')
        .upload(filePath, file);
      
      if (uploadError) throw uploadError;
      
      // Create document record
      const { data, error } = await supabase
        .from('accounting_lab_documents')
        .insert({
          submission_id,
          unit_id,
          ano,
          mes,
          tipo,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          mime_type: file.type,
          valor,
          descricao,
          created_by: user?.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ['accounting-lab-documents', variables.submission_id] 
      });
      toast.success('Documento enviado com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao enviar documento: ' + error.message);
    },
  });
}

// Delete lab document
export function useDeleteLabDocument() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, file_path, submission_id }: { id: string; file_path: string; submission_id: string }) => {
      // Delete from storage
      await supabase.storage
        .from('accounting-documents')
        .remove([file_path]);
      
      // Delete record
      const { error } = await supabase
        .from('accounting_lab_documents')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return { submission_id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ 
        queryKey: ['accounting-lab-documents', data.submission_id] 
      });
      toast.success('Documento removido');
    },
  });
}

// Submit to accounting
export function useSubmitToAccounting() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async ({ submission_id, unit_id, ano, mes }: { submission_id: string; unit_id: string; ano: number; mes: number }) => {
      const { data, error } = await supabase
        .from('accounting_lab_submissions')
        .update({
          status: 'enviado',
          enviado_em: new Date().toISOString(),
          enviado_por: user?.id,
        })
        .eq('id', submission_id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ['accounting-lab-submission', variables.unit_id, variables.ano, variables.mes] 
      });
      toast.success('Documentos enviados para a contabilidade!');
    },
  });
}
