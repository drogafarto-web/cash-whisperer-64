import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FileText, Plus, Eye, Trash2, AlertCircle, Clock } from 'lucide-react';

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/utils';

import { SupplierInvoiceUploadForm } from '@/components/payables/SupplierInvoiceUploadForm';
import { NfWaitingBoletoCard } from '@/components/payables/NfWaitingBoletoCard';
import { useSupplierInvoices, useDeleteSupplierInvoice } from '@/features/payables';
import { SupplierInvoice } from '@/types/payables';

export default function SupplierInvoicesPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: invoices = [], isLoading } = useSupplierInvoices();
  const deleteInvoice = useDeleteSupplierInvoice();

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

  // Filtered invoices
  const filteredInvoices = useMemo(() => {
    if (statusFilter === 'all') return invoices;
    return invoices.filter((inv) => inv.status === statusFilter);
  }, [invoices, statusFilter]);

  // Summary stats
  const totalInvoices = invoices.length;
  const totalValue = invoices.reduce((sum, inv) => sum + (inv.total_value || 0), 0);
  const pendingCount = invoices.filter((inv) => inv.status === 'pendente').length;
  const waitingBoletoCount = invoices.filter((inv) => inv.status === 'aguardando_boleto').length;

  const getStatusBadge = (status: string) => {
    if (status === 'aguardando_boleto') {
      return (
        <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-500/10">
          <Clock className="h-3 w-3 mr-1" />
          Aguardando Boleto
        </Badge>
      );
    }
    
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pendente: 'secondary',
      parcial: 'default',
      quitada: 'outline',
      cancelada: 'destructive',
    };
    const labels: Record<string, string> = {
      pendente: 'Pendente',
      parcial: 'Parcial',
      quitada: 'Quitada',
      cancelada: 'Cancelada',
    };
    return <Badge variant={variants[status] || 'secondary'}>{labels[status] || status}</Badge>;
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Notas Fiscais de Fornecedor</h1>
            <p className="text-muted-foreground">Gerencie notas fiscais de entrada e suas parcelas</p>
          </div>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Nota Fiscal
          </Button>
        </div>

        {/* Summary Cards + NF Waiting Boleto Dashboard */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total de NFs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalInvoices}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Valor Total</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Pendentes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{pendingCount}</div>
              </CardContent>
            </Card>
            <Card className={waitingBoletoCount > 0 ? 'border-amber-500' : ''}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-500" />
                  Aguardando Boleto
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-600">{waitingBoletoCount}</div>
              </CardContent>
            </Card>
          </div>
          
          {/* NF Waiting Boleto Dashboard */}
          <div className="lg:col-span-1">
            <NfWaitingBoletoCard />
          </div>
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="aguardando_boleto">Aguardando Boleto</SelectItem>
              <SelectItem value="parcial">Parcial</SelectItem>
              <SelectItem value="quitada">Quitada</SelectItem>
              <SelectItem value="cancelada">Cancelada</SelectItem>
            </SelectContent>
          </Select>
          {statusFilter !== 'all' && (
            <Button variant="ghost" size="sm" onClick={() => setStatusFilter('all')}>
              Limpar filtro
            </Button>
          )}
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Emissão</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-center">Parcelas</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : filteredInvoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      {statusFilter !== 'all' ? 'Nenhuma nota fiscal encontrada com este status' : 'Nenhuma nota fiscal cadastrada'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInvoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">{invoice.document_number}</TableCell>
                      <TableCell>{invoice.supplier_name}</TableCell>
                      <TableCell>
                        {format(new Date(invoice.issue_date), 'dd/MM/yyyy', { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-right">
                        {invoice.total_value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </TableCell>
                      <TableCell className="text-center">{invoice.installments_count || '-'}</TableCell>
                      <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" title="Ver detalhes">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => deleteInvoice.mutate(invoice.id)}
                        >
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
      </div>

      {/* Upload Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Cadastrar Nota Fiscal
            </DialogTitle>
          </DialogHeader>
          <SupplierInvoiceUploadForm
            units={units}
            categories={categories}
            onSuccess={() => setIsDialogOpen(false)}
            onCancel={() => setIsDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
