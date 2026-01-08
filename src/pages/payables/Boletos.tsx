import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { format, differenceInDays, startOfDay, subMonths, addMonths, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Barcode,
  Plus,
  FileSpreadsheet,
  BarChart3,
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
  Download,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { ScreenGuide } from '@/components/ui/ScreenGuide';
import { useAuth } from '@/hooks/useAuth';

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
import { formatCurrency, normalizeFornecedor } from '@/lib/formats';

type PayableWithAccount = Payable & {
  accounts?: { id: string; name: string; institution?: string } | null;
  categories?: { id: string; name: string } | null;
};

export default function BoletosPage() {
  const { role, activeUnit } = useAuth();
  const isSecretaria = role === 'secretaria';
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightId = searchParams.get('highlight');
  const highlightRowRef = useRef<HTMLTableRowElement>(null);

  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Filter states
  const [statusFilter, setStatusFilter] = useState<string>('pendentes');
  const [monthFilter, setMonthFilter] = useState<Date>(new Date());
  const [periodDays, setPeriodDays] = useState<string>('all');
  const [beneficiarioFilter, setBeneficiarioFilter] = useState('');
  const [unitIdFilter, setUnitIdFilter] = useState('all');
  const [paymentAccountFilter, setPaymentAccountFilter] = useState('all');
  const [nfLinkFilter, setNfLinkFilter] = useState('all');
  const [showAll, setShowAll] = useState(false);
  
  // When highlightId is present, force filters to show all records
  useEffect(() => {
    if (highlightId) {
      setShowAll(true);
      setStatusFilter('all');
      setBeneficiarioFilter('');
      setNfLinkFilter('all');
    }
  }, [highlightId]);

  // Forçar unidade para secretaria
  useEffect(() => {
    if (isSecretaria && activeUnit && unitIdFilter === 'all') {
      setUnitIdFilter(activeUnit.id);
    }
  }, [isSecretaria, activeUnit, unitIdFilter]);

  // Detail modal state
  const [selectedPayable, setSelectedPayable] = useState<Payable | null>(null);

  // Mark as paid modal state
  const [payableToMarkPaid, setPayableToMarkPaid] = useState<PayableWithAccount | null>(null);

  // NF Link modal state
  const [payableToLink, setPayableToLink] = useState<PayableWithAccount | null>(null);

  // AI Error state
  const [aiError, setAiError] = useState<{ message: string; context?: Record<string, any> } | null>(null);

  // Determine API status filter
  const apiStatus = useMemo(() => {
    if (statusFilter === 'pendentes') return undefined; // Default behavior
    if (statusFilter === 'PAGO') return 'PAGO' as const;
    if (statusFilter === 'VENCIDO') return 'VENCIDO' as const;
    if (statusFilter === 'all') return 'all' as const;
    return undefined;
  }, [statusFilter]);

  // Fetch data with API filters
  const { data: allPayables = [], isLoading } = usePayablesWithPaymentData({
    unitId: isSecretaria 
      ? (activeUnit?.id || 'none')
      : (unitIdFilter !== 'all' ? unitIdFilter : undefined),
    paymentAccountId: paymentAccountFilter !== 'all' ? paymentAccountFilter : undefined,
    periodDays: statusFilter !== 'PAGO' && periodDays !== 'all' ? parseInt(periodDays) : undefined,
    showAll: showAll || statusFilter === 'PAGO',
    status: apiStatus,
    monthYear: statusFilter === 'PAGO' ? format(monthFilter, 'yyyy-MM') : undefined,
    highlightId: highlightId || undefined,
  });

  // Check if highlighted record was found
  const highlightedRecordFound = useMemo(() => {
    if (!highlightId) return true;
    return allPayables.some(p => p.id === highlightId);
  }, [highlightId, allPayables]);

  // Scroll to highlighted row when found
  useEffect(() => {
    if (highlightId && highlightRowRef.current && highlightedRecordFound) {
      highlightRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightId, highlightedRecordFound]);

  // Clear highlight after successful scroll (only remove highlight param, keep other params)
  useEffect(() => {
    if (highlightId && highlightedRecordFound && highlightRowRef.current) {
      const timeout = setTimeout(() => {
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('highlight');
        setSearchParams(newParams, { replace: true });
      }, 5000);
      return () => clearTimeout(timeout);
    }
  }, [highlightId, highlightedRecordFound, searchParams, setSearchParams]);

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

  // Summary calculations for pending
  const today = startOfDay(new Date());
  const summaryPending = useMemo(() => {
    if (statusFilter === 'PAGO') return null;
    
    let vencidos = 0, vencidosValor = 0;
    let hojeAmanha = 0, hojeAmanhaValor = 0;
    let semana = 0, semanaValor = 0;
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
  }, [filteredPayables, today, statusFilter]);

  // Summary for paid payables
  const summaryPaid = useMemo(() => {
    if (statusFilter !== 'PAGO') return null;
    
    const total = filteredPayables.reduce((sum, p) => sum + (p.paid_amount || p.valor), 0);
    return {
      count: filteredPayables.length,
      total,
    };
  }, [filteredPayables, statusFilter]);

  // Get urgency badge for due date
  const getUrgencyBadge = (payable: PayableWithAccount) => {
    if (payable.status === 'PAGO') {
      return (
        <Badge className="bg-green-500 hover:bg-green-600 text-xs">
          Pago
        </Badge>
      );
    }
    
    const vencimentoDate = startOfDay(new Date(payable.vencimento));
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
    if (!isSecretaria) {
      setUnitIdFilter('all');
    }
    setPaymentAccountFilter('all');
    setNfLinkFilter('all');
    setShowAll(false);
    setStatusFilter('pendentes');
    setMonthFilter(new Date());
  };

  // Get NF link status badge
  const getNfLinkBadge = (payable: PayableWithAccount) => {
    const status = payable.nf_vinculacao_status;
    const nfInSameDocument = (payable as any).nf_in_same_document;
    
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
          {nfInSameDocument ? 'NF no Documento' : 'NF Vinculada'}
        </Badge>
      );
    }
    return null;
  };

  // Export simple list to Excel
  const exportToExcel = () => {
    const dataToExport = filteredPayables.map((p) => ({
      Beneficiário: p.beneficiario || '',
      CNPJ: p.beneficiario_cnpj || '',
      Valor: p.valor,
      Vencimento: format(new Date(p.vencimento), 'dd/MM/yyyy'),
      Status: p.status,
      'Pago em': p.paid_at ? format(new Date(p.paid_at), 'dd/MM/yyyy') : '',
      'Valor Pago': p.paid_amount || '',
      'Linha Digitável': p.linha_digitavel || '',
      'Código de Barras': p.codigo_barras || '',
      'Chave PIX': p.pix_key || '',
      Conta: (p as PayableWithAccount).accounts?.name || '',
      Categoria: (p as PayableWithAccount).categories?.name || '',
      Descrição: p.description || '',
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pagamentos');
    const fileName = statusFilter === 'PAGO' 
      ? `pagamentos-pagos-${format(monthFilter, 'yyyy-MM')}.xlsx`
      : `pagamentos-pendentes-${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  // Export simple list to PDF
  const exportToPDF = () => {
    const doc = new jsPDF();
    const data = filteredPayables;

    doc.setFontSize(16);
    const title = statusFilter === 'PAGO' 
      ? `Pagamentos Pagos - ${format(monthFilter, 'MMMM yyyy', { locale: ptBR })}`
      : 'Pagamentos Pendentes';
    doc.text(title, 20, 20);

    doc.setFontSize(10);
    doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 20, 28);
    doc.text(`Total: ${data.length} pagamentos`, 20, 34);
    const totalValue = statusFilter === 'PAGO'
      ? data.reduce((sum, p) => sum + (p.paid_amount || p.valor), 0)
      : data.reduce((sum, p) => sum + p.valor, 0);
    doc.text(
      `Valor total: ${totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
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
      const valorDisplay = statusFilter === 'PAGO' ? (p.paid_amount || p.valor) : p.valor;
      const dateLabel = statusFilter === 'PAGO' ? 'Pago em' : 'Venc';
      const dateValue = statusFilter === 'PAGO' && p.paid_at 
        ? format(new Date(p.paid_at), 'dd/MM/yyyy')
        : format(new Date(p.vencimento), 'dd/MM/yyyy');
      doc.text(
        `${valorDisplay.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} | ${dateLabel}: ${dateValue}`,
        25,
        y + 5
      );
      if (p.linha_digitavel && statusFilter !== 'PAGO') {
        doc.text(`Linha: ${p.linha_digitavel}`, 25, y + 10);
        y += 5;
      }
      y += 14;
    });

    const fileName = statusFilter === 'PAGO'
      ? `pagamentos-pagos-${format(monthFilter, 'yyyy-MM')}.pdf`
      : `pagamentos-pendentes-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
    doc.save(fileName);
  };

  // Export gerencial PDF with executive summary and status sections
  const exportPDFGerencial = () => {
    const doc = new jsPDF();
    const data = filteredPayables;
    const hoje = startOfDay(new Date());
    
    // Categorize by due date status
    const vencidos = data.filter(p => differenceInDays(parseISO(p.vencimento), hoje) < 0);
    const urgentes7dias = data.filter(p => {
      const diff = differenceInDays(parseISO(p.vencimento), hoje);
      return diff >= 0 && diff <= 7;
    });
    const proximos30dias = data.filter(p => {
      const diff = differenceInDays(parseISO(p.vencimento), hoje);
      return diff > 7 && diff <= 30;
    });
    const futuros = data.filter(p => differenceInDays(parseISO(p.vencimento), hoje) > 30);

    // Calculate totals
    const totalVencidos = vencidos.reduce((s, p) => s + p.valor, 0);
    const totalUrgentes = urgentes7dias.reduce((s, p) => s + p.valor, 0);
    const totalProximos = proximos30dias.reduce((s, p) => s + p.valor, 0);
    const totalFuturos = futuros.reduce((s, p) => s + p.valor, 0);
    const totalGeral = data.reduce((s, p) => s + p.valor, 0);

    // Find largest creditor
    const creditorTotals: Record<string, number> = {};
    data.forEach(p => {
      const nome = normalizeFornecedor(p.beneficiario || 'Desconhecido', 50);
      creditorTotals[nome] = (creditorTotals[nome] || 0) + p.valor;
    });
    const maiorCredor = Object.entries(creditorTotals).sort((a, b) => b[1] - a[1])[0];

    let y = 20;
    const pageWidth = doc.internal.pageSize.width;
    const margin = 15;
    const contentWidth = pageWidth - 2 * margin;

    // Helper: Draw section header with colored background
    const drawSectionHeader = (
      yPos: number, 
      color: [number, number, number], 
      title: string, 
      count: number, 
      total: number
    ): number => {
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
      doc.setFillColor(color[0], color[1], color[2]);
      doc.rect(margin, yPos, contentWidth, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`${title} (${count} ${count === 1 ? 'título' : 'títulos'} - ${formatCurrency(total)})`, margin + 3, yPos + 5.5);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
      return yPos + 12;
    };

    // Helper: Draw table with data
    const drawTable = (
      yPos: number, 
      headers: string[], 
      rows: string[][], 
      colWidths: number[]
    ): number => {
      const rowHeight = 6;
      const fontSize = 8;
      
      // Draw header
      doc.setFillColor(240, 240, 240);
      doc.rect(margin, yPos, contentWidth, rowHeight, 'F');
      doc.setFontSize(fontSize);
      doc.setFont('helvetica', 'bold');
      let xPos = margin + 2;
      headers.forEach((header, i) => {
        doc.text(header, xPos, yPos + 4);
        xPos += colWidths[i];
      });
      yPos += rowHeight;
      
      // Draw rows
      doc.setFont('helvetica', 'normal');
      rows.forEach((row) => {
        if (yPos > 275) {
          doc.addPage();
          yPos = 20;
        }
        xPos = margin + 2;
        row.forEach((cell, i) => {
          const text = cell.length > 35 ? cell.substring(0, 32) + '...' : cell;
          doc.text(text, xPos, yPos + 4);
          xPos += colWidths[i];
        });
        // Draw line under row
        doc.setDrawColor(220, 220, 220);
        doc.line(margin, yPos + rowHeight - 0.5, margin + contentWidth, yPos + rowHeight - 0.5);
        yPos += rowHeight;
      });
      
      return yPos + 4;
    };

    // === HEADER ===
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('RELATÓRIO DE PAGAMENTOS PENDENTES', margin, y);
    y += 7;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`, margin, y);
    y += 12;

    // === EXECUTIVE SUMMARY BOX ===
    doc.setDrawColor(100, 100, 100);
    doc.setFillColor(250, 250, 250);
    doc.roundedRect(margin, y, contentWidth, 42, 2, 2, 'FD');
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('RESUMO EXECUTIVO', margin + 5, y + 7);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const col1x = margin + 5;
    const col2x = margin + contentWidth / 2;
    
    doc.text(`Total de títulos: ${data.length}`, col1x, y + 15);
    doc.text(`Valor total: ${formatCurrency(totalGeral)}`, col2x, y + 15);
    
    // Status summary with colored bullets
    doc.setFillColor(220, 53, 69);
    doc.circle(col1x + 2, y + 22, 1.5, 'F');
    doc.text(`Vencidos: ${vencidos.length} (${formatCurrency(totalVencidos)})`, col1x + 6, y + 23);
    
    doc.setFillColor(255, 152, 0);
    doc.circle(col2x + 2, y + 22, 1.5, 'F');
    doc.text(`Urgentes (7d): ${urgentes7dias.length} (${formatCurrency(totalUrgentes)})`, col2x + 6, y + 23);
    
    doc.setFillColor(255, 193, 7);
    doc.circle(col1x + 2, y + 30, 1.5, 'F');
    doc.text(`Próximos 30d: ${proximos30dias.length} (${formatCurrency(totalProximos)})`, col1x + 6, y + 31);
    
    doc.setFillColor(40, 167, 69);
    doc.circle(col2x + 2, y + 30, 1.5, 'F');
    doc.text(`Futuros: ${futuros.length} (${formatCurrency(totalFuturos)})`, col2x + 6, y + 31);
    
    if (maiorCredor) {
      doc.setFont('helvetica', 'italic');
      doc.text(`Maior credor: ${maiorCredor[0]} - ${formatCurrency(maiorCredor[1])}`, col1x, y + 39);
    }
    
    y += 50;

    // === OVERDUE SECTION ===
    if (vencidos.length > 0) {
      y = drawSectionHeader(y, [220, 53, 69], 'PAGAMENTOS VENCIDOS', vencidos.length, totalVencidos);
      const vencidosRows = vencidos
        .sort((a, b) => differenceInDays(parseISO(a.vencimento), parseISO(b.vencimento)))
        .map(p => [
          normalizeFornecedor(p.beneficiario || '', 32),
          formatCurrency(p.valor),
          format(parseISO(p.vencimento), 'dd/MM/yyyy'),
          `${Math.abs(differenceInDays(parseISO(p.vencimento), hoje))} dias`
        ]);
      y = drawTable(y, ['Fornecedor', 'Valor', 'Vencimento', 'Atraso'], vencidosRows, [75, 35, 35, 35]);
    }

    // === URGENT 7 DAYS SECTION ===
    if (urgentes7dias.length > 0) {
      y = drawSectionHeader(y, [255, 152, 0], 'VENCEM NOS PRÓXIMOS 7 DIAS', urgentes7dias.length, totalUrgentes);
      const urgentesRows = urgentes7dias
        .sort((a, b) => differenceInDays(parseISO(a.vencimento), parseISO(b.vencimento)))
        .map(p => [
          normalizeFornecedor(p.beneficiario || '', 35),
          formatCurrency(p.valor),
          format(parseISO(p.vencimento), 'dd/MM/yyyy')
        ]);
      y = drawTable(y, ['Fornecedor', 'Valor', 'Vencimento'], urgentesRows, [85, 45, 50]);
    }

    // === NEXT 30 DAYS SECTION ===
    if (proximos30dias.length > 0) {
      y = drawSectionHeader(y, [255, 193, 7], 'VENCEM EM 8-30 DIAS', proximos30dias.length, totalProximos);
      const proximosRows = proximos30dias
        .sort((a, b) => differenceInDays(parseISO(a.vencimento), parseISO(b.vencimento)))
        .map(p => [
          normalizeFornecedor(p.beneficiario || '', 35),
          formatCurrency(p.valor),
          format(parseISO(p.vencimento), 'dd/MM/yyyy')
        ]);
      y = drawTable(y, ['Fornecedor', 'Valor', 'Vencimento'], proximosRows, [85, 45, 50]);
    }

    // === FUTURE SECTION ===
    if (futuros.length > 0) {
      y = drawSectionHeader(y, [40, 167, 69], 'VENCIMENTOS FUTUROS (> 30 DIAS)', futuros.length, totalFuturos);
      const futurosRows = futuros
        .sort((a, b) => differenceInDays(parseISO(a.vencimento), parseISO(b.vencimento)))
        .map(p => [
          normalizeFornecedor(p.beneficiario || '', 35),
          formatCurrency(p.valor),
          format(parseISO(p.vencimento), 'dd/MM/yyyy')
        ]);
      y = drawTable(y, ['Fornecedor', 'Valor', 'Vencimento'], futurosRows, [85, 45, 50]);
    }

    // === PAYMENT DATA ANNEX (new page) ===
    const payablesWithPaymentData = data.filter(p => p.linha_digitavel || p.pix_key);
    if (payablesWithPaymentData.length > 0) {
      doc.addPage();
      y = 20;
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('ANEXO: DADOS PARA PAGAMENTO', margin, y);
      y += 8;
      
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text('Linhas digitáveis e chaves PIX para cópia', margin, y);
      doc.setTextColor(0, 0, 0);
      y += 8;
      
      payablesWithPaymentData.forEach((p, i) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text(`${i + 1}. ${normalizeFornecedor(p.beneficiario || '', 45)} - ${formatCurrency(p.valor)}`, margin, y);
        y += 5;
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        if (p.linha_digitavel) {
          doc.text(`   Linha: ${p.linha_digitavel}`, margin, y);
          y += 4;
        }
        if (p.pix_key) {
          doc.text(`   PIX (${getPixKeyLabel(p.pix_key)}): ${p.pix_key}`, margin, y);
          y += 4;
        }
        y += 3;
      });
    }

    doc.save(`relatorio-gerencial-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    toast.success('Relatório gerencial exportado!');
  };

  // Export gerencial PDF for paid payables
  const exportPDFPagosGerencial = (groupBy: 'categoria' | 'beneficiario') => {
    const doc = new jsPDF();
    const data = filteredPayables;
    const mesRef = monthFilter;
    
    // Group data
    const groups: Record<string, PayableWithAccount[]> = {};
    data.forEach((p) => {
      const key = groupBy === 'categoria' 
        ? ((p as PayableWithAccount).categories?.name || 'Sem Categoria')
        : normalizeFornecedor(p.beneficiario || 'Sem Beneficiário', 40);
      if (!groups[key]) groups[key] = [];
      groups[key].push(p as PayableWithAccount);
    });

    // Sort groups by total value
    const sortedGroups = Object.entries(groups)
      .map(([name, items]) => ({
        name,
        items,
        total: items.reduce((s, p) => s + (p.paid_amount || p.valor), 0),
      }))
      .sort((a, b) => b.total - a.total);

    // Calculate statistics
    const totalGeral = data.reduce((s, p) => s + (p.paid_amount || p.valor), 0);
    const maiorPagamento = data.length > 0 
      ? data.reduce((max, p) => 
          (p.paid_amount || p.valor) > (max.paid_amount || max.valor) ? p : max
        )
      : null;

    // Calculate most used account
    const accountCounts: Record<string, { count: number; name: string }> = {};
    data.forEach(p => {
      const acc = (p as PayableWithAccount).accounts;
      if (acc?.name) {
        if (!accountCounts[acc.id]) accountCounts[acc.id] = { count: 0, name: acc.name };
        accountCounts[acc.id].count++;
      }
    });
    const contaMaisUsada = Object.values(accountCounts).sort((a, b) => b.count - a.count)[0];

    let y = 20;
    const pageWidth = doc.internal.pageSize.width;
    const margin = 15;
    const contentWidth = pageWidth - 2 * margin;

    // Color palette for groups (cycling through blues/greens)
    const colors: [number, number, number][] = [
      [59, 130, 246],   // Blue
      [16, 185, 129],   // Green
      [245, 158, 11],   // Amber
      [139, 92, 246],   // Purple
      [236, 72, 153],   // Pink
      [20, 184, 166],   // Teal
      [249, 115, 22],   // Orange
      [99, 102, 241],   // Indigo
    ];

    // Helper: Draw section header with colored background
    const drawSectionHeader = (
      yPos: number, 
      color: [number, number, number], 
      title: string, 
      count: number, 
      total: number
    ): number => {
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
      doc.setFillColor(color[0], color[1], color[2]);
      doc.rect(margin, yPos, contentWidth, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`${title} (${count} ${count === 1 ? 'pagamento' : 'pagamentos'} - ${formatCurrency(total)})`, margin + 3, yPos + 5.5);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
      return yPos + 12;
    };

    // Helper: Draw table with data
    const drawTable = (
      yPos: number, 
      headers: string[], 
      rows: string[][], 
      colWidths: number[]
    ): number => {
      const rowHeight = 6;
      const fontSize = 8;
      
      // Draw header
      doc.setFillColor(240, 240, 240);
      doc.rect(margin, yPos, contentWidth, rowHeight, 'F');
      doc.setFontSize(fontSize);
      doc.setFont('helvetica', 'bold');
      let xPos = margin + 2;
      headers.forEach((header, i) => {
        doc.text(header, xPos, yPos + 4);
        xPos += colWidths[i];
      });
      yPos += rowHeight;
      
      // Draw rows
      doc.setFont('helvetica', 'normal');
      rows.forEach((row) => {
        if (yPos > 275) {
          doc.addPage();
          yPos = 20;
        }
        xPos = margin + 2;
        row.forEach((cell, i) => {
          const text = cell.length > 35 ? cell.substring(0, 32) + '...' : cell;
          doc.text(text, xPos, yPos + 4);
          xPos += colWidths[i];
        });
        // Draw line under row
        doc.setDrawColor(220, 220, 220);
        doc.line(margin, yPos + rowHeight - 0.5, margin + contentWidth, yPos + rowHeight - 0.5);
        yPos += rowHeight;
      });
      
      return yPos + 4;
    };

    // === HEADER ===
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('RELATÓRIO DE PAGAMENTOS REALIZADOS', margin, y);
    y += 7;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`Período: ${format(mesRef, "MMMM 'de' yyyy", { locale: ptBR })}`, margin, y);
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`, margin + 80, y);
    y += 12;

    // === EXECUTIVE SUMMARY BOX ===
    doc.setDrawColor(100, 100, 100);
    doc.setFillColor(250, 250, 250);
    doc.roundedRect(margin, y, contentWidth, 48, 2, 2, 'FD');
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('RESUMO EXECUTIVO', margin + 5, y + 7);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const col1x = margin + 5;
    const col2x = margin + contentWidth / 2;
    
    doc.text(`Total de pagamentos: ${data.length}`, col1x, y + 15);
    doc.text(`Valor total pago: ${formatCurrency(totalGeral)}`, col2x, y + 15);
    
    // Category/Beneficiary breakdown (top 4)
    doc.setFont('helvetica', 'bold');
    doc.text(`Por ${groupBy === 'categoria' ? 'categoria' : 'beneficiário'}:`, col1x, y + 23);
    doc.setFont('helvetica', 'normal');
    
    const top4 = sortedGroups.slice(0, 4);
    let summaryY = y + 29;
    top4.forEach((group, i) => {
      const percent = totalGeral > 0 ? ((group.total / totalGeral) * 100).toFixed(1) : '0';
      const colX = i % 2 === 0 ? col1x : col2x;
      if (i === 2) summaryY += 6;
      doc.setFillColor(colors[i % colors.length][0], colors[i % colors.length][1], colors[i % colors.length][2]);
      doc.circle(colX + 2, summaryY - 1.5, 1.5, 'F');
      doc.text(`${group.name.substring(0, 20)}: ${formatCurrency(group.total)} (${percent}%)`, colX + 6, summaryY);
    });
    
    // Larger payment and most used account
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    if (maiorPagamento) {
      doc.text(`Maior pagamento: ${normalizeFornecedor(maiorPagamento.beneficiario || '', 25)} - ${formatCurrency(maiorPagamento.paid_amount || maiorPagamento.valor)}`, col1x, y + 44);
    }
    if (contaMaisUsada) {
      doc.text(`Conta principal: ${contaMaisUsada.name} (${contaMaisUsada.count} pagamentos)`, col2x, y + 44);
    }
    
    y += 56;

    // === GROUPED SECTIONS ===
    sortedGroups.forEach((group, i) => {
      y = drawSectionHeader(y, colors[i % colors.length], group.name.toUpperCase(), group.items.length, group.total);
      
      const colHeaders = groupBy === 'categoria' 
        ? ['Beneficiário', 'Valor', 'Data Pgto', 'Conta']
        : ['Descrição', 'Valor', 'Data Pgto', 'Categoria'];
      
      const colWidths = groupBy === 'categoria' 
        ? [70, 35, 35, 40]
        : [70, 35, 35, 40];
      
      const rows = group.items
        .sort((a, b) => (b.paid_amount || b.valor) - (a.paid_amount || a.valor))
        .map(p => {
          const paidDate = p.paid_at ? format(parseISO(p.paid_at), 'dd/MM/yyyy') : '—';
          if (groupBy === 'categoria') {
            return [
              normalizeFornecedor(p.beneficiario || '', 30),
              formatCurrency(p.paid_amount || p.valor),
              paidDate,
              p.accounts?.name?.substring(0, 15) || '—'
            ];
          } else {
            return [
              p.description?.substring(0, 30) || 'Pagamento',
              formatCurrency(p.paid_amount || p.valor),
              paidDate,
              p.categories?.name?.substring(0, 15) || '—'
            ];
          }
        });
      
      y = drawTable(y, colHeaders, rows, colWidths);
      
      // Subtotal
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text(`Subtotal: ${formatCurrency(group.total)}`, margin + contentWidth - 45, y - 2);
      doc.setFont('helvetica', 'normal');
      y += 6;
    });

    doc.save(`relatorio-pagos-${groupBy}-${format(mesRef, 'yyyy-MM')}.pdf`);
    toast.success('Relatório gerencial exportado!');
  };

  // Export monthly report grouped
  const exportMonthlyReport = (groupBy: 'categoria' | 'beneficiario') => {
    if (statusFilter !== 'PAGO') {
      toast.error('Selecione "Pagos" no filtro de status para gerar relatório mensal');
      return;
    }

    const data = filteredPayables;
    const monthLabel = format(monthFilter, 'MMMM yyyy', { locale: ptBR });
    
    // Group data
    const groups: Record<string, PayableWithAccount[]> = {};
    data.forEach((p) => {
      const key = groupBy === 'categoria' 
        ? ((p as PayableWithAccount).categories?.name || 'Sem Categoria')
        : (p.beneficiario || 'Sem Beneficiário');
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    });

    // Create Excel with grouped data
    const wb = XLSX.utils.book_new();
    
    // Summary sheet
    const summaryData = Object.entries(groups).map(([name, items]) => ({
      [groupBy === 'categoria' ? 'Categoria' : 'Beneficiário']: name,
      'Quantidade': items.length,
      'Valor Total': items.reduce((sum, p) => sum + (p.paid_amount || p.valor), 0),
    }));
    summaryData.push({
      [groupBy === 'categoria' ? 'Categoria' : 'Beneficiário']: 'TOTAL',
      'Quantidade': data.length,
      'Valor Total': data.reduce((sum, p) => sum + (p.paid_amount || p.valor), 0),
    });
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumo');

    // Detail sheet
    const detailData = data.map((p) => ({
      [groupBy === 'categoria' ? 'Categoria' : 'Beneficiário']: groupBy === 'categoria'
        ? ((p as PayableWithAccount).categories?.name || 'Sem Categoria')
        : (p.beneficiario || 'Sem Beneficiário'),
      'Beneficiário': p.beneficiario || '',
      'Categoria': (p as PayableWithAccount).categories?.name || '',
      'Valor': p.paid_amount || p.valor,
      'Data Pagamento': p.paid_at ? format(new Date(p.paid_at), 'dd/MM/yyyy') : '',
      'Vencimento': format(new Date(p.vencimento), 'dd/MM/yyyy'),
      'Conta': (p as PayableWithAccount).accounts?.name || '',
      'Descrição': p.description || '',
    })).sort((a, b) => a[groupBy === 'categoria' ? 'Categoria' : 'Beneficiário']
      .localeCompare(b[groupBy === 'categoria' ? 'Categoria' : 'Beneficiário']));
    const wsDetail = XLSX.utils.json_to_sheet(detailData);
    XLSX.utils.book_append_sheet(wb, wsDetail, 'Detalhes');

    XLSX.writeFile(wb, `relatorio-pagamentos-${groupBy}-${format(monthFilter, 'yyyy-MM')}.xlsx`);
    toast.success('Relatório exportado com sucesso!');
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              {statusFilter === 'PAGO' ? 'Pagamentos Realizados' : 'Pagamentos Pendentes'}
            </h1>
            <p className="text-muted-foreground">
              {statusFilter === 'PAGO' 
                ? `Histórico de pagamentos - ${format(monthFilter, 'MMMM yyyy', { locale: ptBR })}`
                : 'Copie os dados e pague rapidamente no app do banco'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-1" />
                  Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Listas Simples</DropdownMenuLabel>
                <DropdownMenuItem onClick={exportToExcel}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Excel (dados completos)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportToPDF}>
                  <FileText className="h-4 w-4 mr-2" />
                  PDF Simples
                </DropdownMenuItem>
                {statusFilter !== 'PAGO' && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Relatório Gerencial</DropdownMenuLabel>
                    <DropdownMenuItem onClick={exportPDFGerencial}>
                      <BarChart3 className="h-4 w-4 mr-2" />
                      PDF Gerencial (recomendado)
                    </DropdownMenuItem>
                  </>
                )}
                {statusFilter === 'PAGO' && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Relatório Gerencial (PDF)</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => exportPDFPagosGerencial('categoria')}>
                      <BarChart3 className="h-4 w-4 mr-2" />
                      PDF por Categoria
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportPDFPagosGerencial('beneficiario')}>
                      <BarChart3 className="h-4 w-4 mr-2" />
                      PDF por Beneficiário
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Relatório Mensal (Excel)</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => exportMonthlyReport('categoria')}>
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      Excel por Categoria
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportMonthlyReport('beneficiario')}>
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      Excel por Beneficiário
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Pagamento
            </Button>
          </div>
        </div>

        {/* Micro-onboarding */}
        <ScreenGuide
          purpose="Painel de pagamentos. Visualize pendentes ou histórico de pagos, exporte relatórios mensais."
          steps={[
            'Use o filtro de Status para alternar entre Pendentes e Pagos.',
            statusFilter === 'PAGO' 
              ? 'Navegue entre meses e exporte relatórios agrupados por categoria ou beneficiário.'
              : "Clique em 'Copiar' para copiar linha digitável ou chave PIX.",
            statusFilter !== 'PAGO' ? "Após pagar, clique no ✓ para marcar como pago." : '',
          ].filter(Boolean)}
          storageKey="boletos-v3-guide"
          className="mb-2"
        />

        {/* Alert when highlighted record not found */}
        {highlightId && !isLoading && !highlightedRecordFound && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4 flex items-start gap-3">
            <FileWarning className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">
                Não foi possível exibir o registro destacado
              </p>
              <p className="text-sm text-amber-700 mt-1">
                Motivos comuns: unidade diferente da selecionada, permissões de acesso ou registro removido.
              </p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="space-y-3">
          {isSecretaria && activeUnit ? (
            <div className="flex flex-wrap gap-4 items-center">
              <Badge variant="outline" className="text-sm py-1.5 px-3">
                Unidade: {activeUnit.name}
              </Badge>
              <PayablesFiltersExtended
                periodDays={periodDays}
                onPeriodDaysChange={setPeriodDays}
                beneficiario={beneficiarioFilter}
                onBeneficiarioChange={setBeneficiarioFilter}
                unitId={unitIdFilter}
                onUnitIdChange={() => {}}
                units={[]}
                paymentAccountId={paymentAccountFilter}
                onPaymentAccountIdChange={setPaymentAccountFilter}
                accounts={accounts}
                nfLinkStatus={nfLinkFilter}
                onNfLinkStatusChange={setNfLinkFilter}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
                onClear={handleClearFilters}
              />
            </div>
          ) : (
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
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              onClear={handleClearFilters}
            />
          )}
          
          {/* Month selector for paid payables */}
          {statusFilter === 'PAGO' && (
            <div className="flex items-center gap-2 px-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMonthFilter(subMonths(monthFilter, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="font-medium min-w-[140px] text-center">
                {format(monthFilter, 'MMMM yyyy', { locale: ptBR })}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMonthFilter(addMonths(monthFilter, 1))}
                disabled={monthFilter >= startOfDay(new Date())}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
          
          {/* Toggle para mostrar todas despesas - only for pending */}
          {statusFilter !== 'PAGO' && (
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
          )}
        </div>

        {/* Summary Cards */}
        {statusFilter === 'PAGO' && summaryPaid ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-green-500/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-green-600 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Pagos no Mês
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{summaryPaid.count}</div>
                <p className="text-sm text-muted-foreground">
                  {summaryPaid.total.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Período
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-medium">
                  {format(monthFilter, 'MMMM yyyy', { locale: ptBR })}
                </div>
                <p className="text-sm text-muted-foreground">
                  Exporte relatório agrupado por categoria ou beneficiário
                </p>
              </CardContent>
            </Card>
          </div>
        ) : summaryPending && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="border-destructive/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-destructive flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-destructive" />
                  Vencidos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">{summaryPending.vencidos}</div>
                <p className="text-sm text-muted-foreground">
                  {summaryPending.vencidosValor.toLocaleString('pt-BR', {
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
                <div className="text-2xl font-bold text-orange-600">{summaryPending.hojeAmanha}</div>
                <p className="text-sm text-muted-foreground">
                  {summaryPending.hojeAmanhaValor.toLocaleString('pt-BR', {
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
                <div className="text-2xl font-bold text-yellow-600">{summaryPending.semana}</div>
                <p className="text-sm text-muted-foreground">
                  {summaryPending.semanaValor.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })}
                </p>
              </CardContent>
            </Card>
            <Card className={summaryPending.pendentesNf > 0 ? 'border-amber-500/50' : ''}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-amber-600 flex items-center gap-2">
                  <FileWarning className="h-4 w-4" />
                  Sem NF Vinculada
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-600">{summaryPending.pendentesNf}</div>
                <p className="text-sm text-muted-foreground">boletos de compra</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[130px]">
                    {statusFilter === 'PAGO' ? 'Pago em' : 'Vencimento'}
                  </TableHead>
                  <TableHead>Beneficiário</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="w-[100px]">Tipo</TableHead>
                  <TableHead className="w-[120px]">NF</TableHead>
                  <TableHead className="w-[140px]">Conta</TableHead>
                  {statusFilter !== 'PAGO' && (
                    <TableHead className="w-[220px]">Dados p/ Pagamento</TableHead>
                  )}
                  {statusFilter === 'PAGO' && (
                    <TableHead className="w-[120px]">Categoria</TableHead>
                  )}
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
                      {statusFilter === 'PAGO' 
                        ? `Nenhum pagamento encontrado em ${format(monthFilter, 'MMMM yyyy', { locale: ptBR })}`
                        : 'Nenhum pagamento pendente encontrado'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPayables.map((payable) => (
                    <TableRow 
                      key={payable.id}
                      ref={payable.id === highlightId ? highlightRowRef : undefined}
                      className={payable.id === highlightId ? 'bg-primary/10 ring-2 ring-primary ring-inset animate-pulse' : ''}
                    >
                      {/* Date */}
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="font-medium">
                            {statusFilter === 'PAGO' && payable.paid_at
                              ? format(new Date(payable.paid_at), 'dd/MM/yyyy', { locale: ptBR })
                              : format(new Date(payable.vencimento), 'dd/MM/yyyy', { locale: ptBR })}
                          </span>
                          {getUrgencyBadge(payable)}
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
                        {(statusFilter === 'PAGO' ? (payable.paid_amount || payable.valor) : payable.valor)
                          .toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                      </TableCell>

                      {/* Tipo */}
                      <TableCell>{getPaymentTypeBadge(payable)}</TableCell>

                      {/* NF Status */}
                      <TableCell>
                        {payable.supplier_invoice_id ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs gap-1 text-green-600 border-green-300 hover:bg-green-50"
                                onClick={() => {
                                  const invoice = supplierInvoices.find(i => i.id === payable.supplier_invoice_id);
                                  if (invoice) {
                                    toast.info(`NF ${invoice.document_number} - ${invoice.supplier_name}`);
                                  }
                                }}
                              >
                                <FileCheck className="h-3 w-3" />
                                Ver NF
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {(() => {
                                const invoice = supplierInvoices.find(i => i.id === payable.supplier_invoice_id);
                                return invoice ? `NF ${invoice.document_number} - ${invoice.supplier_name}` : 'NF vinculada';
                              })()}
                            </TooltipContent>
                          </Tooltip>
                        ) : (payable as any).nf_in_same_document ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs gap-1 text-green-600 border-green-300 hover:bg-green-50"
                                onClick={() => {
                                  if (payable.file_path) {
                                    window.open(payable.file_path, '_blank');
                                  } else {
                                    toast.info('Documento não disponível para visualização');
                                  }
                                }}
                              >
                                <Eye className="h-3 w-3" />
                                Ver Doc
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>NF anexada ao documento do boleto</TooltipContent>
                          </Tooltip>
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

                      {/* Dados para Pagamento - Only for pending */}
                      {statusFilter !== 'PAGO' && (
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
                      )}

                      {/* Categoria - Only for paid */}
                      {statusFilter === 'PAGO' && (
                        <TableCell className="text-sm text-muted-foreground">
                          {(payable as PayableWithAccount).categories?.name || '—'}
                        </TableCell>
                      )}

                      {/* Ações */}
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {payable.status !== 'PAGO' && (
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
                          )}
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
