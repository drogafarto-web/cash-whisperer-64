import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, differenceInDays, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Barcode,
  Plus,
  FileSpreadsheet,
  FileText,
  Copy,
  Check,
  CreditCard,
  QrCode,
  Eye,
  Trash2,
  Link as LinkIcon,
  FileCheck,
  FileWarning,
  ListFilter,
} from 'lucide-react';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { AIErrorExplanation } from '@/components/ui/AIErrorExplanation';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { ScreenGuide } from '@/components/ui/ScreenGuide';

import { BoletoUploadForm } from '@/components/payables/BoletoUploadForm';
import { PayablesFiltersExtended } from '@/components/payables/PayablesFiltersExtended';
import { PayableDetailModal } from '@/components/payables/PayableDetailModal';
import { MarkAsPaidModal } from '@/components/payables/MarkAsPaidModal';
import { BoletoNfLinkModal } from '@/components/payables/BoletoNfLinkModal';
import {
  usePayablesWithPaymentData,
  useDeletePayable,
  useMarkPayableAsPaidWithAccount,
} from '@/features/payables';
import type { Payable } from '@/types/payables';

type PayableWithAccount = Payable & {
  accounts?: { id: string; name: string; institution?: string } | null;
};

export default function BoletosPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Filter states
  const [periodDays, setPeriodDays] = useState<string>('all');
  const [beneficiarioFilter, setBeneficiarioFilter] = useState('');
  const [unitIdFilter, setUnitIdFilter] = useState('all');
  const [paymentAccountFilter, setPaymentAccountFilter] = useState('all');
  const [nfLinkFilter, setNfLinkFilter] = useState('all');
  const [showAll, setShowAll] = useState(false); // Toggle para mostrar todas despesas

  // Detail modal state
  const [selectedPayable, setSelectedPayable] = useState<Payable | null>(null);

  // Mark as paid modal state
  const [payableToMarkPaid, setPayableToMarkPaid] = useState<PayableWithAccount | null>(null);

  // NF Link modal state
  const [payableToLink, setPayableToLink] = useState<PayableWithAccount | null>(null);

  // AI Error state
  const [aiError, setAiError] = useState<{ message: string; context?: Record<string, any> } | null>(null);

  // Fetch data with API filters
  const { data: allPayables = [], isLoading } = usePayablesWithPaymentData({
    unitId: unitIdFilter !== 'all' ? unitIdFilter : undefined,
    paymentAccountId: paymentAccountFilter !== 'all' ? paymentAccountFilter : undefined,
    periodDays: periodDays !== 'all' ? parseInt(periodDays) : undefined,
    showAll,
  });

  const deletePayable = useDeletePayable();
  const markAsPaidMutation = useMarkPayableAsPaidWithAccount();

  const { data: units = [] } = useQuery({
    queryKey: ['units'],
    queryFn: async () => {
      const { data } = await supabase.from('units').select('id, name');
      return data || [];
    },
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts-active'],
    queryFn: async () => {
      const { data } = await supabase
        .from('accounts')
        .select('id, name, institution')
        .eq('active', true)
        .order('name');
      return data || [];
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories-expense'],
    queryFn: async () => {
      const { data } = await supabase.from('categories').select('id, name').eq('type', 'expense');
      return data || [];
    },
  });

  const { data: supplierInvoices = [] } = useQuery({
    queryKey: ['supplier-invoices-list'],
    queryFn: async () => {
      const { data } = await supabase
        .from('supplier_invoices')
        .select('id, document_number, supplier_name');
      return data || [];
    },
  });

  // Apply client-side filters
  const filteredPayables = useMemo(() => {
    let result = allPayables;
    
    if (beneficiarioFilter) {
      const searchTerm = beneficiarioFilter.toLowerCase();
      result = result.filter((p) => p.beneficiario?.toLowerCase().includes(searchTerm));
    }
    
    if (nfLinkFilter !== 'all') {
      result = result.filter((p) => p.nf_vinculacao_status === nfLinkFilter);
    }
    
    return result;
  }, [allPayables, beneficiarioFilter, nfLinkFilter]);

  // Summary calculations
  const today = startOfDay(new Date());
  const summary = useMemo(() => {
    let vencidos = 0,
      vencidosValor = 0;
    let hojeAmanha = 0,
      hojeAmanhaValor = 0;
    let semana = 0,
      semanaValor = 0;
    let pendentesNf = 0;

    filteredPayables.forEach((p) => {
      const vencimento = startOfDay(new Date(p.vencimento));
      const diff = differenceInDays(vencimento, today);

      if (diff < 0) {
        vencidos++;
        vencidosValor += p.valor;
      } else if (diff <= 1) {
        hojeAmanha++;
        hojeAmanhaValor += p.valor;
      } else if (diff <= 7) {
        semana++;
        semanaValor += p.valor;
      }
      
      if (p.nf_vinculacao_status === 'pendente') {
        pendentesNf++;
      }
    });

    return { vencidos, vencidosValor, hojeAmanha, hojeAmanhaValor, semana, semanaValor, pendentesNf };
  }, [filteredPayables, today]);

  // Get urgency badge for due date
  const getUrgencyBadge = (vencimento: string) => {
    const vencimentoDate = startOfDay(new Date(vencimento));
    const diff = differenceInDays(vencimentoDate, today);

    if (diff < 0) {
      return (
        <Badge variant="destructive" className="text-xs">
          Vencido
        </Badge>
      );
    }
    if (diff <= 1) {
      return (
        <Badge className="bg-orange-500 hover:bg-orange-600 text-xs">
          {diff === 0 ? 'Hoje' : 'Amanhã'}
        </Badge>
      );
    }
    if (diff <= 7) {
      return (
        <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white text-xs">{diff} dias</Badge>
      );
    }
    return null;
  };

  // Get payment type badge
  const getPaymentTypeBadge = (payable: PayableWithAccount) => {
    const hasBoleto = payable.linha_digitavel || payable.codigo_barras;
    const hasPix = payable.pix_key;

    return (
      <div className="flex gap-1">
        {hasBoleto && (
          <Badge variant="secondary" className="text-xs gap-1">
            <CreditCard className="h-3 w-3" />
            Boleto
          </Badge>
        )}
        {hasPix && (
          <Badge variant="secondary" className="text-xs gap-1 bg-green-100 text-green-800">
            <QrCode className="h-3 w-3" />
            PIX
          </Badge>
        )}
      </div>
    );
  };

  // Get account abbreviation
  const getAccountAbbreviation = (payable: PayableWithAccount) => {
    if (payable.accounts?.name) {
      const name = payable.accounts.name;
      const institution = payable.accounts.institution;
      // Take first 2-3 words or abbreviation
      const abbrev = name.split(' ').slice(0, 2).join(' ');
      return institution ? `${abbrev} (${institution})` : abbrev;
    }
    return '—';
  };

  // Copy to clipboard function
  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copiado para a área de transferência!', {
        description: `${label} copiado`,
      });
    } catch {
      toast.error('Erro ao copiar');
    }
  };

  // Infer PIX key type
  const getPixKeyLabel = (pixKey: string) => {
    if (/^\d{11}$/.test(pixKey)) return 'CPF';
    if (/^\d{14}$/.test(pixKey)) return 'CNPJ';
    if (/^[^@]+@[^@]+\.[^@]+$/.test(pixKey)) return 'Email';
    if (/^\+?55\d{10,11}$/.test(pixKey)) return 'Telefone';
    return 'Aleatória';
  };

  const handleMarkAsPaid = (payableId: string, paidAt: string, paymentAccountId?: string) => {
    const payable = filteredPayables.find((p) => p.id === payableId);
    if (!payable) return;

    markAsPaidMutation.mutate(
      {
        id: payableId,
        paidAmount: payable.valor,
        paidMethod: 'manual',
        paidAt,
        paymentAccountId,
      },
      {
        onSuccess: () => {
          setPayableToMarkPaid(null);
        },
      }
    );
  };

  const handleClearFilters = () => {
    setPeriodDays('all');
    setBeneficiarioFilter('');
    setUnitIdFilter('all');
    setPaymentAccountFilter('all');
    setNfLinkFilter('all');
    setShowAll(false);
  };

  // Get NF link status badge
  const getNfLinkBadge = (payable: PayableWithAccount) => {
    const status = payable.nf_vinculacao_status;
    
    if (status === 'pendente') {
      return (
        <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-500/10 text-xs gap-1">
          <FileWarning className="h-3 w-3" />
          NF Pendente
        </Badge>
      );
    }
    if (status === 'vinculado') {
      return (
        <Badge variant="outline" className="border-green-500 text-green-600 bg-green-500/10 text-xs gap-1">
          <FileCheck className="h-3 w-3" />
          NF Vinculada
        </Badge>
      );
    }
    return null;
  };

  const exportToExcel = () => {
    const dataToExport = filteredPayables.map((p) => ({
      Beneficiário: p.beneficiario || '',
      CNPJ: p.beneficiario_cnpj || '',
      Valor: p.valor,
      Vencimento: format(new Date(p.vencimento), 'dd/MM/yyyy'),
      'Linha Digitável': p.linha_digitavel || '',
      'Código de Barras': p.codigo_barras || '',
      'Chave PIX': p.pix_key || '',
      Conta: (p as PayableWithAccount).accounts?.name || '',
      Descrição: p.description || '',
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pagamentos');
    XLSX.writeFile(wb, `pagamentos-pendentes-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    const data = filteredPayables;

    doc.setFontSize(16);
    doc.text('Pagamentos Pendentes', 20, 20);

    doc.setFontSize(10);
    doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 20, 28);
    doc.text(`Total: ${data.length} pagamentos`, 20, 34);
    doc.text(
      `Valor total: ${data
        .reduce((sum, p) => sum + p.valor, 0)
        .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
      20,
      40
    );

    let y = 52;
    data.forEach((p, i) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.setFontSize(10);
      doc.text(`${i + 1}. ${p.beneficiario || 'Sem beneficiário'}`, 20, y);
      doc.setFontSize(9);
      doc.text(
        `${p.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} | Venc: ${format(new Date(p.vencimento), 'dd/MM/yyyy')}`,
        25,
        y + 5
      );
      if (p.linha_digitavel) {
        doc.text(`Linha: ${p.linha_digitavel}`, 25, y + 10);
        y += 5;
      }
      y += 14;
    });

    doc.save(`pagamentos-pendentes-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Pagamentos Pendentes</h1>
            <p className="text-muted-foreground">
              Copie os dados e pague rapidamente no app do banco
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportToExcel}>
              <FileSpreadsheet className="h-4 w-4 mr-1" />
              Excel
            </Button>
            <Button variant="outline" size="sm" onClick={exportToPDF}>
              <FileText className="h-4 w-4 mr-1" />
              PDF
            </Button>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Pagamento
            </Button>
          </div>
        </div>

        {/* Micro-onboarding */}
        <ScreenGuide
          purpose="Painel de pagamentos diário. Veja boletos e PIX pendentes, copie os dados e pague no banco."
          steps={[
            'Encontre pagamentos vencidos (vermelho) ou próximos (laranja/amarelo).',
            "Clique em 'Copiar' para copiar linha digitável ou chave PIX.",
            "Após pagar, clique no ✓ para marcar como pago.",
          ]}
          storageKey="boletos-v2-guide"
          className="mb-2"
        />

        {/* Filters */}
        <div className="space-y-3">
          <PayablesFiltersExtended
            periodDays={periodDays}
            onPeriodDaysChange={setPeriodDays}
            beneficiario={beneficiarioFilter}
            onBeneficiarioChange={setBeneficiarioFilter}
            unitId={unitIdFilter}
            onUnitIdChange={setUnitIdFilter}
            units={units}
            paymentAccountId={paymentAccountFilter}
            onPaymentAccountIdChange={setPaymentAccountFilter}
            accounts={accounts}
            nfLinkStatus={nfLinkFilter}
            onNfLinkStatusChange={setNfLinkFilter}
            onClear={handleClearFilters}
          />
          
          {/* Toggle para mostrar todas despesas */}
          <div className="flex items-center gap-2 px-1">
            <Button
              variant={showAll ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowAll(!showAll)}
              className="gap-2"
            >
              <ListFilter className="h-4 w-4" />
              {showAll ? 'Todas as despesas' : 'Apenas com dados de pagamento'}
            </Button>
            {showAll && (
              <span className="text-xs text-muted-foreground">
                Exibindo despesas mesmo sem código de barras, PIX ou linha digitável
              </span>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-destructive/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-destructive flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-destructive" />
                Vencidos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{summary.vencidos}</div>
              <p className="text-sm text-muted-foreground">
                {summary.vencidosValor.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </p>
            </CardContent>
          </Card>
          <Card className="border-orange-500/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-orange-600 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-orange-500" />
                Hoje / Amanhã
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{summary.hojeAmanha}</div>
              <p className="text-sm text-muted-foreground">
                {summary.hojeAmanhaValor.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </p>
            </CardContent>
          </Card>
          <Card className="border-yellow-500/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-yellow-600 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-yellow-500" />
                Esta Semana
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{summary.semana}</div>
              <p className="text-sm text-muted-foreground">
                {summary.semanaValor.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </p>
            </CardContent>
          </Card>
          <Card className={summary.pendentesNf > 0 ? 'border-amber-500/50' : ''}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-amber-600 flex items-center gap-2">
                <FileWarning className="h-4 w-4" />
                Sem NF Vinculada
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{summary.pendentesNf}</div>
              <p className="text-sm text-muted-foreground">boletos de compra</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[130px]">Vencimento</TableHead>
                  <TableHead>Beneficiário</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="w-[100px]">Tipo</TableHead>
                  <TableHead className="w-[120px]">NF</TableHead>
                  <TableHead className="w-[140px]">Conta</TableHead>
                  <TableHead className="w-[220px]">Dados p/ Pagamento</TableHead>
                  <TableHead className="text-right w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : filteredPayables.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      Nenhum pagamento pendente encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPayables.map((payable) => (
                    <TableRow key={payable.id}>
                      {/* Vencimento */}
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="font-medium">
                            {format(new Date(payable.vencimento), 'dd/MM/yyyy', { locale: ptBR })}
                          </span>
                          {getUrgencyBadge(payable.vencimento)}
                        </div>
                      </TableCell>

                      {/* Beneficiário */}
                      <TableCell className="font-medium max-w-[180px] truncate">
                        {payable.beneficiario}
                      </TableCell>

                      {/* Descrição */}
                      <TableCell className="text-muted-foreground max-w-[200px] truncate">
                        {payable.description || '—'}
                      </TableCell>

                      {/* Valor */}
                      <TableCell className="text-right font-medium">
                        {payable.valor.toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })}
                      </TableCell>

                      {/* Tipo */}
                      <TableCell>{getPaymentTypeBadge(payable)}</TableCell>

                      {/* NF Status - Coluna dedicada com botão de vincular */}
                      <TableCell>
                        {payable.supplier_invoice_id ? (
                          <Badge className="bg-green-500 hover:bg-green-600 text-white text-xs gap-1">
                            <FileCheck className="h-3 w-3" />
                            Vinculada
                          </Badge>
                        ) : payable.nf_vinculacao_status === 'pendente' ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1 text-amber-600 border-amber-300 hover:bg-amber-50"
                            onClick={() => setPayableToLink(payable)}
                          >
                            <LinkIcon className="h-3 w-3" />
                            Vincular NF
                          </Button>
                        ) : payable.nf_vinculacao_status === 'nao_requer' ? (
                          <Badge variant="secondary" className="text-xs">N/A</Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>

                      {/* Conta */}
                      <TableCell className="text-sm text-muted-foreground">
                        {getAccountAbbreviation(payable)}
                      </TableCell>

                      {/* Dados para Pagamento - Copy Buttons */}
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {payable.linha_digitavel && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs gap-1"
                                  onClick={() =>
                                    copyToClipboard(payable.linha_digitavel!, 'Linha digitável')
                                  }
                                >
                                  <Copy className="h-3 w-3" />
                                  Linha
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs max-w-xs break-all">
                                  {payable.linha_digitavel}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                          {payable.codigo_barras && !payable.linha_digitavel && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs gap-1"
                                  onClick={() =>
                                    copyToClipboard(payable.codigo_barras!, 'Código de barras')
                                  }
                                >
                                  <Copy className="h-3 w-3" />
                                  Cód
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs max-w-xs break-all">
                                  {payable.codigo_barras}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                          {payable.pix_key && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs gap-1"
                                  onClick={() => copyToClipboard(payable.pix_key!, 'Chave PIX')}
                                >
                                  <Copy className="h-3 w-3" />
                                  PIX ({getPixKeyLabel(payable.pix_key)})
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">{payable.pix_key}</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>

                      {/* Ações */}
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {/* Link NF button - only for payables without linked invoice */}
                          {!payable.supplier_invoice_id && payable.nf_vinculacao_status === 'pendente' && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                  onClick={() => setPayableToLink(payable)}
                                >
                                  <LinkIcon className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Vincular NF</TooltipContent>
                            </Tooltip>
                          )}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                                onClick={() => setPayableToMarkPaid(payable)}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Marcar como pago</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setSelectedPayable(payable)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Ver detalhes</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => deletePayable.mutate(payable.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Excluir</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Add Boleto Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Barcode className="h-5 w-5" />
              Cadastrar Pagamento
            </DialogTitle>
          </DialogHeader>
          <BoletoUploadForm
            units={units}
            categories={categories}
            supplierInvoices={supplierInvoices}
            onSuccess={() => setIsDialogOpen(false)}
            onCancel={() => setIsDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Detail Modal */}
      <PayableDetailModal
        payable={selectedPayable}
        open={!!selectedPayable}
        onOpenChange={(open) => !open && setSelectedPayable(null)}
        onMarkAsPaid={() => {
          if (selectedPayable) {
            setPayableToMarkPaid(selectedPayable);
            setSelectedPayable(null);
          }
        }}
      />

      {/* Mark as Paid Modal */}
      <MarkAsPaidModal
        open={!!payableToMarkPaid}
        onOpenChange={(open) => !open && setPayableToMarkPaid(null)}
        payable={payableToMarkPaid}
        accounts={accounts}
        onConfirm={handleMarkAsPaid}
        isPending={markAsPaidMutation.isPending}
      />

      {/* NF Link Modal */}
      <BoletoNfLinkModal
        open={!!payableToLink}
        onOpenChange={(open) => !open && setPayableToLink(null)}
        payableId={payableToLink?.id || ''}
        beneficiario={payableToLink?.beneficiario || ''}
        beneficiarioCnpj={payableToLink?.beneficiario_cnpj || ''}
        valor={payableToLink?.valor || 0}
      />

      {/* AI Error Explanation */}
      {aiError && (
        <div className="fixed bottom-20 right-4 max-w-md z-40">
          <AIErrorExplanation
            error={aiError.message}
            context={aiError.context}
            useAI={true}
            onDismiss={() => setAiError(null)}
          />
        </div>
      )}
    </AppLayout>
  );
}
