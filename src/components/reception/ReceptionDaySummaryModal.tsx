import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  FileText,
  Wallet,
  ExternalLink,
  Clock,
  Banknote,
  CreditCard,
  QrCode,
  Building2,
  CheckCircle2,
  AlertCircle,
  Package,
} from 'lucide-react';
import { formatCurrency } from '@/lib/formats';

interface ReceptionDaySummaryModalProps {
  open: boolean;
  onClose: () => void;
  unitId: string;
  date: string; // YYYY-MM-DD
}

const TIPO_LABELS: Record<string, string> = {
  boleto: 'Boleto',
  recibo: 'Recibo',
  avulso: 'Avulso',
  conta_agua: 'Conta de Água',
  conta_luz: 'Conta de Luz',
  gasolina: 'Gasolina',
  nf: 'Nota Fiscal',
};

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  PENDENTE: { label: 'Pendente', variant: 'secondary' },
  AGENDADO: { label: 'Agendado', variant: 'outline' },
  PAGO: { label: 'Pago', variant: 'default' },
  CANCELADO: { label: 'Cancelado', variant: 'destructive' },
};

export function ReceptionDaySummaryModal({ open, onClose, unitId, date }: ReceptionDaySummaryModalProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState('documentos');

  const formattedDate = format(new Date(date + 'T12:00:00'), "d 'de' MMMM, EEEE", { locale: ptBR });

  // Query documentos (payables) processados pela recepção
  const { data: documents, isLoading: loadingDocs } = useQuery({
    queryKey: ['reception-day-documents', unitId, date],
    queryFn: async () => {
      const startOfDay = `${date}T00:00:00`;
      const endOfDay = `${date}T23:59:59`;

      const { data, error } = await supabase
        .from('payables')
        .select('id, tipo, beneficiario, description, valor, vencimento, status, created_at, paid_at')
        .eq('unit_id', unitId)
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay)
        .like('file_path', 'reception/%')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: open && !!unitId,
  });

  // Query envelopes do dia
  const { data: envelopes, isLoading: loadingEnvelopes } = useQuery({
    queryKey: ['reception-day-envelopes', unitId, date],
    queryFn: async () => {
      const startOfDay = `${date}T00:00:00`;
      const endOfDay = `${date}T23:59:59`;

      const { data, error } = await supabase
        .from('cash_envelopes')
        .select('id, lis_codes_count, status, expected_cash, counted_cash, difference, justificativa, created_at')
        .eq('unit_id', unitId)
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: open && !!unitId,
  });

  // Query totais por forma de pagamento
  const { data: paymentTotals, isLoading: loadingTotals } = useQuery({
    queryKey: ['reception-day-payment-totals', unitId, date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lis_closure_items')
        .select('payment_method, amount')
        .eq('unit_id', unitId)
        .eq('date', date);

      if (error) throw error;

      // Agregar por forma de pagamento
      const totals: Record<string, number> = {};
      (data || []).forEach((item) => {
        const method = item.payment_method || 'OUTROS';
        totals[method] = (totals[method] || 0) + (item.amount || 0);
      });

      return totals;
    },
    enabled: open && !!unitId,
  });

  const docCount = documents?.length || 0;
  const docTotal = documents?.reduce((sum, d) => sum + (d.valor || 0), 0) || 0;
  const envelopeCount = envelopes?.length || 0;

  const handleViewPayable = (id: string) => {
    navigate(`/payables/boletos?id=${id}`);
    onClose();
  };

  const content = (
    <div className="flex flex-col h-full">
      {/* Header com resumo */}
      <div className="mb-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4" />
                <span>Documentos</span>
              </div>
              <p className="text-lg font-semibold mt-1">
                {docCount} <span className="text-sm font-normal text-muted-foreground">- {formatCurrency(docTotal)}</span>
              </p>
            </CardContent>
          </Card>
          <Card className="bg-green-500/5 border-green-500/20">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Package className="h-4 w-4" />
                <span>Envelopes</span>
              </div>
              <p className="text-lg font-semibold mt-1">
                {envelopeCount}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Totais por forma de pagamento */}
        {paymentTotals && Object.keys(paymentTotals).length > 0 && (
          <Card>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">Formas de Pagamento</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                {paymentTotals['DINHEIRO'] !== undefined && (
                  <div className="flex items-center gap-2">
                    <Banknote className="h-4 w-4 text-green-600" />
                    <span>{formatCurrency(paymentTotals['DINHEIRO'])}</span>
                  </div>
                )}
                {paymentTotals['PIX'] !== undefined && (
                  <div className="flex items-center gap-2">
                    <QrCode className="h-4 w-4 text-purple-600" />
                    <span>{formatCurrency(paymentTotals['PIX'])}</span>
                  </div>
                )}
                {(paymentTotals['CARTAO_CREDITO'] !== undefined || paymentTotals['CARTAO_DEBITO'] !== undefined) && (
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-blue-600" />
                    <span>{formatCurrency((paymentTotals['CARTAO_CREDITO'] || 0) + (paymentTotals['CARTAO_DEBITO'] || 0))}</span>
                  </div>
                )}
                {paymentTotals['CONVENIO'] !== undefined && (
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-amber-600" />
                    <span>{formatCurrency(paymentTotals['CONVENIO'])}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="documentos" className="gap-2">
            <FileText className="h-4 w-4" />
            Documentos {docCount > 0 && <Badge variant="secondary" className="ml-1 h-5 px-1.5">{docCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="caixa" className="gap-2">
            <Wallet className="h-4 w-4" />
            Caixa {envelopeCount > 0 && <Badge variant="secondary" className="ml-1 h-5 px-1.5">{envelopeCount}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="documentos" className="flex-1 mt-4 overflow-auto">
          {loadingDocs ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : docCount === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Nenhum documento processado hoje</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Hora</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Beneficiário</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents?.map((doc) => {
                    const statusConfig = STATUS_CONFIG[doc.status] || { label: doc.status, variant: 'secondary' as const };
                    return (
                      <TableRow key={doc.id}>
                        <TableCell className="text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(doc.created_at), 'HH:mm')}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-normal">
                            {TIPO_LABELS[doc.tipo] || doc.tipo}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium truncate max-w-[150px]">{doc.beneficiario || '-'}</p>
                            {doc.description && (
                              <p className="text-xs text-muted-foreground truncate max-w-[150px]">{doc.description}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(doc.valor || 0)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusConfig.variant}>
                            {doc.paid_at ? (
                              <span className="flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                Pago
                              </span>
                            ) : (
                              statusConfig.label
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleViewPayable(doc.id)}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="caixa" className="flex-1 mt-4 overflow-auto">
          {loadingEnvelopes || loadingTotals ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : envelopeCount === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Nenhum envelope fechado hoje</p>
            </div>
          ) : (
            <div className="space-y-3">
              {envelopes?.map((envelope) => {
                const isPending = envelope.status === 'pending';
                const hasDifference = envelope.difference && envelope.difference !== 0;

                return (
                  <Card key={envelope.id} className={isPending ? 'border-orange-300 bg-orange-50/50 dark:bg-orange-950/20' : ''}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Package className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium">
                              Envelope #{envelope.lis_codes_count || '?'} atendimentos
                            </p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(envelope.created_at), 'HH:mm')}
                            </p>
                          </div>
                        </div>
                        <Badge variant={isPending ? 'secondary' : 'default'} className={isPending ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}>
                          {isPending ? 'Pendente' : 'Fechado'}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-3 gap-3 text-sm">
                        <div>
                          <p className="text-muted-foreground text-xs">Esperado</p>
                          <p className="font-medium">{formatCurrency(envelope.expected_cash || 0)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Contado</p>
                          <p className="font-medium">{formatCurrency(envelope.counted_cash || 0)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Diferença</p>
                          <p className={`font-medium flex items-center gap-1 ${
                            !hasDifference ? 'text-green-600' : 
                            (envelope.difference || 0) < 0 ? 'text-red-600' : 'text-amber-600'
                          }`}>
                            {hasDifference ? (
                              <>
                                <AlertCircle className="h-3 w-3" />
                                {formatCurrency(envelope.difference || 0)}
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="h-3 w-3" />
                                OK
                              </>
                            )}
                          </p>
                        </div>
                      </div>

                      {envelope.justificativa && (
                        <div className="mt-3 pt-3 border-t">
                          <p className="text-xs text-muted-foreground">Observação:</p>
                          <p className="text-sm">{envelope.justificativa}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );

  // Renderizar como Sheet em mobile, Dialog em desktop
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <SheetContent side="bottom" className="h-[85vh] flex flex-col">
          <SheetHeader className="text-left">
            <SheetTitle className="text-lg">
              Resumo do Dia
              <span className="block text-sm font-normal text-muted-foreground capitalize">
                {formattedDate}
              </span>
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-hidden mt-4">
            {content}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl">
            Resumo do Dia
            <span className="block text-sm font-normal text-muted-foreground capitalize">
              {formattedDate}
            </span>
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-hidden">
          {content}
        </div>
      </DialogContent>
    </Dialog>
  );
}
