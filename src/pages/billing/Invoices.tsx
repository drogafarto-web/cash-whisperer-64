import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FileText, Upload, Plus, Eye, Edit, Check, X, Download } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useInvoices, usePayers, useInvoiceMutation } from '@/hooks/useBilling';
import InvoiceUploadForm from '@/components/billing/InvoiceUploadForm';
import InvoiceForm from '@/components/billing/InvoiceForm';
import { Invoice } from '@/types/billing';

const MONTHS = [
  { value: 1, label: 'Janeiro' },
  { value: 2, label: 'Fevereiro' },
  { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Maio' },
  { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' },
  { value: 11, label: 'Novembro' },
  { value: 12, label: 'Dezembro' },
];

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;

export default function Invoices() {
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [selectedPayer, setSelectedPayer] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showFormDialog, setShowFormDialog] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);

  const { data: invoices = [], isLoading } = useInvoices({
    competenceYear: selectedYear,
    competenceMonth: selectedMonth,
    payerId: selectedPayer !== 'all' ? selectedPayer : undefined,
    status: selectedStatus !== 'all' ? selectedStatus : undefined,
  });

  const { data: payers = [] } = usePayers();
  const invoiceMutation = useInvoiceMutation();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ABERTA':
        return <Badge variant="secondary">Aberta</Badge>;
      case 'RECEBIDA':
        return <Badge className="bg-green-600">Recebida</Badge>;
      case 'CANCELADA':
        return <Badge variant="destructive">Cancelada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const totalValue = invoices.reduce((sum, inv) => sum + Number(inv.net_value), 0);
  const openValue = invoices
    .filter((inv) => inv.status === 'ABERTA')
    .reduce((sum, inv) => sum + Number(inv.net_value), 0);
  const receivedValue = invoices
    .filter((inv) => inv.status === 'RECEBIDA')
    .reduce((sum, inv) => sum + Number(inv.net_value), 0);

  const handleEdit = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setShowFormDialog(true);
  };

  const handleMarkReceived = async (invoice: Invoice) => {
    await invoiceMutation.mutateAsync({
      id: invoice.id,
      status: 'RECEBIDA',
      received_at: new Date().toISOString().split('T')[0],
    });
  };

  const handleUploadComplete = (invoice: Partial<Invoice>) => {
    setShowUploadDialog(false);
    setEditingInvoice(invoice as Invoice);
    setShowFormDialog(true);
  };

  const handleFormClose = () => {
    setShowFormDialog(false);
    setEditingInvoice(null);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Notas Fiscais de Serviço</h1>
            <p className="text-muted-foreground">
              Gerencie as NFS-e de convênios e prefeituras
            </p>
          </div>
          <Button onClick={() => setShowUploadDialog(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Enviar NFS-e
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Emitido</CardDescription>
              <CardTitle className="text-2xl">{formatCurrency(totalValue)}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {invoices.length} nota(s) no período
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Em Aberto</CardDescription>
              <CardTitle className="text-2xl text-amber-600">{formatCurrency(openValue)}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Aguardando recebimento
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Recebido</CardDescription>
              <CardTitle className="text-2xl text-green-600">{formatCurrency(receivedValue)}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Pagamentos confirmados
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(Number(v))}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Mês" />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m) => (
                    <SelectItem key={m.value} value={m.value.toString()}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(Number(v))}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Ano" />
                </SelectTrigger>
                <SelectContent>
                  {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                    <SelectItem key={y} value={y.toString()}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedPayer} onValueChange={setSelectedPayer}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Convênio/Prefeitura" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {payers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="ABERTA">Aberta</SelectItem>
                  <SelectItem value="RECEBIDA">Recebida</SelectItem>
                  <SelectItem value="CANCELADA">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Invoices Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Notas Fiscais
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : invoices.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma nota fiscal encontrada no período
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Tomador</TableHead>
                    <TableHead>Competência</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">{invoice.document_number}</TableCell>
                      <TableCell>
                        {format(new Date(invoice.issue_date), 'dd/MM/yyyy', { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{invoice.customer_name}</div>
                          {invoice.customer_cnpj && (
                            <div className="text-xs text-muted-foreground">{invoice.customer_cnpj}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {MONTHS.find((m) => m.value === invoice.competence_month)?.label}/{invoice.competence_year}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(invoice.net_value)}
                      </TableCell>
                      <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(invoice)}
                            title="Editar"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {invoice.status === 'ABERTA' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleMarkReceived(invoice)}
                              title="Marcar como recebida"
                              className="text-green-600 hover:text-green-700"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Enviar Nota Fiscal de Serviço</DialogTitle>
          </DialogHeader>
          <InvoiceUploadForm onComplete={handleUploadComplete} onCancel={() => setShowUploadDialog(false)} />
        </DialogContent>
      </Dialog>

      {/* Form Dialog */}
      <Dialog open={showFormDialog} onOpenChange={handleFormClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingInvoice?.id ? 'Editar Nota Fiscal' : 'Conferir Nota Fiscal'}
            </DialogTitle>
          </DialogHeader>
          <InvoiceForm
            initialData={editingInvoice || undefined}
            onSuccess={handleFormClose}
            onCancel={handleFormClose}
          />
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
