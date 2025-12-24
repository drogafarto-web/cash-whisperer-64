import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Barcode, Plus, Check, Eye, Trash2 } from 'lucide-react';

import AppLayout from '@/components/layout/AppLayout';
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

import { BoletoUploadForm } from '@/components/payables/BoletoUploadForm';
import { usePayables, useDeletePayable, useMarkPayableAsPaid } from '@/features/payables';

export default function BoletosPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('pendentes');

  const { data: allPayables = [], isLoading } = usePayables();
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

  // Filter payables by status
  const pendentes = allPayables.filter((p) => p.status === 'pendente');
  const vencidos = allPayables.filter((p) => p.status === 'vencido' || (p.status === 'pendente' && new Date(p.vencimento) < new Date()));
  const pagos = allPayables.filter((p) => p.status === 'pago');

  const getFilteredPayables = () => {
    switch (activeTab) {
      case 'vencidos': return vencidos;
      case 'pagos': return pagos;
      default: return pendentes;
    }
  };

  const getStatusBadge = (status: string, vencimento: string) => {
    const isOverdue = status === 'pendente' && new Date(vencimento) < new Date();
    if (isOverdue) {
      return <Badge variant="destructive">Vencido</Badge>;
    }
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pendente: 'secondary',
      pago: 'outline',
      cancelado: 'destructive',
    };
    const labels: Record<string, string> = {
      pendente: 'Pendente',
      pago: 'Pago',
      cancelado: 'Cancelado',
    };
    return <Badge variant={variants[status] || 'secondary'}>{labels[status] || status}</Badge>;
  };

  const handleMarkAsPaid = (payable: typeof allPayables[0]) => {
    markAsPaid.mutate({
      id: payable.id,
      paidAmount: payable.valor,
      paidMethod: 'manual',
    });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Boletos a Pagar</h1>
            <p className="text-muted-foreground">Gerencie boletos e títulos pendentes</p>
          </div>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Boleto
          </Button>
        </div>

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
              <CardTitle className="text-sm font-medium text-muted-foreground">Pagos (mês)</CardTitle>
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
                            {payable.status === 'pendente' && (
                              <Button variant="ghost" size="icon" title="Marcar como pago" onClick={() => handleMarkAsPaid(payable)}>
                                <Check className="h-4 w-4 text-green-600" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" title="Ver detalhes">
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
    </AppLayout>
  );
}
