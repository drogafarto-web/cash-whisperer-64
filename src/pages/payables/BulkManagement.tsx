import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Trash2, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Search,
  Building2,
  Calendar,
  Filter,
  RefreshCw
} from 'lucide-react';

import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency, DATE_FORMATS } from '@/lib/formats';
import { Payable } from '@/types/payables';

interface PayableWithUnit extends Payable {
  units?: { name: string } | null;
}

type BulkAction = 'mark_paid' | 'mark_cancelled' | 'delete';

export default function BulkManagement() {
  const queryClient = useQueryClient();
  const today = new Date();
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUnitId, setSelectedUnitId] = useState<string>('all');
  const [ageFilter, setAgeFilter] = useState<string>('all'); // all, 30, 60, 90, 180, 365
  
  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Confirmation dialog
  const [confirmAction, setConfirmAction] = useState<BulkAction | null>(null);

  // Fetch units
  const { data: units = [] } = useQuery({
    queryKey: ['units'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('units')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch overdue/pending payables
  const { data: payables = [], isLoading, refetch } = useQuery({
    queryKey: ['bulk-payables', selectedUnitId, ageFilter],
    queryFn: async () => {
      let query = supabase
        .from('payables')
        .select('*, units(name)')
        .in('status', ['pendente', 'PENDENTE', 'vencido', 'VENCIDO'])
        .lt('vencimento', format(today, 'yyyy-MM-dd'))
        .order('vencimento', { ascending: true });

      if (selectedUnitId && selectedUnitId !== 'all') {
        query = query.eq('unit_id', selectedUnitId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as PayableWithUnit[];
    },
  });

  // Filter payables based on age and search
  const filteredPayables = useMemo(() => {
    let result = payables;

    // Age filter
    if (ageFilter !== 'all') {
      const minDays = parseInt(ageFilter);
      result = result.filter(p => {
        const daysOverdue = differenceInDays(today, parseISO(p.vencimento));
        return daysOverdue >= minDays;
      });
    }

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(p => 
        p.beneficiario?.toLowerCase().includes(term) ||
        p.description?.toLowerCase().includes(term)
      );
    }

    return result;
  }, [payables, ageFilter, searchTerm, today]);

  // Summary stats
  const stats = useMemo(() => {
    const total = filteredPayables.reduce((sum, p) => sum + (p.valor || 0), 0);
    const selected = filteredPayables
      .filter(p => selectedIds.has(p.id))
      .reduce((sum, p) => sum + (p.valor || 0), 0);
    
    const over30 = filteredPayables.filter(p => 
      differenceInDays(today, parseISO(p.vencimento)) >= 30
    ).length;
    
    const over90 = filteredPayables.filter(p => 
      differenceInDays(today, parseISO(p.vencimento)) >= 90
    ).length;
    
    const over365 = filteredPayables.filter(p => 
      differenceInDays(today, parseISO(p.vencimento)) >= 365
    ).length;

    return { total, selected, over30, over90, over365 };
  }, [filteredPayables, selectedIds, today]);

  // Bulk action mutation
  const bulkMutation = useMutation({
    mutationFn: async ({ action, ids }: { action: BulkAction; ids: string[] }) => {
      if (action === 'delete') {
        const { error } = await supabase
          .from('payables')
          .delete()
          .in('id', ids);
        if (error) throw error;
      } else if (action === 'mark_paid') {
        const { error } = await supabase
          .from('payables')
          .update({ 
            status: 'PAGO',
            paid_at: new Date().toISOString(),
          })
          .in('id', ids);
        if (error) throw error;
      } else if (action === 'mark_cancelled') {
        const { error } = await supabase
          .from('payables')
          .update({ status: 'CANCELADO' })
          .in('id', ids);
        if (error) throw error;
      }
    },
    onSuccess: (_, { action, ids }) => {
      const actionLabels: Record<BulkAction, string> = {
        mark_paid: 'marcados como pagos',
        mark_cancelled: 'cancelados',
        delete: 'excluídos',
      };
      toast.success(`${ids.length} registros ${actionLabels[action]} com sucesso!`);
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['bulk-payables'] });
      queryClient.invalidateQueries({ queryKey: ['payables'] });
    },
    onError: (error) => {
      toast.error('Erro ao executar ação: ' + (error as Error).message);
    },
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredPayables.map(p => p.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSet = new Set(selectedIds);
    if (checked) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    setSelectedIds(newSet);
  };

  const executeAction = () => {
    if (!confirmAction || selectedIds.size === 0) return;
    bulkMutation.mutate({ action: confirmAction, ids: Array.from(selectedIds) });
    setConfirmAction(null);
  };

  const getDaysOverdue = (vencimento: string) => {
    return differenceInDays(today, parseISO(vencimento));
  };

  const getAgeBadge = (days: number) => {
    if (days >= 365) {
      return <Badge variant="destructive">+1 ano</Badge>;
    } else if (days >= 180) {
      return <Badge variant="destructive">+6 meses</Badge>;
    } else if (days >= 90) {
      return <Badge className="bg-orange-500">+90 dias</Badge>;
    } else if (days >= 30) {
      return <Badge className="bg-amber-500">+30 dias</Badge>;
    }
    return <Badge variant="secondary">{days}d</Badge>;
  };

  return (
    <AppLayout>
      <div className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Gestão em Massa de Contas</h1>
          <p className="text-muted-foreground">
            Visualize e atualize em massa contas vencidas e não pagas
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Vencido</CardDescription>
              <CardTitle className="text-destructive">{formatCurrency(stats.total)}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{filteredPayables.length} contas</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>+30 dias</CardDescription>
              <CardTitle className="text-amber-600">{stats.over30}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">contas vencidas</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>+90 dias</CardDescription>
              <CardTitle className="text-orange-600">{stats.over90}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">contas antigas</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>+1 ano</CardDescription>
              <CardTitle className="text-destructive">{stats.over365}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">muito antigas</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar beneficiário..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              
              <Select value={selectedUnitId} onValueChange={setSelectedUnitId}>
                <SelectTrigger>
                  <Building2 className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Todas unidades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas unidades</SelectItem>
                  {units.map((unit) => (
                    <SelectItem key={unit.id} value={unit.id}>{unit.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={ageFilter} onValueChange={setAgeFilter}>
                <SelectTrigger>
                  <Calendar className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Idade do vencimento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos vencidos</SelectItem>
                  <SelectItem value="30">+30 dias</SelectItem>
                  <SelectItem value="60">+60 dias</SelectItem>
                  <SelectItem value="90">+90 dias</SelectItem>
                  <SelectItem value="180">+6 meses</SelectItem>
                  <SelectItem value="365">+1 ano</SelectItem>
                </SelectContent>
              </Select>

              <Button variant="outline" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Atualizar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Bulk Actions */}
        {selectedIds.size > 0 && (
          <Card className="border-primary">
            <CardContent className="py-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-base px-3 py-1">
                    {selectedIds.size} selecionado(s)
                  </Badge>
                  <span className="text-muted-foreground">
                    Total: {formatCurrency(stats.selected)}
                  </span>
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    className="text-emerald-600 border-emerald-600 hover:bg-emerald-50"
                    onClick={() => setConfirmAction('mark_paid')}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Marcar como Pago
                  </Button>
                  <Button 
                    variant="outline"
                    className="text-amber-600 border-amber-600 hover:bg-amber-50"
                    onClick={() => setConfirmAction('mark_cancelled')}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Cancelar
                  </Button>
                  <Button 
                    variant="destructive"
                    onClick={() => setConfirmAction('delete')}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedIds.size === filteredPayables.length && filteredPayables.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Beneficiário</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Atraso</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : filteredPayables.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <CheckCircle className="h-8 w-8 text-emerald-500" />
                        <p>Nenhuma conta vencida encontrada!</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPayables.map((payable) => {
                    const daysOverdue = getDaysOverdue(payable.vencimento);
                    return (
                      <TableRow key={payable.id} className={selectedIds.has(payable.id) ? 'bg-muted/50' : ''}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(payable.id)}
                            onCheckedChange={(checked) => handleSelectOne(payable.id, checked as boolean)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{payable.beneficiario}</div>
                          {payable.description && (
                            <div className="text-sm text-muted-foreground truncate max-w-xs">
                              {payable.description}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{payable.units?.name || '-'}</span>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(payable.valor || 0)}
                        </TableCell>
                        <TableCell>
                          {format(parseISO(payable.vencimento), DATE_FORMATS.short, { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          {getAgeBadge(daysOverdue)}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmAction !== null} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Confirmar Ação
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === 'delete' && (
                <>
                  Você está prestes a <strong>excluir permanentemente</strong> {selectedIds.size} registro(s).
                  Esta ação não pode ser desfeita.
                </>
              )}
              {confirmAction === 'mark_paid' && (
                <>
                  Você está prestes a marcar {selectedIds.size} registro(s) como <strong>pagos</strong>.
                  O valor total é {formatCurrency(stats.selected)}.
                </>
              )}
              {confirmAction === 'mark_cancelled' && (
                <>
                  Você está prestes a <strong>cancelar</strong> {selectedIds.size} registro(s).
                  O valor total é {formatCurrency(stats.selected)}.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={executeAction}
              className={confirmAction === 'delete' ? 'bg-destructive hover:bg-destructive/90' : ''}
            >
              {confirmAction === 'delete' && 'Excluir'}
              {confirmAction === 'mark_paid' && 'Marcar como Pago'}
              {confirmAction === 'mark_cancelled' && 'Cancelar Registros'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
