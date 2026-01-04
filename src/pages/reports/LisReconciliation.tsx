import { useState, useMemo } from 'react';
import { format, subDays, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { UnitSelector } from '@/components/UnitSelector';
import { Skeleton } from '@/components/ui/skeleton';
import { useLisReconciliation, useLinkTransactionToLis, useMarkAsNoMatch } from '@/hooks/useLisReconciliation';
import { useAuth } from '@/hooks/useAuth';
import {
  AlertCircle,
  CheckCircle2,
  XCircle,
  Link2,
  FileWarning,
  Loader2,
  RefreshCw,
  Search,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { LisOrphan, TransactionOrphan } from '@/services/lisFinancialReconciliation';

function LisReconciliationContent() {
  const { activeUnit, isAdmin } = useAuth();
  const [unitId, setUnitId] = useState(activeUnit?.id || '');
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [searchTerm, setSearchTerm] = useState('');

  // Modal states
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [noMatchModalOpen, setNoMatchModalOpen] = useState(false);
  const [selectedLisItem, setSelectedLisItem] = useState<LisOrphan | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionOrphan | null>(null);
  const [noMatchNotes, setNoMatchNotes] = useState('');

  const { data, isLoading, refetch } = useLisReconciliation(unitId, startDate, endDate);
  const linkMutation = useLinkTransactionToLis();
  const noMatchMutation = useMarkAsNoMatch();

  // Filter data by search term
  const filteredData = useMemo(() => {
    if (!data) return null;
    if (!searchTerm) return data;

    const term = searchTerm.toLowerCase();
    return {
      ...data,
      lisWithoutFinancial: data.lisWithoutFinancial.filter(
        item => item.lis_code.toLowerCase().includes(term) ||
          item.patient_name?.toLowerCase().includes(term)
      ),
      financialWithoutLis: data.financialWithoutLis.filter(
        item => item.description?.toLowerCase().includes(term) ||
          item.partner_name?.toLowerCase().includes(term)
      ),
      duplicates: data.duplicates.filter(
        item => item.lis_code.toLowerCase().includes(term)
      ),
    };
  }, [data, searchTerm]);

  const handleLinkClick = (lisItem: LisOrphan) => {
    setSelectedLisItem(lisItem);
    setLinkModalOpen(true);
  };

  const handleSelectTransaction = (tx: TransactionOrphan) => {
    setSelectedTransaction(tx);
  };

  const handleConfirmLink = () => {
    if (!selectedLisItem || !selectedTransaction) return;

    linkMutation.mutate({
      transactionId: selectedTransaction.id,
      lisCode: selectedLisItem.lis_code,
      lisItemId: selectedLisItem.id,
      date: selectedLisItem.date,
    });

    setLinkModalOpen(false);
    setSelectedLisItem(null);
    setSelectedTransaction(null);
  };

  const handleNoMatchClick = (lisItem: LisOrphan) => {
    setSelectedLisItem(lisItem);
    setNoMatchModalOpen(true);
  };

  const handleConfirmNoMatch = () => {
    if (!selectedLisItem) return;

    noMatchMutation.mutate({
      lisCode: selectedLisItem.lis_code,
      lisItemId: selectedLisItem.id,
      date: selectedLisItem.date,
      notes: noMatchNotes,
    });

    setNoMatchModalOpen(false);
    setSelectedLisItem(null);
    setNoMatchNotes('');
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reconciliação LIS ↔ Financeiro</h1>
          <p className="text-muted-foreground">
            Compare códigos LIS importados com movimentações financeiras para garantir rastreabilidade completa.
          </p>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-4 md:grid-cols-4">
              {isAdmin && (
                <div className="space-y-2">
                  <Label>Unidade</Label>
                  <UnitSelector
                    value={unitId}
                    onChange={setUnitId}
                    placeholder="Selecione..."
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>Data Inicial</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Data Final</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Buscar</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Código LIS ou paciente..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <Button onClick={() => refetch()} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Atualizar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : data && (
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Itens LIS</CardDescription>
                <CardTitle className="text-2xl">{data.totals.lisCount}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Total: {formatCurrency(data.totals.lisAmount)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Transações</CardDescription>
                <CardTitle className="text-2xl">{data.totals.transactionCount}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Total: {formatCurrency(data.totals.transactionAmount)}
                </p>
              </CardContent>
            </Card>
            <Card className="border-success/50">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  Conciliados
                </CardDescription>
                <CardTitle className="text-2xl text-success">{data.totals.matchedCount}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {formatCurrency(data.totals.matchedAmount)}
                </p>
              </CardContent>
            </Card>
            <Card className="border-warning/50">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                  <AlertCircle className="h-4 w-4 text-warning" />
                  Pendências
                </CardDescription>
                <CardTitle className="text-2xl text-warning">
                  {data.lisWithoutFinancial.length + data.financialWithoutLis.length + data.duplicates.length}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Requer atenção
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabs with Tables */}
        <Card>
          <CardContent className="pt-6">
            <Tabs defaultValue="lis-orphans">
              <TabsList className="mb-4">
                <TabsTrigger value="lis-orphans" className="flex items-center gap-2">
                  <XCircle className="h-4 w-4" />
                  LIS sem Financeiro
                  {filteredData && (
                    <Badge variant="secondary">{filteredData.lisWithoutFinancial.length}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="tx-orphans" className="flex items-center gap-2">
                  <FileWarning className="h-4 w-4" />
                  Financeiro sem LIS
                  {filteredData && (
                    <Badge variant="secondary">{filteredData.financialWithoutLis.length}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="duplicates" className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Duplicidades
                  {filteredData && (
                    <Badge variant="secondary">{filteredData.duplicates.length}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="matched" className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Conciliados
                  {filteredData && (
                    <Badge variant="secondary">{filteredData.matched.length}</Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              {/* LIS without Financial */}
              <TabsContent value="lis-orphans">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código LIS</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Paciente</TableHead>
                      <TableHead>Pagamento</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                        </TableCell>
                      </TableRow>
                    ) : filteredData?.lisWithoutFinancial.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          Nenhum item LIS sem correspondência financeira
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredData?.lisWithoutFinancial.map(item => (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono font-medium">{item.lis_code}</TableCell>
                          <TableCell>{format(new Date(item.date), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                          <TableCell>{item.patient_name || '—'}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{item.payment_method}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(item.amount)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleLinkClick(item)}
                              >
                                <Link2 className="h-4 w-4 mr-1" />
                                Vincular
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleNoMatchClick(item)}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Sem match
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TabsContent>

              {/* Financial without LIS */}
              <TabsContent value="tx-orphans">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Parceiro</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                        </TableCell>
                      </TableRow>
                    ) : filteredData?.financialWithoutLis.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          Todas as transações têm código LIS vinculado
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredData?.financialWithoutLis.map(tx => (
                        <TableRow key={tx.id}>
                          <TableCell>{format(new Date(tx.date), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                          <TableCell>{tx.description || '—'}</TableCell>
                          <TableCell>{tx.partner_name || '—'}</TableCell>
                          <TableCell>{tx.category_name || '—'}</TableCell>
                          <TableCell className="text-right font-medium text-success">
                            {formatCurrency(tx.amount)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TabsContent>

              {/* Duplicates */}
              <TabsContent value="duplicates">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código LIS</TableHead>
                      <TableHead>Ocorrências</TableHead>
                      <TableHead>Datas</TableHead>
                      <TableHead className="text-right">Valor Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                        </TableCell>
                      </TableRow>
                    ) : filteredData?.duplicates.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          Nenhuma duplicidade encontrada
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredData?.duplicates.map(dup => (
                        <TableRow key={dup.lis_code}>
                          <TableCell className="font-mono font-medium">{dup.lis_code}</TableCell>
                          <TableCell>
                            <Badge variant="destructive">{dup.occurrences}x</Badge>
                          </TableCell>
                          <TableCell>
                            {dup.dates.map(d => format(new Date(d), 'dd/MM', { locale: ptBR })).join(', ')}
                          </TableCell>
                          <TableCell className="text-right font-medium text-destructive">
                            {formatCurrency(dup.total_amount)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TabsContent>

              {/* Matched */}
              <TabsContent value="matched">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código LIS</TableHead>
                      <TableHead>Data LIS</TableHead>
                      <TableHead>Data Transação</TableHead>
                      <TableHead className="text-right">Valor LIS</TableHead>
                      <TableHead className="text-right">Valor Transação</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                        </TableCell>
                      </TableRow>
                    ) : filteredData?.matched.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          Nenhum registro conciliado
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredData?.matched.map(match => (
                        <TableRow key={match.lis_code}>
                          <TableCell className="font-mono font-medium">{match.lis_code}</TableCell>
                          <TableCell>{format(new Date(match.lis_date), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                          <TableCell>{format(new Date(match.transaction_date), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                          <TableCell className="text-right">{formatCurrency(match.lis_amount)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(match.transaction_amount)}</TableCell>
                          <TableCell>
                            {Math.abs(match.lis_amount - match.transaction_amount) < 0.01 ? (
                              <Badge className="bg-success text-success-foreground">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                OK
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-warning/20 text-warning">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Divergência
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Link Modal */}
      <Dialog open={linkModalOpen} onOpenChange={setLinkModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Vincular Transação ao LIS</DialogTitle>
            <DialogDescription>
              Selecione uma transação para vincular ao código LIS {selectedLisItem?.lis_code}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedLisItem && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm">
                  <strong>LIS:</strong> {selectedLisItem.lis_code} |
                  <strong> Data:</strong> {format(new Date(selectedLisItem.date), 'dd/MM/yyyy')} |
                  <strong> Valor:</strong> {formatCurrency(selectedLisItem.amount)}
                </p>
              </div>
            )}
            <div className="max-h-64 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead></TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.financialWithoutLis.map(tx => (
                    <TableRow
                      key={tx.id}
                      className={`cursor-pointer ${selectedTransaction?.id === tx.id ? 'bg-primary/10' : ''}`}
                      onClick={() => handleSelectTransaction(tx)}
                    >
                      <TableCell>
                        <input
                          type="radio"
                          checked={selectedTransaction?.id === tx.id}
                          onChange={() => handleSelectTransaction(tx)}
                        />
                      </TableCell>
                      <TableCell>{format(new Date(tx.date), 'dd/MM/yyyy')}</TableCell>
                      <TableCell>{tx.description || tx.partner_name || '—'}</TableCell>
                      <TableCell className="text-right">{formatCurrency(tx.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmLink}
              disabled={!selectedTransaction || linkMutation.isPending}
            >
              {linkMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar Vinculação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* No Match Modal */}
      <Dialog open={noMatchModalOpen} onOpenChange={setNoMatchModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar como Sem Correspondência</DialogTitle>
            <DialogDescription>
              O item LIS {selectedLisItem?.lis_code} será marcado como sem transação correspondente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Justificativa (opcional)</Label>
              <Textarea
                placeholder="Motivo pelo qual não há correspondência..."
                value={noMatchNotes}
                onChange={e => setNoMatchNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoMatchModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmNoMatch}
              disabled={noMatchMutation.isPending}
            >
              {noMatchMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

export default LisReconciliationContent;
