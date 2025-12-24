import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import {
  fetchSupplierInvoices,
  fetchSupplierInvoiceById,
  createSupplierInvoice,
  updateSupplierInvoice,
  deleteSupplierInvoice,
  updateSupplierInvoiceStatus,
} from '../api/supplier-invoices.api';
import { SupplierInvoiceFormData } from '@/types/payables';

const QUERY_KEY = 'supplier-invoices';

export function useSupplierInvoices(unitId?: string) {
  return useQuery({
    queryKey: [QUERY_KEY, unitId],
    queryFn: () => fetchSupplierInvoices(unitId),
  });
}

export function useSupplierInvoice(id: string) {
  return useQuery({
    queryKey: [QUERY_KEY, id],
    queryFn: () => fetchSupplierInvoiceById(id),
    enabled: !!id,
  });
}

export function useCreateSupplierInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      data,
      filePath,
      fileName,
      ocrConfidence,
    }: {
      data: SupplierInvoiceFormData;
      filePath?: string;
      fileName?: string;
      ocrConfidence?: number;
    }) => createSupplierInvoice(data, filePath, fileName, ocrConfidence),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast({
        title: 'Nota fiscal cadastrada',
        description: 'A nota fiscal foi salva com sucesso.',
      });
    },
    onError: (error: any) => {
      let description = error.message;

      if (error?.code === '23505') {
        description = 'Esta nota fiscal já foi cadastrada anteriormente (mesmo número/fornecedor/data).';
      }

      toast({
        variant: 'destructive',
        title: 'Erro ao cadastrar nota fiscal',
        description,
      });
    },
  });
}

export function useUpdateSupplierInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<SupplierInvoiceFormData> }) =>
      updateSupplierInvoice(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast({
        title: 'Nota fiscal atualizada',
        description: 'As alterações foram salvas.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar nota fiscal',
        description: error.message,
      });
    },
  });
}

export function useDeleteSupplierInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteSupplierInvoice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast({
        title: 'Nota fiscal excluída',
        description: 'A nota fiscal foi removida.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir nota fiscal',
        description: error.message,
      });
    },
  });
}

export function useUpdateSupplierInvoiceStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      updateSupplierInvoiceStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar status',
        description: error.message,
      });
    },
  });
}
