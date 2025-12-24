import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import {
  fetchPayables,
  fetchPayableById,
  createPayable,
  createPayablesFromParcelas,
  updatePayable,
  deletePayable,
  markPayableAsPaid,
  reconcilePayableWithBankItem,
  fetchPendingPayablesForReconciliation,
} from '../api/payables.api';
import { PayableFormData, PayableStatus, Parcela } from '@/types/payables';

const QUERY_KEY = 'payables';

export function usePayables(filters?: {
  unitId?: string;
  status?: PayableStatus | PayableStatus[];
  supplierInvoiceId?: string;
  startDate?: string;
  endDate?: string;
}) {
  return useQuery({
    queryKey: [QUERY_KEY, filters],
    queryFn: () => fetchPayables(filters),
  });
}

export function usePayable(id: string) {
  return useQuery({
    queryKey: [QUERY_KEY, id],
    queryFn: () => fetchPayableById(id),
    enabled: !!id,
  });
}

export function usePendingPayablesForReconciliation(unitId?: string) {
  return useQuery({
    queryKey: [QUERY_KEY, 'pending-reconciliation', unitId],
    queryFn: () => fetchPendingPayablesForReconciliation(unitId),
  });
}

export function useCreatePayable() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      data,
      filePath,
      fileName,
      ocrConfidence,
    }: {
      data: PayableFormData;
      filePath?: string;
      fileName?: string;
      ocrConfidence?: number;
    }) => createPayable(data, filePath, fileName, ocrConfidence),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast({
        title: 'Boleto cadastrado',
        description: 'O boleto foi salvo com sucesso.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao cadastrar boleto',
        description: error.message,
      });
    },
  });
}

export function useCreatePayablesFromParcelas() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      parcelas,
      supplierInvoice,
    }: {
      parcelas: Parcela[];
      supplierInvoice: {
        id: string;
        supplier_name: string;
        supplier_cnpj?: string | null;
        unit_id?: string | null;
        category_id?: string | null;
      };
    }) => createPayablesFromParcelas(parcelas, supplierInvoice),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast({
        title: 'Parcelas criadas',
        description: `${data.length} parcela(s) criada(s) com sucesso.`,
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao criar parcelas',
        description: error.message,
      });
    },
  });
}

export function useUpdatePayable() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<PayableFormData> }) =>
      updatePayable(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast({
        title: 'Boleto atualizado',
        description: 'As alterações foram salvas.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar boleto',
        description: error.message,
      });
    },
  });
}

export function useDeletePayable() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deletePayable,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast({
        title: 'Boleto excluído',
        description: 'O boleto foi removido.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir boleto',
        description: error.message,
      });
    },
  });
}

export function useMarkPayableAsPaid() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      paidAmount,
      paidMethod,
      transactionId,
    }: {
      id: string;
      paidAmount: number;
      paidMethod: string;
      transactionId?: string;
    }) => markPayableAsPaid(id, paidAmount, paidMethod, transactionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast({
        title: 'Pagamento registrado',
        description: 'O boleto foi marcado como pago.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao registrar pagamento',
        description: error.message,
      });
    },
  });
}

export function useReconcilePayable() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      payableId,
      bankItemId,
      paidAmount,
    }: {
      payableId: string;
      bankItemId: string;
      paidAmount: number;
    }) => reconcilePayableWithBankItem(payableId, bankItemId, paidAmount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast({
        title: 'Conciliação realizada',
        description: 'O boleto foi vinculado ao extrato.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Erro na conciliação',
        description: error.message,
      });
    },
  });
}
