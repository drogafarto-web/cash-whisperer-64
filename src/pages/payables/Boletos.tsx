import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Barcode, Plus, Check, Eye, Trash2, FileSpreadsheet, FileText } from 'lucide-react';
import { DateRange } from 'react-day-picker';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { supabase } from '@/integrations/supabase/client';
import { ScreenGuide } from '@/components/ui/ScreenGuide';

import { BoletoUploadForm } from '@/components/payables/BoletoUploadForm';
import { PayablesFilters } from '@/components/payables/PayablesFilters';
import { PayableDetailModal } from '@/components/payables/PayableDetailModal';
import { usePayables, useDeletePayable, useMarkPayableAsPaid } from '@/features/payables';
import type { Payable } from '@/types/payables';

export default function BoletosPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('pendentes');
  
  // Filter states
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [beneficiarioFilter, setBeneficiarioFilter] = useState('');
  const [unitIdFilter, setUnitIdFilter] = useState('');
  
  // Detail modal state
  const [selectedPayable, setSelectedPayable] = useState<Payable | null>(null);

  // Fetch data with API filters
  const { data: allPayables = [], isLoading } = usePayables({
    startDate: dateRange?.from?.toISOString().split('T')[0],
    endDate: dateRange?.to?.toISOString().split('T')[0],
    unitId: unitIdFilter && unitIdFilter !== 'all' ? unitIdFilter : undefined,
  });
  
  const deletePayable = useDeletePayable();
  const markAsPaid = useMarkPayableAsPaid();

  const { data: units = [] } = useQuery({
    queryKey: ['units'],
    queryFn: async () => {
      const { data } = await supabase.from('units').select('id, name');
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
      const { data } = await supabase.from('supplier_invoices').select('id, document_number, supplier_name');
      return data || [];
    },
  });

  // Apply client-side filter for beneficiario text search
  const filteredPayables = useMemo(() => {
    if (!beneficiarioFilter) return allPayables;
    const searchTerm = beneficiarioFilter.toLowerCase();
    return allPayables.filter((p) => 
      p.beneficiario?.toLowerCase().includes(searchTerm)
    );
  }, [allPayables, beneficiarioFilter]);

  // Filter by status
  const pendentes = filteredPayables.filter((p) => p.status === 'PENDENTE' && new Date(p.vencimento) >= new Date());
  const vencidos = filteredPayables.filter((p) => p.status === 'VENCIDO' || (p.status === 'PENDENTE' && new Date(p.vencimento) < new Date()));
  const pagos = filteredPayables.filter((p) => p.status === 'PAGO');

  const getFilteredPayables = () => {
    switch (activeTab) {
      case 'vencidos': return vencidos;
      case 'pagos': return pagos;
      default: return pendentes;
    }
  };

  const getStatusBadge = (status: string, vencimento: string) => {
    const isOverdue = status === 'PENDENTE' && new Date(vencimento) < new Date();
    if (isOverdue) {
      return <Badge variant="destructive">Vencido</Badge>;
    }
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      PENDENTE: 'secondary',
      PAGO: 'outline',
      CANCELADO: 'destructive',
    };
    const labels: Record<string, string> = {
      PENDENTE: 'Pendente',
      PAGO: 'Pago',
      CANCELADO: 'Cancelado',
    };
    return <Badge variant={variants[status] || 'secondary'}>{labels[status] || status}</Badge>;
  };

  const handleMarkAsPaid = (payable: Payable) => {
    markAsPaid.mutate({
      id: payable.id,
      paidAmount: payable.valor,
      paidMethod: 'manual',
    });
    setSelectedPayable(null);
  };

  const handleClearFilters = () => {
    setDateRange(undefined);
    setBeneficiarioFilter('');
    setUnitIdFilter('');
  };

  const exportToExcel = () => {
    const dataToExport = getFilteredPayables().map((p) => ({
      'Beneficiário': p.beneficiario || '',
      'CNPJ': p.beneficiario_cnpj || '',
      'Valor': p.valor,
      'Vencimento': format(new Date(p.vencimento), 'dd/MM/yyyy'),
      'Status': p.status,
      'Parcela': p.parcela_numero ? `${p.parcela_numero}/${p.parcela_total}` : '',
      'Linha Digitável': p.linha_digitavel || '',
      'Descrição': p.description || '',
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Boletos');
    XLSX.writeFile(wb, `boletos-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    const data = getFilteredPayables();
    const statusLabels: Record<string, string> = { pendente: 'Pendente', pago: 'Pago', vencido: 'Vencido', cancelado: 'Cancelado' };

    doc.setFontSize(16);
    doc.text('Relatório de Boletos', 20, 20);

    doc.setFontSize(10);
    doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 20, 28);
    doc.text(`Tab: ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`, 20, 34);
    doc.text(`Total: ${data.length} boletos`, 20, 40);
    doc.text(
      `Valor total: ${data.reduce((sum, p) => sum + p.valor, 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
      20,
      46
    );

    let y = 60;
    data.forEach((p, i) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      const status = statusLabels[p.status] || p.status;
      doc.setFontSize(10);
      doc.text(`${i + 1}. ${p.beneficiario || 'Sem beneficiário'}`, 20, y);
      doc.setFontSize(9);
      doc.text(
        `${p.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} | Venc: ${format(new Date(p.vencimento), 'dd/MM/yyyy')} | ${status}`,
        25,
        y + 5
      );
      y += 14;
    });

    doc.save(`boletos-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Boletos a Pagar</h1>
            <p className="text-muted-foreground">Gerencie boletos e títulos pendentes</p>
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
              Novo Boleto
            </Button>
          </div>
        </div>

        {/* Micro-onboarding */}
        <ScreenGuide
          purpose="Nesta tela você gerencia todos os boletos e títulos a pagar da empresa."
          steps={[
            "Clique em 'Novo Boleto' para cadastrar. Você pode escanear o PDF para preencher automaticamente.",
            "Revise boletos vencidos na aba vermelha - eles precisam de atenção imediata.",
            "Marque como 'Pago' clicando no ✓ quando confirmar o pagamento."
          ]}
          storageKey="boletos-guide"
          className="mb-2"
        />

        {/* Filters */}
        <PayablesFilters
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          beneficiario={beneficiarioFilter}
          onBeneficiarioChange={setBeneficiarioFilter}
          unitId={unitIdFilter}
          onUnitIdChange={setUnitIdFilter}
          units={units}
          onClear={handleClearFilters}
        />

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pendentes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendentes.length}</div>
              <p className="text-sm text-muted-foreground">
                {pendentes.reduce((sum, p) => sum + p.valor, 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </CardContent>
          </Card>
          <Card className="border-destructive/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-destructive">Vencidos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{vencidos.length}</div>
              <p className="text-sm text-muted-foreground">
                {vencidos.reduce((sum, p) => sum + p.valor, 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pagos (período)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pagos.length}</div>
              <p className="text-sm text-muted-foreground">
                {pagos.reduce((sum, p) => sum + p.valor, 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs and Table */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="pendentes">Pendentes ({pendentes.length})</TabsTrigger>
            <TabsTrigger value="vencidos">Vencidos ({vencidos.length})</TabsTrigger>
            <TabsTrigger value="pagos">Pagos ({pagos.length})</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab}>
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Beneficiário</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-center">Parcela</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">Carregando...</TableCell>
                      </TableRow>
                    ) : getFilteredPayables().length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          Nenhum boleto encontrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      getFilteredPayables().map((payable) => (
                        <TableRow key={payable.id}>
                          <TableCell className="font-medium">{payable.beneficiario}</TableCell>
                          <TableCell>{format(new Date(payable.vencimento), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                          <TableCell className="text-right">
                            {payable.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </TableCell>
                          <TableCell className="text-center">
                            {payable.parcela_numero && payable.parcela_total
                              ? `${payable.parcela_numero}/${payable.parcela_total}`
                              : '-'}
                          </TableCell>
                          <TableCell>{getStatusBadge(payable.status, payable.vencimento)}</TableCell>
                          <TableCell className="text-right">
                            {payable.status === 'PENDENTE' && (
                              <Button variant="ghost" size="icon" title="Marcar como pago" onClick={() => handleMarkAsPaid(payable)}>
                                <Check className="h-4 w-4 text-green-600" />
                              </Button>
                            )}
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              title="Ver detalhes"
                              onClick={() => setSelectedPayable(payable)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deletePayable.mutate(payable.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Add Boleto Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Barcode className="h-5 w-5" />
              Cadastrar Boleto
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
        onMarkAsPaid={handleMarkAsPaid}
      />
    </AppLayout>
  );
}
