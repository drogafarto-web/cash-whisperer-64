import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Invoice, Payer, InvoiceOcrResult } from '@/types/billing';
import { useToast } from '@/hooks/use-toast';
import { convertPdfToImage, blobToBase64 } from '@/utils/pdfToImage';

// Hook para listar notas fiscais
export function useInvoices(filters?: {
  competenceYear?: number;
  competenceMonth?: number;
  payerId?: string;
  unitId?: string;
  status?: string;
}) {
  return useQuery({
    queryKey: ['invoices', filters],
    queryFn: async () => {
      let query = supabase
        .from('invoices')
        .select(`
          *,
          payer:payers(*),
          unit:units(*)
        `)
        .order('issue_date', { ascending: false });

      if (filters?.competenceYear) {
        query = query.eq('competence_year', filters.competenceYear);
      }
      if (filters?.competenceMonth) {
        query = query.eq('competence_month', filters.competenceMonth);
      }
      if (filters?.payerId) {
        query = query.eq('payer_id', filters.payerId);
      }
      if (filters?.unitId) {
        query = query.eq('unit_id', filters.unitId);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Invoice[];
    },
  });
}

// Hook para listar pagadores (convênios/prefeituras)
export function usePayers(activeOnly = true) {
  return useQuery({
    queryKey: ['payers', activeOnly],
    queryFn: async () => {
      let query = supabase
        .from('payers')
        .select('*')
        .order('name');

      if (activeOnly) {
        query = query.eq('active', true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Payer[];
    },
  });
}

// Hook para criar/atualizar nota fiscal
export function useInvoiceMutation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (invoice: Partial<Invoice> & { id?: string }) => {
      if (invoice.id) {
        // Update
        const { data, error } = await supabase
          .from('invoices')
          .update(invoice as any)
          .eq('id', invoice.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        // Insert
        const { data, error } = await supabase
          .from('invoices')
          .insert(invoice as any)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast({
        title: 'Nota fiscal salva',
        description: 'A nota fiscal foi registrada com sucesso.',
      });
    },
    onError: (error) => {
      console.error('Error saving invoice:', error);
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar a nota fiscal.',
        variant: 'destructive',
      });
    },
  });
}

// Hook para criar/atualizar pagador
export function usePayerMutation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (payer: Partial<Payer> & { id?: string }) => {
      if (payer.id) {
        const { data, error } = await supabase
          .from('payers')
          .update(payer as any)
          .eq('id', payer.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('payers')
          .insert(payer as any)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payers'] });
      toast({
        title: 'Convênio salvo',
        description: 'O convênio foi registrado com sucesso.',
      });
    },
    onError: (error) => {
      console.error('Error saving payer:', error);
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar o convênio.',
        variant: 'destructive',
      });
    },
  });
}

// Hook para OCR de nota fiscal
export function useInvoiceOcr() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (file: File): Promise<InvoiceOcrResult> => {
      let base64: string;
      let mimeType: string;

      // Se for PDF, converter para imagem PNG (OpenAI não aceita PDF diretamente)
      if (file.type === 'application/pdf') {
        console.log('Converting PDF to PNG for OCR...');
        const pngBlob = await convertPdfToImage(file, 2); // scale 2 for high quality
        base64 = await blobToBase64(pngBlob);
        mimeType = 'image/png';
        console.log('PDF converted to PNG successfully');
      } else {
        // Já é imagem, usar diretamente
        base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            const base64Data = result.split(',')[1];
            resolve(base64Data);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        mimeType = file.type;
      }

      const { data, error } = await supabase.functions.invoke('ocr-invoice', {
        body: { pdfBase64: base64, mimeType },
      });

      if (error) throw error;
      return data as InvoiceOcrResult;
    },
    onError: (error) => {
      console.error('OCR error:', error);
      toast({
        title: 'Erro no OCR',
        description: 'Não foi possível processar o arquivo. Preencha os dados manualmente.',
        variant: 'destructive',
      });
    },
  });
}

// Hook para resumo de faturamento
export function useBillingSummary(year: number, month: number, unitId?: string) {
  return useQuery({
    queryKey: ['billing-summary', year, month, unitId],
    queryFn: async () => {
      // Buscar total de notas fiscais
      let invoicesQuery = supabase
        .from('invoices')
        .select('net_value, customer_name, payer_id')
        .eq('competence_year', year)
        .eq('competence_month', month)
        .neq('status', 'CANCELADA');

      if (unitId) {
        invoicesQuery = invoicesQuery.eq('unit_id', unitId);
      }

      const { data: invoices, error: invoicesError } = await invoicesQuery;
      if (invoicesError) throw invoicesError;

      // Buscar total de caixa (transações do LIS)
      let transactionsQuery = supabase
        .from('transactions')
        .select('amount, payment_method')
        .eq('type', 'ENTRADA')
        .eq('status', 'APROVADO')
        .eq('competencia_ano', year)
        .eq('competencia_mes', month)
        .not('lis_protocol_id', 'is', null);

      if (unitId) {
        transactionsQuery = transactionsQuery.eq('unit_id', unitId);
      }

      const { data: transactions, error: transactionsError } = await transactionsQuery;
      if (transactionsError) throw transactionsError;

      // Calcular totais
      const caixaByMethod = {
        dinheiro: 0,
        pix: 0,
        cartao: 0,
      };

      let caixaTotal = 0;
      (transactions || []).forEach((t) => {
        caixaTotal += Number(t.amount);
        if (t.payment_method === 'DINHEIRO') caixaByMethod.dinheiro += Number(t.amount);
        else if (t.payment_method === 'PIX') caixaByMethod.pix += Number(t.amount);
        else if (t.payment_method === 'CARTAO') caixaByMethod.cartao += Number(t.amount);
      });

      const invoicesByPayerMap = new Map<string, number>();
      let invoicesTotal = 0;
      (invoices || []).forEach((inv) => {
        invoicesTotal += Number(inv.net_value);
        const payerName = inv.customer_name || 'Sem identificação';
        invoicesByPayerMap.set(
          payerName,
          (invoicesByPayerMap.get(payerName) || 0) + Number(inv.net_value)
        );
      });

      const invoicesByPayer = Array.from(invoicesByPayerMap.entries())
        .map(([payerName, total]) => ({ payerName, total }))
        .sort((a, b) => b.total - a.total);

      return {
        month,
        year,
        caixaTotal,
        invoicesTotal,
        grandTotal: caixaTotal + invoicesTotal,
        caixaByMethod,
        invoicesByPayer,
      };
    },
  });
}
