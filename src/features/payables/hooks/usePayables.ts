import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
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
  updatePayableFile,
  createPayableAndMarkAsPaid,
  fetchPayablesWithPaymentData,
  markPayableAsPaidWithAccount,
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
    staleTime: 1000 * 60 * 2, // 2 minutos
  });
}

export function usePayable(id: string) {
  return useQuery({
    queryKey: [QUERY_KEY, id],
    queryFn: () => fetchPayableById(id),
    enabled: !!id,
    staleTime: 1000 * 60 * 5, // 5 minutos
  });
}

export function usePendingPayablesForReconciliation(unitId?: string) {
  return useQuery({
    queryKey: [QUERY_KEY, 'pending-reconciliation', unitId],
    queryFn: () => fetchPendingPayablesForReconciliation(unitId),
    staleTime: 1000 * 60 * 2, // 2 minutos
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
      nfVinculacaoStatus,
      nfExemptionReason,
    }: {
      data: PayableFormData;
      filePath?: string;
      fileName?: string;
      ocrConfidence?: number;
      nfVinculacaoStatus?: 'nao_requer' | 'pendente' | 'vinculado';
      nfExemptionReason?: string;
    }) => createPayable(data, filePath, fileName, ocrConfidence, nfVinculacaoStatus, nfExemptionReason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Boleto cadastrado', { description: 'O boleto foi salvo com sucesso.' });
    },
    onError: (error: any) => {
      let description = error.message;
      if (error?.code === '23505') {
        if (error?.message?.includes('codigo_barras')) {
          description = 'Este código de barras já foi cadastrado anteriormente.';
        } else if (error?.message?.includes('linha_digitavel')) {
          description = 'Esta linha digitável já foi cadastrada anteriormente.';
        } else {
          description = 'Este boleto já foi cadastrado anteriormente.';
        }
      }
      toast.error('Erro ao cadastrar boleto', { description });
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
      toast.success('Parcelas criadas', { description: `${data.length} parcela(s) criada(s) com sucesso.` });
    },
    onError: (error: any) => {
      let description = error.message;
      if (error?.code === '23505') {
        description = 'Uma ou mais parcelas já foram cadastradas anteriormente.';
      }
      toast.error('Erro ao criar parcelas', { description });
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
      toast.success('Boleto atualizado', { description: 'As alterações foram salvas.' });
    },
    onError: (error) => {
      toast.error('Erro ao atualizar boleto', { description: error.message });
    },
  });
}

export function useDeletePayable() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deletePayable,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Boleto excluído', { description: 'O boleto foi removido.' });
    },
    onError: (error) => {
      toast.error('Erro ao excluir boleto', { description: error.message });
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
      toast.success('Pagamento registrado', { description: 'O boleto foi marcado como pago.' });
    },
    onError: (error) => {
      toast.error('Erro ao registrar pagamento', { description: error.message });
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
      toast.success('Conciliação realizada', { description: 'O boleto foi vinculado ao extrato.' });
    },
    onError: (error) => {
      toast.error('Erro na conciliação', { description: error.message });
    },
  });
}

export function useUpdatePayableFile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      filePath,
      fileName,
    }: {
      id: string;
      filePath: string;
      fileName: string;
    }) => updatePayableFile(id, filePath, fileName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
    onError: (error) => {
      toast.error('Erro ao anexar comprovante', { description: error.message });
    },
  });
}

export function useCreatePayableAndMarkAsPaid() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      data,
      paidAmount,
      paidMethod,
      filePath,
      fileName,
    }: {
      data: {
        beneficiario: string;
        beneficiario_cnpj?: string;
        valor: number;
        vencimento: string;
        description?: string;
        tipo: 'boleto' | 'pix';
        linha_digitavel?: string;
        codigo_barras?: string;
        banco_codigo?: string;
        banco_nome?: string;
        unit_id?: string;
        category_id?: string;
      };
      paidAmount: number;
      paidMethod: string;
      filePath?: string;
      fileName?: string;
    }) => createPayableAndMarkAsPaid(data, paidAmount, paidMethod, filePath, fileName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Despesa criada e paga', { description: 'A despesa foi registrada como paga.' });
    },
    onError: (error: any) => {
      let description = error.message;
      if (error?.code === '23505') {
        description = 'Esta despesa já foi cadastrada anteriormente.';
      }
      toast.error('Erro ao registrar despesa', { description });
    },
  });
}

// Hook for fetching payables with payment data
export function usePayablesWithPaymentData(filters?: {
  unitId?: string;
  paymentAccountId?: string;
  periodDays?: number;
  showAll?: boolean;
}) {
  return useQuery({
    queryKey: [QUERY_KEY, 'with-payment-data', filters],
    queryFn: () => fetchPayablesWithPaymentData(filters),
    staleTime: 1000 * 60 * 2, // 2 minutos
  });
}

// Hook for marking payable as paid with account selection
export function useMarkPayableAsPaidWithAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      paidAmount,
      paidMethod,
      paidAt,
      paymentAccountId,
    }: {
      id: string;
      paidAmount: number;
      paidMethod: string;
      paidAt: string;
      paymentAccountId?: string;
    }) => markPayableAsPaidWithAccount(id, paidAmount, paidMethod, paidAt, paymentAccountId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Pagamento registrado', { description: 'O boleto foi marcado como pago.' });
    },
    onError: (error) => {
      toast.error('Erro ao registrar pagamento', { description: error.message });
    },
  });
}
