import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  fetchConvenioImportSessions, 
  fetchConvenioProductionReports,
  fetchAvailableProviders,
  saveConvenioImport,
  fetchExistingLisCodes,
  fetchSessionDetails,
} from '../api/convenioReports.api';
import { auditParticularVsCash } from '../api/particularAudit.api';
import { auditConvenioVsInvoice, fetchConvenioAuditOverview } from '../api/convenioAudit.api';
import { ConvenioImportResult } from '@/utils/convenioReportImport';
import { toast } from 'sonner';

export function useConvenioImportSessions(unitId?: string) {
  return useQuery({
    queryKey: ['convenio-import-sessions', unitId],
    queryFn: () => fetchConvenioImportSessions(unitId),
    staleTime: 1000 * 60 * 5,
  });
}

export function useConvenioProductionReports(filters: {
  unitId?: string;
  isParticular?: boolean;
  providerName?: string;
  startDate?: string;
  endDate?: string;
}) {
  return useQuery({
    queryKey: ['convenio-production-reports', filters],
    queryFn: () => fetchConvenioProductionReports(filters),
    staleTime: 1000 * 60 * 2,
    enabled: !!(filters.startDate && filters.endDate),
  });
}

export function useAvailableProviders(unitId?: string) {
  return useQuery({
    queryKey: ['available-providers', unitId],
    queryFn: () => fetchAvailableProviders(unitId),
    staleTime: 1000 * 60 * 10,
  });
}

export function useExistingLisCodes(unitId: string | null) {
  return useQuery({
    queryKey: ['existing-lis-codes', unitId],
    queryFn: () => fetchExistingLisCodes(unitId),
    staleTime: 1000 * 60 * 2,
  });
}

export function useSessionDetails(sessionId: string | null) {
  return useQuery({
    queryKey: ['session-details', sessionId],
    queryFn: () => fetchSessionDetails(sessionId!),
    enabled: !!sessionId,
    staleTime: 1000 * 60 * 5,
  });
}

export function useSaveConvenioImport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      importResult,
      unitId,
      userId,
      fileName,
    }: {
      importResult: ConvenioImportResult;
      unitId: string | null;
      userId: string;
      fileName: string;
    }) => {
      return saveConvenioImport(importResult, unitId, userId, fileName);
    },
    onSuccess: (data) => {
      toast.success(`Importação concluída: ${data.insertedCount} registros`);
      queryClient.invalidateQueries({ queryKey: ['convenio-import-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['convenio-production-reports'] });
      queryClient.invalidateQueries({ queryKey: ['available-providers'] });
    },
    onError: (error) => {
      toast.error(`Erro na importação: ${error.message}`);
    },
  });
}

export function useParticularAudit(
  unitId: string | null,
  startDate: string,
  endDate: string,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['particular-audit', unitId, startDate, endDate],
    queryFn: () => auditParticularVsCash(unitId, startDate, endDate),
    staleTime: 1000 * 60 * 2,
    enabled: enabled && !!startDate && !!endDate,
  });
}

export function useConvenioAudit(
  unitId: string | null,
  providerName: string,
  startDate: string,
  endDate: string,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['convenio-audit', unitId, providerName, startDate, endDate],
    queryFn: () => auditConvenioVsInvoice(unitId, providerName, startDate, endDate),
    staleTime: 1000 * 60 * 2,
    enabled: enabled && !!providerName && !!startDate && !!endDate,
  });
}

export function useConvenioAuditOverview(
  unitId: string | null,
  startDate: string,
  endDate: string,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['convenio-audit-overview', unitId, startDate, endDate],
    queryFn: () => fetchConvenioAuditOverview(unitId, startDate, endDate),
    staleTime: 1000 * 60 * 2,
    enabled: enabled && !!startDate && !!endDate,
  });
}
