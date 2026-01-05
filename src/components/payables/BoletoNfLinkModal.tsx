import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { FileText, Link, Plus, Search, FileCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/formats';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface BoletoNfLinkModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payableId: string;
  beneficiario?: string;
  beneficiarioCnpj?: string;
  valor?: number;
  onCreateNewNf?: () => void;
}

export function BoletoNfLinkModal({
  open,
  onOpenChange,
  payableId,
  beneficiario,
  beneficiarioCnpj,
  valor,
  onCreateNewNf,
}: BoletoNfLinkModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const queryClient = useQueryClient();

  // Fetch available supplier invoices
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['supplier-invoices-for-link', searchTerm],
    queryFn: async () => {
      let query = supabase
        .from('supplier_invoices')
        .select('*')
        .in('status', ['pendente', 'aguardando_boleto'])
        .eq('payment_method', 'boleto')
        .order('created_at', { ascending: false });

      if (searchTerm) {
        query = query.or(`supplier_name.ilike.%${searchTerm}%,document_number.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query.limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  // Link mutation
  const linkMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      // Update the payable with the supplier_invoice_id
      const { error: payableError } = await supabase
        .from('payables')
        .update({
          supplier_invoice_id: invoiceId,
          nf_vinculacao_status: 'vinculado',
        })
        .eq('id', payableId);

      if (payableError) throw payableError;

      // Update invoice status if it was aguardando_boleto
      const { error: invoiceError } = await supabase
        .from('supplier_invoices')
        .update({ status: 'pendente' })
        .eq('id', invoiceId)
        .eq('status', 'aguardando_boleto');

      if (invoiceError) throw invoiceError;
    },
    onSuccess: () => {
      toast.success('Boleto vinculado à NF com sucesso');
      queryClient.invalidateQueries({ queryKey: ['payables'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['nfs-aguardando-boleto'] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error('Erro ao vincular boleto: ' + error.message);
    },
  });

  // Mark NF as in same document mutation
  const markNfInDocumentMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('payables')
        .update({
          nf_vinculacao_status: 'vinculado',
          nf_in_same_document: true,
        })
        .eq('id', payableId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('NF marcada como anexada ao documento');
      queryClient.invalidateQueries({ queryKey: ['payables'] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar: ' + error.message);
    },
  });

  // Helper to clean CNPJ for comparison
  const cleanCnpj = (cnpj: string | null | undefined) => cnpj?.replace(/\D/g, '') || '';

  // Calculate match score for sorting
  const getSortedInvoices = () => {
    return [...invoices].sort((a, b) => {
      let scoreA = 0;
      let scoreB = 0;

      // Highest priority: exact CNPJ match
      if (beneficiarioCnpj) {
        const cleanBenefCnpj = cleanCnpj(beneficiarioCnpj);
        if (cleanCnpj(a.supplier_cnpj) === cleanBenefCnpj) scoreA += 200;
        if (cleanCnpj(b.supplier_cnpj) === cleanBenefCnpj) scoreB += 200;
      }

      // Prioritize aguardando_boleto status
      if (a.status === 'aguardando_boleto') scoreA += 100;
      if (b.status === 'aguardando_boleto') scoreB += 100;

      // Check supplier name match
      if (beneficiario && a.supplier_name?.toLowerCase().includes(beneficiario.toLowerCase())) {
        scoreA += 50;
      }
      if (beneficiario && b.supplier_name?.toLowerCase().includes(beneficiario.toLowerCase())) {
        scoreB += 50;
      }

      // Check value match (within 5%)
      if (valor && a.total_value) {
        const diff = Math.abs(a.total_value - valor) / valor;
        if (diff < 0.05) scoreA += 30;
      }
      if (valor && b.total_value) {
        const diff = Math.abs(b.total_value - valor) / valor;
        if (diff < 0.05) scoreB += 30;
      }

      return scoreB - scoreA;
    });
  };

  // Check if invoice has matching CNPJ
  const hasCnpjMatch = (invoiceCnpj: string | null | undefined) => {
    if (!beneficiarioCnpj || !invoiceCnpj) return false;
    return cleanCnpj(invoiceCnpj) === cleanCnpj(beneficiarioCnpj);
  };

  const sortedInvoices = getSortedInvoices();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link className="h-5 w-5" />
            Vincular Boleto a NF
          </DialogTitle>
          <DialogDescription>
            Selecione a nota fiscal correspondente a este boleto.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por fornecedor ou número da NF..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Boleto info */}
          {(beneficiario || valor) && (
            <div className="p-3 rounded-lg bg-muted/50 border">
              <Label className="text-xs text-muted-foreground">Dados do boleto</Label>
              <div className="text-sm font-medium">
                {beneficiario && <span>{beneficiario}</span>}
                {beneficiario && valor && <span> • </span>}
                {valor && <span>{formatCurrency(valor)}</span>}
              </div>
            </div>
          )}

          <Separator />

          {/* Invoice list */}
          <ScrollArea className="h-[300px]">
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-muted rounded animate-pulse" />
                ))}
              </div>
            ) : sortedInvoices.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Nenhuma NF encontrada</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sortedInvoices.map((invoice) => (
                  <button
                    key={invoice.id}
                    className="w-full p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors text-left flex items-start justify-between gap-2"
                    onClick={() => linkMutation.mutate(invoice.id)}
                    disabled={linkMutation.isPending}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">
                          {invoice.supplier_name}
                        </span>
                        {hasCnpjMatch(invoice.supplier_cnpj) && (
                          <Badge className="bg-green-500 text-xs">CNPJ Compatível</Badge>
                        )}
                        {invoice.status === 'aguardando_boleto' && (
                          <Badge className="bg-amber-500 text-xs">Aguardando Boleto</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        NF {invoice.document_number} • {formatCurrency(invoice.total_value)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Emissão: {format(new Date(invoice.issue_date), 'dd/MM/yyyy', { locale: ptBR })}
                      </div>
                    </div>
                    <Link className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        <Separator />

        {/* Option to mark NF as in same document */}
        <div className="p-3 rounded-lg border bg-muted/30 space-y-2">
          <p className="text-sm font-medium">O documento já contém a NF?</p>
          <p className="text-xs text-muted-foreground">
            Se o PDF do boleto já inclui a Nota Fiscal (ex: NFS-e), marque aqui.
          </p>
          <Button
            variant="secondary"
            onClick={() => markNfInDocumentMutation.mutate()}
            disabled={markNfInDocumentMutation.isPending}
            className="w-full"
          >
            <FileCheck className="h-4 w-4 mr-2" />
            A NF já está anexada ao documento
          </Button>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {onCreateNewNf && (
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                onCreateNewNf();
              }}
              className="w-full sm:w-auto"
            >
              <Plus className="h-4 w-4 mr-2" />
              Criar Nova NF
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
